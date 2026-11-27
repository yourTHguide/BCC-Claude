import type { SupabaseClient } from '@supabase/supabase-js'
import { splitVans, vanStatus, type Party } from '@/lib/vans'

// Loads a night's parties (website + OTA) and works out the vans.
export async function loadVanNight(db: SupabaseClient, eventId: string) {
  const { data: ev, error } = await db.from('event_dates')
    .select('id, event_date, night_slug, night_name, product_id, capacity, van_count, van2_state, is_open, operation_verdict, host_assigned, host_assigned_2')
    .eq('id', eventId).maybeSingle()
  if (error) throw error
  if (!ev) return null
  const e = ev as any
  const [{ data: web, error: e1 }, { data: ota, error: e2 }] = await Promise.all([
    db.from('bookings').select('id, guest_name, quantity, created_at').eq('event_date', e.event_date).eq('night_slug', e.night_slug).eq('status', 'confirmed'),
    db.from('ota_bookings').select('id, guest_name, source, quantity, created_at, booking_status').eq('event_date', e.event_date).eq('night_slug', e.night_slug),
  ])
  if (e1 || e2) throw e1 ?? e2
  const names = new Map<string, { name: string; source: string }>()
  const parties: Party[] = [
    ...((web ?? []) as any[]).map((b) => { names.set(`bookings:${b.id}`, { name: b.guest_name || 'Guest', source: 'website' }); return { id: b.id, table: 'bookings' as const, quantity: b.quantity ?? 0, createdAt: b.created_at ?? '' } }),
    ...((ota ?? []) as any[]).filter((o) => !['refunded', 'didnt_happen_refund_owed'].includes(o.booking_status ?? ''))
      .map((o) => { names.set(`ota_bookings:${o.id}`, { name: o.guest_name || 'Guest', source: o.source }); return { id: o.id, table: 'ota_bookings' as const, quantity: o.quantity ?? 0, createdAt: o.created_at ?? '' } }),
  ]
  const vanCount = e.van_count ?? 1   // every night runs vans; no setting yet = 1 van
  const split = splitVans(parties, vanCount)
  const taken = parties.reduce((s, p) => s + p.quantity, 0)
  const label = (p: Party) => ({ ...p, ...(names.get(`${p.table}:${p.id}`) ?? { name: 'Guest', source: '' }) })
  return {
    event: e,
    taken,
    split: { van1: split.van1.map(label), van2: split.van2.map(label), over: split.over.map(label) },
    status: vanStatus(split, vanCount, e.van2_state),
  }
}
