import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { parseReport } from '@/lib/ota-import/parse'
import { buildPlan, type DbOta, type NightOption } from '@/lib/ota-import/match'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024
const LABEL = { airbnb: 'Airbnb', getyourguide: 'GetYourGuide', viator: 'Viator' } as const

// Upload an OTA's own report (Airbnb CSV, GetYourGuide / Viator .xlsx).
// apply=0 → preview of what would change. apply=1 → same plan, written.
// Form fields: file, apply ('0'|'1'), nights (JSON {ref: night_slug} for
// bookings whose date has 0 or 2+ nights).
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Upload a file' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Upload a file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is larger than 5 MB' }, { status: 400 })
  const apply = form.get('apply') === '1'
  let nightChoices: Record<string, string> = {}
  try { nightChoices = JSON.parse(String(form.get('nights') || '{}')) } catch { /* ignore */ }

  let parsed
  try {
    parsed = parseReport(file.name, Buffer.from(await file.arrayBuffer()))
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not read the file' }, { status: 400 })
  }
  if (!parsed.bookings.length) return NextResponse.json({ error: 'No bookings found in this file' }, { status: 400 })

  const supabase = getServiceSupabase()
  const dates = parsed.bookings.map((b) => b.eventDate).sort()
  const from = new Date(Date.parse(dates[0] + 'T00:00:00Z') - 3 * 86400000).toISOString().slice(0, 10)
  const to = new Date(Date.parse(dates[dates.length - 1] + 'T00:00:00Z') + 3 * 86400000).toISOString().slice(0, 10)

  const [{ data: dbRows, error: dbErr }, { data: nights, error: nErr }] = await Promise.all([
    supabase.from('ota_bookings')
      .select('id, event_date, night_slug, guest_name, quantity, total_paid, booking_ref')
      .eq('source', parsed.source).gte('event_date', from).lte('event_date', to),
    supabase.from('event_dates')
      .select('event_date, night_slug, night_name')
      .gte('event_date', from).lte('event_date', to),
  ])
  // A ref may already be saved on a row outside the date window (e.g. moved night).
  const refs = parsed.bookings.map((b) => b.ref)
  const { data: refRows } = await supabase.from('ota_bookings')
    .select('id, event_date, night_slug, guest_name, quantity, total_paid, booking_ref')
    .eq('source', parsed.source).in('booking_ref', refs)
  if (dbErr || nErr) {
    console.error('ota-import: load error', dbErr || nErr)
    return NextResponse.json({ error: 'Could not load bookings' }, { status: 500 })
  }

  const db = new Map<string, DbOta>()
  for (const r of [...(dbRows ?? []), ...(refRows ?? [])] as DbOta[]) db.set(r.id, r)
  const nightsByDate = new Map<string, NightOption[]>()
  for (const n of nights ?? []) {
    if (n.night_slug === 'smc') continue // Single Meet Club isn't sold on OTAs
    const list = nightsByDate.get(n.event_date) ?? []
    list.push({ slug: n.night_slug, name: n.night_name || n.night_slug })
    nightsByDate.set(n.event_date, list)
  }

  const plan = buildPlan(parsed.source, parsed.bookings, Array.from(db.values()), nightsByDate)
  const count = (k: string) => plan.items.filter((i) => i.kind === k).length
  const summary = {
    source: parsed.source,
    label: LABEL[parsed.source],
    bookings: parsed.bookings.length,
    linked: count('linked'),
    matched: count('match'),
    toAdd: count('new'),
    needsNight: count('needs_night'),
    cancelledSkipped: count('cancelled_skip'),
    cancelledInDashboard: count('cancelled_in_dashboard'),
    dashboardOnly: plan.dashboardOnly.length,
    payoutTo: parsed.payoutTo,
  }

  if (!apply) return NextResponse.json({ summary, plan })

  // ── Apply ────────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const result = { updated: 0, added: 0, skipped: 0, failed: [] as string[] }
  const money = (b: (typeof plan.items)[number]['report']) => ({
    booking_ref: b.ref,
    gross_amount: b.gross,
    platform_fee: b.fee,
    payout_ref: b.payoutRef,
    payout_date: b.payoutDate,
    booked_on: b.bookedOn,
    imported_at: now,
  })

  for (const item of plan.items) {
    const b = item.report
    if (item.kind === 'linked' || item.kind === 'match' || item.kind === 'cancelled_in_dashboard') {
      const patch: Record<string, any> = money(b)
      if (item.kind !== 'cancelled_in_dashboard') patch.total_paid = Math.round(b.net)
      // Fill in a full name when the dashboard only has the first name.
      const dbName = item.db!.guest_name?.trim() ?? ''
      if (b.guestName && b.guestName.length > dbName.length && b.guestName.toLowerCase().startsWith(dbName.toLowerCase())) {
        patch.guest_name = b.guestName
      }
      const { error } = await supabase.from('ota_bookings').update(patch).eq('id', item.db!.id)
      if (error) result.failed.push(`${b.ref}: ${error.message}`)
      else result.updated++
      continue
    }
    if (item.kind === 'new' || item.kind === 'needs_night') {
      // Choice is "YYYY-MM-DD|night_slug" (a nearby night) or just a slug.
      const choice = item.kind === 'new' ? item.nightSlug : nightChoices[b.ref]
      if (!choice) { result.skipped++; continue }
      const [chosenDate, chosenSlug] = choice.includes('|') ? choice.split('|') : [b.eventDate, choice]
      const valid = (nightsByDate.get(chosenDate) ?? []).some((n) => n.slug === chosenSlug)
      if (!valid) { result.failed.push(`${b.ref}: no ${chosenSlug} night on ${chosenDate}`); continue }
      const { error } = await supabase.from('ota_bookings').insert({
        source: parsed.source,
        event_date: chosenDate,
        night_slug: chosenSlug,
        guest_name: b.guestName || `${LABEL[parsed.source]} ${b.ref}`,
        quantity: item.qty,
        total_paid: Math.round(b.net),
        notes: `Imported from ${LABEL[parsed.source]} report${chosenDate !== b.eventDate ? ` (report date ${b.eventDate})` : ''}`,
        ...money(b),
      })
      if (error?.code === '23505') result.skipped++ // already imported
      else if (error) result.failed.push(`${b.ref}: ${error.message}`)
      else result.added++
    }
  }
  return NextResponse.json({ summary, result })
}
