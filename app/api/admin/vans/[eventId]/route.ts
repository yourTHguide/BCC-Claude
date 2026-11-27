import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { loadVanNight } from '@/lib/vanData'
import { capacityFor } from '@/lib/vans'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { optionLink, resolveOption, sendOptions } from '@/lib/bookingOptions'

export const dynamic = 'force-dynamic'

// Owner van controls for one night (Phase 3D).
// GET: van split and status. POST { action }:
//   set_vans { count: 1 | 2 } → van setting; capacity follows (10 / 20)
//   set_host2 { name }         → the Van 2 host (null to clear)
//   van2     { state: 'running' | 'closed' | 'open' } → run, close (stop sales) or reopen van 2
//   send_options { reason: 'night_short' | 'van2_short' } → email website guests their choice link
//   resolve  { optionId, resolution: 'refunded' | 'moved' | 'credited', targetEventId? } → approve
export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  try {
    const d = await loadVanNight(getServiceSupabase(), params.eventId)
    if (!d) return NextResponse.json({ error: 'Night not found.' }, { status: 404 })
    const db = getServiceSupabase()
    const { data: opts } = await db.from('booking_options').select('id, booking_id, token, reason, sent_at, reminder_sent_at, choice, preferred_event_id, preferred_date, preference_note, chosen_at, status, resolution, resolved_at').eq('event_id', d.event.id).order('sent_at', { ascending: true })
    const options = (opts ?? []) as any[]
    const bIds = options.map((o) => o.booking_id)
    const evIds = options.map((o) => o.preferred_event_id).filter(Boolean)
    const [{ data: bks }, { data: evs }] = await Promise.all([
      bIds.length ? db.from('bookings').select('id, guest_name, guest_phone, guest_whatsapp, quantity, total_paid').in('id', bIds) : Promise.resolve({ data: [] }),
      evIds.length ? db.from('event_dates').select('id, event_date, night_name').in('id', evIds) : Promise.resolve({ data: [] }),
    ])
    const bk = new Map(((bks ?? []) as any[]).map((b) => [b.id, b]))
    const optIds = options.map((o) => o.id)
    const { data: crs } = optIds.length ? await db.from('guest_credits').select('id, option_id, amount, used_amount, status').in('option_id', optIds) : { data: [] }
    const creditByOpt = new Map(((crs ?? []) as any[]).map((c) => [c.option_id, c]))
    const ev = new Map(((evs ?? []) as any[]).map((e) => [e.id, e]))
    return NextResponse.json({
      vanCount: d.event.van_count ?? 1, host: d.event.host_assigned, host2: d.event.host_assigned_2, van2State: d.event.van2_state, capacity: d.event.capacity, taken: d.taken, split: d.split, status: d.status,
      // The guest's personal link (owner only), to send on WhatsApp or copy.
      options: options.map(({ token, ...o }) => ({ ...o, credit: creditByOpt.get(o.id) ?? null, link: optionLink(token), phone: bk.get(o.booking_id)?.guest_whatsapp || bk.get(o.booking_id)?.guest_phone || null, guestName: bk.get(o.booking_id)?.guest_name ?? 'Guest', quantity: bk.get(o.booking_id)?.quantity ?? 1, totalPaid: bk.get(o.booking_id)?.total_paid ?? 0, preferred: o.preferred_event_id ? ev.get(o.preferred_event_id) ?? null : null })),
    })
  } catch (err) {
    console.error('vans GET error', err)
    return NextResponse.json({ error: 'Could not load the vans.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const db = getServiceSupabase()
  const body = await req.json().catch(() => ({}))
  const d = await loadVanNight(db, params.eventId).catch(() => null)
  if (!d) return NextResponse.json({ error: 'Night not found.' }, { status: 404 })
  const { data: prod } = await db.from('products').select('slug').eq('id', d.event.product_id).maybeSingle()
  if ((prod as any)?.slug !== BCC_PRODUCT_SLUG) return NextResponse.json({ error: 'Vans are only for Club Crawl nights.' }, { status: 409 })
  let patch: Record<string, unknown>
  if (body.action === 'set_vans') {
    const count = Number(body.count)
    if (count !== 1 && count !== 2) return NextResponse.json({ error: 'Choose 1 van or 2 vans.' }, { status: 400 })
    const state = count === 2 ? d.event.van2_state : 'open'
    patch = { van_count: count, van2_state: state, capacity: capacityFor(count, state, d.taken) }
  } else if (body.action === 'set_host2') {
    const name = body.name ? String(body.name).trim().slice(0, 60) : null
    if (name && name === d.event.host_assigned) return NextResponse.json({ error: 'That’s already the main host.' }, { status: 400 })
    patch = { host_assigned_2: name }
  } else if (body.action === 'van2') {
    if (d.event.van_count !== 2) return NextResponse.json({ error: 'This night isn’t set to 2 vans.' }, { status: 409 })
    const state = String(body.state)
    if (!['running', 'closed', 'open'].includes(state)) return NextResponse.json({ error: 'Unknown van 2 state.' }, { status: 400 })
    patch = { van2_state: state, capacity: capacityFor(2, state, d.taken) }
  } else if (body.action === 'send_options') {
    const reason = body.reason === 'van2_short' ? 'van2_short' : body.reason === 'night_short' ? 'night_short' : null
    if (!reason) return NextResponse.json({ error: 'Choose whole night or van 2.' }, { status: 400 })
    if (reason === 'van2_short' && d.event.van_count !== 2) return NextResponse.json({ error: 'This night isn’t set to 2 vans.' }, { status: 409 })
    try {
      const r = await sendOptions(db, d.event.id, reason)
      // Van 2 not running: stop its sales too.
      if (reason === 'van2_short' && d.event.van2_state !== 'closed') await db.from('event_dates').update({ van2_state: 'closed', capacity: capacityFor(2, 'closed', d.taken) }).eq('id', d.event.id)
      console.log(`[vans] ${auth.admin.email ?? auth.admin.userId} sent ${reason} options for ${d.event.event_date} to ${r.sent.length}`)
      return NextResponse.json({ ok: true, ...r })
    } catch (err) {
      console.error('send options error', err)
      return NextResponse.json({ error: 'Could not send the options. Try again — guests already emailed are skipped.' }, { status: 500 })
    }
  } else if (body.action === 'resolve') {
    const resolution = String(body.resolution)
    if (!['refunded', 'moved', 'credited'].includes(resolution)) return NextResponse.json({ error: 'Unknown resolution.' }, { status: 400 })
    const r = await resolveOption(db, String(body.optionId ?? ''), { resolution: resolution as any, targetEventId: body.targetEventId ? String(body.targetEventId) : null, by: auth.admin.email ?? auth.admin.userId })
    return NextResponse.json(r.status === 200 ? { ok: true } : { error: r.error }, { status: r.status })
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }
  const { error } = await db.from('event_dates').update(patch).eq('id', d.event.id)
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  console.log(`[vans] ${auth.admin.email ?? auth.admin.userId} ${d.event.event_date}: ${JSON.stringify(patch)}`)
  return NextResponse.json({ ok: true, ...patch })
}
