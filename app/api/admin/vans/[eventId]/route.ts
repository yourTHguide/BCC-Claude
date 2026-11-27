import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { loadVanNight } from '@/lib/vanData'
import { capacityFor } from '@/lib/vans'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'

export const dynamic = 'force-dynamic'

// Owner van controls for one night (Phase 3D).
// GET: van split and status. POST { action }:
//   set_vans { count: null | 1 | 2 } → van setting; capacity follows (none = 12)
//   van2     { state: 'running' | 'closed' | 'open' } → run, close (stop sales) or reopen van 2
export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  try {
    const d = await loadVanNight(getServiceSupabase(), params.eventId)
    if (!d) return NextResponse.json({ error: 'Night not found.' }, { status: 404 })
    return NextResponse.json({ vanCount: d.event.van_count, van2State: d.event.van2_state, capacity: d.event.capacity, taken: d.taken, split: d.split, status: d.status })
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
    const count = body.count === null ? null : Number(body.count)
    if (count !== null && count !== 1 && count !== 2) return NextResponse.json({ error: 'Choose no vans, 1 van or 2 vans.' }, { status: 400 })
    const state = count === 2 ? d.event.van2_state : 'open'
    patch = { van_count: count, van2_state: state, capacity: capacityFor(count, state, d.taken) }
  } else if (body.action === 'van2') {
    if (d.event.van_count !== 2) return NextResponse.json({ error: 'This night isn’t set to 2 vans.' }, { status: 409 })
    const state = String(body.state)
    if (!['running', 'closed', 'open'].includes(state)) return NextResponse.json({ error: 'Unknown van 2 state.' }, { status: 400 })
    patch = { van2_state: state, capacity: capacityFor(2, state, d.taken) }
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }
  const { error } = await db.from('event_dates').update(patch).eq('id', d.event.id)
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  console.log(`[vans] ${auth.admin.email ?? auth.admin.userId} ${d.event.event_date}: ${JSON.stringify(patch)}`)
  return NextResponse.json({ ok: true, ...patch })
}
