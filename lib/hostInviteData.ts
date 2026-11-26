import type { SupabaseClient } from '@supabase/supabase-js'
import { bangkokNow } from '@/lib/bookingAvailability'
import { commissionFor, invitePath, type BookingLite, type InviteRow } from '@/lib/hostInvites'
import { getAppUrl } from '@/lib/appUrl'

// Invites with their night and commission, for the host's own list and the
// owner's all-hosts view. Never includes ticket prices or revenue.
export interface InviteView {
  id: string
  hostUserId: string
  hostName: string
  link: string
  guestName: string
  guestEmail: string
  guestPhone: string | null
  eventId: string
  eventDate: string | null
  nightName: string | null
  createdAt: string
  expiresAt: string
  bookingId: string | null
  state: ReturnType<typeof commissionFor>['state']
  tickets: number
  amount: number
}

export async function loadInviteViews(db: SupabaseClient, filter: { hostUserId?: string }, now = new Date()): Promise<InviteView[]> {
  let q = db.from('host_invites').select('*').order('created_at', { ascending: false }).limit(500)
  if (filter.hostUserId) q = q.eq('host_user_id', filter.hostUserId)
  const { data, error } = await q
  if (error) throw error
  const invites = (data ?? []) as InviteRow[]
  if (!invites.length) return []
  const eventIds = Array.from(new Set(invites.map((i) => i.event_id)))
  const bookingIds = invites.map((i) => i.booking_id).filter(Boolean) as string[]
  const [{ data: events, error: e1 }, bookingsRes] = await Promise.all([
    db.from('event_dates').select('id, event_date, night_name').in('id', eventIds),
    bookingIds.length
      ? db.from('bookings').select('id, event_date, quantity, status, booking_status, host_commission_paid_at').in('id', bookingIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (e1 || bookingsRes.error) throw e1 ?? bookingsRes.error
  const ev = new Map(((events ?? []) as any[]).map((e) => [e.id, e]))
  const bk = new Map(((bookingsRes.data ?? []) as BookingLite[]).map((b) => [b.id, b]))
  const today = bangkokNow(now).date
  const base = getAppUrl('bcc')
  return invites.map((i) => {
    const booking = i.booking_id ? bk.get(i.booking_id) ?? null : null
    const c = commissionFor(i, booking, today, now)
    const e = ev.get(i.event_id)
    return {
      id: i.id, hostUserId: i.host_user_id, hostName: i.host_name, link: base + invitePath(i.host_name, i.code),
      guestName: i.guest_name, guestEmail: i.guest_email, guestPhone: i.guest_phone,
      eventId: i.event_id, eventDate: booking?.event_date ?? e?.event_date ?? null, nightName: e?.night_name ?? null,
      createdAt: i.created_at, expiresAt: i.expires_at, bookingId: i.booking_id,
      state: c.state, tickets: c.tickets, amount: c.amount,
    }
  })
}

export function totals(views: InviteView[]) {
  const sum = (s: string) => views.filter((v) => v.state === s).reduce((t, v) => t + v.amount, 0)
  return { upcoming: sum('upcoming'), earned: sum('earned'), paid: sum('paid'), guests: views.filter((v) => ['upcoming', 'earned', 'paid'].includes(v.state)).reduce((t, v) => t + v.tickets, 0) }
}
