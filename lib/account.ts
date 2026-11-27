import type { SupabaseClient } from '@supabase/supabase-js'
import { available, creditRows } from '@/lib/credit'
import { formatBookingReference } from '@/lib/bookingReference'

// What a signed-in guest sees on My account: their bookings (website and
// OTA), tickets, credit and any open "choose a refund or new date" links.
// Only bookings tied to their guest record or their email are ever read.

export interface AccountBooking {
  id: string
  source: 'website' | 'ota'
  reference: string | null
  nightName: string
  date: string
  quantity: number
  state: 'upcoming' | 'past' | 'cancelled'
  statusLabel: string
  ticketUrl: string | null
  choiceUrl: string | null
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export function bangkokToday(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

export async function accountData(db: SupabaseClient, guest: { id: string; email: string; name: string | null; phone: string | null }, now = new Date()) {
  const cols = 'id, night_name, event_date, quantity, status, booking_status, ticket_token, product_id, is_test, created_at'
  const [byId, byEmail, ota, opts, prods] = await Promise.all([
    db.from('bookings').select(cols).eq('guest_id', guest.id),
    db.from('bookings').select(cols).ilike('guest_email', likeEscape(guest.email)),
    db.from('ota_bookings').select('id, night_slug, event_date, quantity, source, booking_status').eq('guest_id', guest.id),
    db.from('booking_options').select('booking_id, token, status').eq('guest_id', guest.id),
    db.from('products').select('id, slug'),
  ])
  const slug = new Map(((prods.data ?? []) as any[]).map((p) => [p.id, p.slug]))
  const openChoice = new Map(((opts.data ?? []) as any[]).filter((o) => o.status === 'sent' || o.status === 'chosen').map((o) => [o.booking_id, o.token]))
  const anyChoice = new Map(((opts.data ?? []) as any[]).map((o) => [o.booking_id, o.token]))
  const today = bangkokToday(now)

  const seen = new Set<string>()
  const out: AccountBooking[] = []
  for (const b of [...((byId.data ?? []) as any[]), ...((byEmail.data ?? []) as any[])]) {
    if (seen.has(b.id) || b.is_test) continue
    seen.add(b.id)
    if (b.status !== 'confirmed' && b.status !== 'cancelled') continue   // unpaid checkouts
    const cancelled = b.status === 'cancelled'
    const choice = openChoice.get(b.id)
    const state: AccountBooking['state'] = cancelled ? 'cancelled' : choice || b.event_date >= today ? 'upcoming' : 'past'
    const statusLabel = cancelled ? (b.booking_status === 'refunded' ? 'Refunded' : 'Cancelled')
      : choice ? 'Action needed — night not running'
      : b.booking_status === 'attended' ? 'Attended'
      : b.booking_status === 'no_show' ? 'Missed'
      : state === 'upcoming' ? 'Confirmed' : 'Done'
    out.push({
      id: b.id, source: 'website', reference: formatBookingReference(slug.get(b.product_id) ?? null, b.id),
      nightName: b.night_name, date: b.event_date, quantity: b.quantity, state, statusLabel,
      ticketUrl: !cancelled && b.ticket_token && state === 'upcoming' && !choice ? `/ticket/${b.ticket_token}` : null,
      choiceUrl: choice ? `/my-booking/${choice}` : (anyChoice.get(b.id) && cancelled ? `/my-booking/${anyChoice.get(b.id)}` : null),
    })
  }
  for (const o of (ota.data ?? []) as any[]) {
    const cancelled = ['refunded', 'didnt_happen_refund_owed', 'cancelled'].includes(o.booking_status ?? '')
    const state: AccountBooking['state'] = cancelled ? 'cancelled' : o.event_date >= today ? 'upcoming' : 'past'
    out.push({
      id: o.id, source: 'ota', reference: null,
      nightName: `Bangkok Club Crawl (booked on ${o.source || 'a partner site'})`,
      date: o.event_date, quantity: o.quantity, state,
      statusLabel: cancelled ? 'Cancelled' : state === 'upcoming' ? 'Confirmed' : 'Done',
      ticketUrl: null, choiceUrl: null,
    })
  }
  const upcoming = out.filter((b) => b.state === 'upcoming').sort((a, b) => Number(!!b.choiceUrl) - Number(!!a.choiceUrl) || a.date.localeCompare(b.date))
  const past = out.filter((b) => b.state !== 'upcoming').sort((a, b) => b.date.localeCompare(a.date))

  const rows = await creditRows(db, guest.id)
  const live = rows.filter((c) => Date.parse(c.expires_at) > now.getTime())
  return {
    guest: { name: guest.name, email: guest.email, phone: guest.phone },
    upcoming, past,
    actionNeeded: out.filter((b) => b.choiceUrl && b.state !== 'cancelled').length,
    credit: { available: available(rows, now), expires: live.map((c) => c.expires_at.slice(0, 10)).sort()[0] ?? null },
  }
}
