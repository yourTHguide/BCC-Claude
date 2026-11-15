import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { parseReport } from '@/lib/ota-import/parse'
import { buildPlan, MOVE_DAYS, type DbOta, type NightOption } from '@/lib/ota-import/match'
import { isOtaNight, otaNightSlug, otaNightName } from '@/lib/ota-import/nights'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 5 * 1024 * 1024
const LABEL = { airbnb: 'Airbnb', getyourguide: 'GetYourGuide', viator: 'Viator' } as const

// Upload an OTA's own report (Airbnb CSV, GetYourGuide / Viator .xlsx).
// apply=0 → preview of what would change. apply=1 → same plan, written.
// Form fields: file, apply ('0'|'1'), nights (JSON {ref: "YYYY-MM-DD" the
// guest joined, or "" = didn't happen}), fixQty, remove.
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Upload a file' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Upload a file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is larger than 5 MB' }, { status: 400 })
  const apply = form.get('apply') === '1'
  // nights: {ref: "YYYY-MM-DD"} date they joined (report date or rescheduled), "" = didn't happen.
  // The night itself follows from the date (see lib/ota-import/nights).
  // fixQty: [ref]   — use the guest count the report's amount implies
  // remove: [ota_bookings.id] — leftover / cancelled entries to delete
  const json = <T,>(k: string, d: T): T => { try { return JSON.parse(String(form.get(k) || '')) as T } catch { return d } }
  const nightChoices = json<Record<string, string>>('nights', {})
  const fixQty = new Set(json<string[]>('fixQty', []))
  const removeIds = new Set(json<string[]>('remove', []))

  let parsed
  try {
    parsed = parseReport(file.name, Buffer.from(await file.arrayBuffer()))
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not read the file' }, { status: 400 })
  }
  if (!parsed.bookings.length) return NextResponse.json({ error: 'No bookings found in this file' }, { status: 400 })

  const supabase = getServiceSupabase()
  const dates = parsed.bookings.map((b) => b.eventDate).sort()
  const from = new Date(Date.parse(dates[0] + 'T00:00:00Z') - MOVE_DAYS * 86400000).toISOString().slice(0, 10)
  const to = new Date(Date.parse(dates[dates.length - 1] + 'T00:00:00Z') + MOVE_DAYS * 86400000).toISOString().slice(0, 10)

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
    if (!isOtaNight(n.night_slug)) continue // SMC, New in Bangkok, old themes: never OTA
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

  // Only rows this plan showed as removable can be deleted.
  const removable = new Set<string>([
    ...plan.dashboardOnly.map((r) => r.id),
    ...plan.items.filter((i) => i.kind === 'cancelled_in_dashboard').map((i) => i.db!.id),
  ])

  // Creates (once) a night on a date the calendar didn't have. Closed to
  // website sales; it only exists so OTA guests sit on their real night.
  const sourceLabel = LABEL[parsed.source]
  const created = new Map<string, boolean>()
  // Closed to website sales; it only exists so OTA guests sit on their real night.
  let productId: string | null | undefined
  async function ensureNight(date: string, slug: string): Promise<string | null> {
    const k = `${date}|${slug}`
    if (created.has(k) || (nightsByDate.get(date) ?? []).some((n) => n.slug === slug)) return null
    if (productId === undefined) {
      const { data } = await supabase.from('products').select('id').eq('slug', 'bangkok-club-crawl').maybeSingle()
      productId = data?.id ?? null
    }
    const { error } = await supabase.from('event_dates').insert({
      event_date: date, night_slug: slug, night_name: otaNightName(slug),
      product_id: productId, is_open: false,
      notes: `Added from ${sourceLabel} import (OTA-only night)`,
    })
    if (error && error.code !== '23505') return error.message
    created.set(k, !error) // false = it already existed
    const list = nightsByDate.get(date) ?? []
    list.push({ slug, name: otaNightName(slug) })
    nightsByDate.set(date, list)
    return null
  }

  // ── Apply ────────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const result = { updated: 0, added: 0, skipped: 0, removed: 0, nightsAdded: 0, failed: [] as string[] }
  // Only fields the file actually has: a payout statement (no price, no
  // name) must not wipe what a bookings export filled in, and vice versa.
  const money = (b: (typeof plan.items)[number]['report']) => {
    const out: Record<string, any> = { booking_ref: b.ref, imported_at: now }
    if (b.gross !== null) out.gross_amount = b.gross
    if (b.fee !== null) out.platform_fee = b.fee
    if (b.payoutRef) out.payout_ref = b.payoutRef
    if (b.payoutDate) out.payout_date = b.payoutDate
    if (b.bookedOn) out.booked_on = b.bookedOn
    return out
  }

  for (const item of plan.items) {
    const b = item.report
    if (item.kind === 'linked' || item.kind === 'match' || item.kind === 'cancelled_in_dashboard') {
      if (removeIds.has(item.db!.id)) continue // deleted below
      const patch: Record<string, any> = money(b)
      if (item.suggestedQty && fixQty.has(b.ref)) patch.quantity = item.suggestedQty
      if (item.kind !== 'cancelled_in_dashboard') patch.total_paid = Math.round(b.net)
      // Fill in a full name when the dashboard only has the first name.
      const dbName = item.db!.guest_name?.trim() ?? ''
      if (b.guestName && (!dbName || /guest$/i.test(dbName) || dbName.includes(b.ref) || (b.guestName.length > dbName.length && b.guestName.toLowerCase().startsWith(dbName.toLowerCase())))) {
        patch.guest_name = b.guestName
      }
      if (b.email) patch.guest_email = b.email
      const { error } = await supabase.from('ota_bookings').update(patch).eq('id', item.db!.id)
      if (error) result.failed.push(`${b.ref}: ${error.message}`)
      else result.updated++
      continue
    }
    if (item.kind === 'new' || item.kind === 'needs_night') {
      // Your answer (date joined, or "" = didn't happen) wins; otherwise a
      // booking whose night is on the calendar is added there, and an
      // unanswered one is skipped.
      const answer = Object.prototype.hasOwnProperty.call(nightChoices, b.ref) ? nightChoices[b.ref] : undefined
      if (answer === '' || (answer === undefined && item.kind === 'needs_night')) { result.skipped++; continue }
      const chosenDate = answer ?? b.eventDate
      if (!/^\d{4}-\d{2}-\d{2}$/.test(chosenDate)) { result.failed.push(`${b.ref}: invalid date`); continue }
      const chosenSlug = chosenDate === b.eventDate && item.nightSlug
        ? item.nightSlug
        : otaNightSlug(chosenDate, (nightsByDate.get(chosenDate) ?? []).map((n) => n.slug))
      if (!(nightsByDate.get(chosenDate) ?? []).some((n) => n.slug === chosenSlug)) {
        const failure = await ensureNight(chosenDate, chosenSlug)
        if (failure) { result.failed.push(`${b.ref}: couldn't add night (${failure})`); continue }
        if (created.get(`${chosenDate}|${chosenSlug}`)) result.nightsAdded++
      }
      const valid = (nightsByDate.get(chosenDate) ?? []).some((n) => n.slug === chosenSlug)
      if (!valid) { result.failed.push(`${b.ref}: no ${chosenSlug} night on ${chosenDate}`); continue }
      const { error } = await supabase.from('ota_bookings').insert({
        source: parsed.source,
        event_date: chosenDate,
        night_slug: chosenSlug,
        guest_name: b.guestName || `${LABEL[parsed.source]} ${b.ref}`,
        guest_email: b.email ?? null,
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
  if (removeIds.size) {
    const ids = Array.from(removeIds).filter((id) => removable.has(id))
    if (ids.length) {
      const { data, error } = await supabase.from('ota_bookings').delete().in('id', ids).eq('source', parsed.source).select('id')
      if (error) result.failed.push(`remove: ${error.message}`)
      else result.removed = data?.length ?? 0
    }
  }
  return NextResponse.json({ summary, result })
}
