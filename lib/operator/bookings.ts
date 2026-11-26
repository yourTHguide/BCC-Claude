// SNX Operator — Bookings (Manage). Server-only loader: website + OTA
// bookings for a date window, filtered and grouped by event, plus the
// upcoming events a booking can be moved to. Writes go through
// lib/bookingActions.ts via the API routes.
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday, addDaysISO } from '@/lib/dates'

export type Period = 'upcoming' | 'this-week' | 'next-week' | 'this-month' | 'next-month' | 'last-30' | 'custom'
export type StatusFilter = 'active' | 'cancelled' | 'refund-pending' | 'refunded' | 'all'

export const PERIOD_LABEL: Record<Period, string> = {
  upcoming: 'Upcoming (next 90 days)',
  'this-week': 'This week',
  'next-week': 'Next week',
  'this-month': 'This month',
  'next-month': 'Next month',
  'last-30': 'Past 30 days',
  custom: 'Custom dates',
}

export const OTA_SOURCE_LABEL: Record<string, string> = {
  website: 'Website', klook: 'Klook', airbnb: 'Airbnb', gyg: 'GetYourGuide', viator: 'Viator',
  manual: 'Manual', direct: 'Direct', bokun: 'Bókun', eventbrite: 'Eventbrite',
}

export interface BookingFilters {
  period: Period
  from?: string
  to?: string
  event?: string
  product?: string
  source?: string
  status: StatusFilter
  q?: string
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

export function parseFilters(sp: Record<string, string | string[] | undefined>): BookingFilters {
  const period = (one(sp.period) ?? 'upcoming') as Period
  const status = (one(sp.status) ?? 'active') as StatusFilter
  return {
    period: period in PERIOD_LABEL ? period : 'upcoming',
    from: ISO.test(one(sp.from) ?? '') ? one(sp.from) : undefined,
    to: ISO.test(one(sp.to) ?? '') ? one(sp.to) : undefined,
    event: one(sp.event),
    product: one(sp.product),
    source: one(sp.source),
    status: ['active', 'cancelled', 'refund-pending', 'refunded', 'all'].includes(status) ? status : 'active',
    q: one(sp.q)?.trim() || undefined,
  }
}

// Inclusive [from, to] window for a period. Weeks run Monday–Sunday.
export function periodRange(f: Pick<BookingFilters, 'period' | 'from' | 'to'>, today = bangkokToday()): { from: string; to: string } {
  const [y, m, d] = today.split('-').map(Number)
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 // Mon = 0
  const monday = addDaysISO(today, -dow)
  const monthStart = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`
  const monthEnd = (yy: number, mm: number) => addDaysISO(mm === 12 ? monthStart(yy + 1, 1) : monthStart(yy, mm + 1), -1)
  switch (f.period) {
    case 'this-week': return { from: monday, to: addDaysISO(monday, 6) }
    case 'next-week': return { from: addDaysISO(monday, 7), to: addDaysISO(monday, 13) }
    case 'this-month': return { from: monthStart(y, m), to: monthEnd(y, m) }
    case 'next-month': return m === 12 ? { from: monthStart(y + 1, 1), to: monthEnd(y + 1, 1) } : { from: monthStart(y, m + 1), to: monthEnd(y, m + 1) }
    case 'last-30': return { from: addDaysISO(today, -30), to: addDaysISO(today, -1) }
    case 'custom': {
      const from = f.from ?? today
      const to = f.to && f.to >= from ? f.to : addDaysISO(from, 30)
      return { from, to }
    }
    default: return { from: today, to: addDaysISO(today, 90) }
  }
}

export interface BookingRow {
  kind: 'website' | 'ota'
  id: string
  eventKey: string
  eventId: string | null
  eventDate: string
  nightSlug: string
  nightName: string
  productId: string | null
  productName: string | null
  guestName: string
  attendees: string[]
  email: string | null
  whatsapp: string | null
  quantity: number
  totalPaid: number
  sourceLabel: string
  source: string
  status: string
  bookingStatus: string | null
  attendance: string | null
  paymentMethod: string | null
  hasStripePayment: boolean
  bookedForDate: string | null
  bookingRef: string | null
  notes: string | null
  createdAt: string
}

export interface EventGroup {
  key: string
  eventId: string | null
  eventDate: string
  nightName: string
  productName: string | null
  capacity: number | null
  guests: number
  rows: BookingRow[]
}

export interface MoveTarget {
  id: string
  eventDate: string
  nightName: string
  productId: string | null
  capacity: number | null
  remaining: number | null
  isOpen: boolean
}

export interface BookingsPageData {
  range: { from: string; to: string }
  groups: EventGroup[]
  total: { bookings: number; guests: number }
  events: { id: string; label: string }[]
  products: { id: string; name: string }[]
  sources: { value: string; label: string }[]
  targets: MoveTarget[]
  error: string | null
}

function rowStatus(r: BookingRow): Exclude<StatusFilter, 'all'> {
  if (r.kind === 'website') {
    if (r.status === 'cancelled') return r.bookingStatus === 'refunded' ? 'refunded' : 'refund-pending'
    return 'active'
  }
  if (r.bookingStatus === 'refunded') return 'refunded'
  if (r.bookingStatus === 'didnt_happen_refund_owed') return 'refund-pending'
  return 'active'
}

// "Cancelled" filter = cancelled website bookings (refunded or not).
function matchesStatus(r: BookingRow, s: StatusFilter): boolean {
  if (s === 'all') return true
  const rs = rowStatus(r)
  if (s === 'cancelled') return r.kind === 'website' && r.status === 'cancelled'
  return rs === s
}

export async function loadBookingsPage(f: BookingFilters): Promise<BookingsPageData> {
  const supabase = getServiceSupabase()
  const range = periodRange(f)
  const today = bangkokToday()

  const [evRes, bRes, oRes, pRes, upRes] = await Promise.all([
    supabase.from('event_dates').select('id, event_date, night_slug, night_name, product_id, capacity').gte('event_date', range.from).lte('event_date', range.to).order('event_date', { ascending: true }),
    supabase
      .from('bookings')
      .select('id, event_id, event_date, night_slug, night_name, product_id, guest_name, guest_email, guest_whatsapp, guest_phone, quantity, total_paid, status, booking_status, attendance_status, payment_method, source, stripe_payment_id, booked_for_date, notes, created_at, is_test, booking_attendees(full_name, position)')
      .gte('event_date', range.from).lte('event_date', range.to)
      .order('event_date', { ascending: true })
      .limit(1000),
    supabase
      .from('ota_bookings')
      .select('id, event_date, night_slug, source, guest_name, guest_email, quantity, total_paid, booking_status, attendance_status, booked_for_date, booking_ref, notes, created_at')
      .gte('event_date', range.from).lte('event_date', range.to)
      .order('event_date', { ascending: true })
      .limit(1000),
    supabase.from('products').select('id, name, status').order('name', { ascending: true }),
    supabase.from('event_dates').select('id, event_date, night_slug, night_name, product_id, capacity, is_open').gte('event_date', today).lte('event_date', addDaysISO(today, 180)).order('event_date', { ascending: true }),
  ])

  const error = evRes.error || bRes.error || oRes.error || pRes.error || upRes.error
  if (error) console.error('lib/operator/bookings load error:', error)

  const productName = new Map<string, string>((pRes.data ?? []).map((p: any) => [p.id, p.name]))
  const events = (evRes.data ?? []) as any[]
  const eventById = new Map(events.map((e) => [e.id, e]))
  const eventBySlot = new Map(events.map((e) => [`${e.event_date}|${e.night_slug}`, e]))

  const rows: BookingRow[] = []
  for (const b of (bRes.data ?? []) as any[]) {
    if (b.is_test) continue
    const ev = (b.event_id && eventById.get(b.event_id)) || eventBySlot.get(`${b.event_date}|${b.night_slug}`)
    const pid = b.product_id ?? ev?.product_id ?? null
    rows.push({
      kind: 'website', id: b.id,
      eventKey: ev?.id ?? `${b.event_date}|${b.night_slug}`, eventId: ev?.id ?? b.event_id ?? null,
      eventDate: b.event_date, nightSlug: b.night_slug, nightName: b.night_name ?? ev?.night_name ?? b.night_slug,
      productId: pid, productName: pid ? productName.get(pid) ?? null : null,
      guestName: b.guest_name || 'Guest',
      attendees: [...(b.booking_attendees ?? [])].sort((x: any, y: any) => (x.position ?? 0) - (y.position ?? 0)).map((a: any) => a.full_name).filter(Boolean),
      email: b.guest_email ?? null, whatsapp: b.guest_whatsapp ?? b.guest_phone ?? null,
      quantity: b.quantity ?? 1, totalPaid: b.total_paid ?? 0,
      source: 'website', sourceLabel: 'Website',
      status: b.status, bookingStatus: b.booking_status ?? null, attendance: b.attendance_status ?? null,
      paymentMethod: b.payment_method ?? null, hasStripePayment: !!b.stripe_payment_id,
      bookedForDate: b.booked_for_date ?? null, bookingRef: null, notes: b.notes ?? null, createdAt: b.created_at,
    })
  }
  for (const o of (oRes.data ?? []) as any[]) {
    const ev = eventBySlot.get(`${o.event_date}|${o.night_slug}`)
    const pid = ev?.product_id ?? null
    rows.push({
      kind: 'ota', id: o.id,
      eventKey: ev?.id ?? `${o.event_date}|${o.night_slug}`, eventId: ev?.id ?? null,
      eventDate: o.event_date, nightSlug: o.night_slug, nightName: ev?.night_name ?? o.night_slug,
      productId: pid, productName: pid ? productName.get(pid) ?? null : null,
      guestName: o.guest_name || 'Guest', attendees: [],
      email: o.guest_email ?? null, whatsapp: null,
      quantity: o.quantity ?? 1, totalPaid: o.total_paid ?? 0,
      source: o.source, sourceLabel: OTA_SOURCE_LABEL[o.source] ?? o.source,
      status: 'confirmed', bookingStatus: o.booking_status ?? null, attendance: o.attendance_status ?? null,
      paymentMethod: null, hasStripePayment: false,
      bookedForDate: o.booked_for_date ?? null, bookingRef: o.booking_ref ?? null, notes: o.notes ?? null, createdAt: o.created_at,
    })
  }

  const sourcesPresent = Array.from(new Set(rows.map((r) => r.source)))
  const q = f.q?.toLowerCase()
  const filtered = rows.filter((r) =>
    (!f.event || r.eventKey === f.event) &&
    (!f.product || r.productId === f.product) &&
    (!f.source || r.source === f.source) &&
    matchesStatus(r, f.status) &&
    (!q || [r.guestName, r.email, r.whatsapp, r.bookingRef, ...r.attendees].some((v) => v?.toLowerCase().includes(q)))
  )

  const groupsMap = new Map<string, EventGroup>()
  for (const r of filtered) {
    let g = groupsMap.get(r.eventKey)
    if (!g) {
      const ev = r.eventId ? eventById.get(r.eventId) : null
      g = { key: r.eventKey, eventId: r.eventId, eventDate: r.eventDate, nightName: r.nightName, productName: r.productName, capacity: ev?.capacity ?? null, guests: 0, rows: [] }
      groupsMap.set(r.eventKey, g)
    }
    g.rows.push(r)
    if (rowStatus(r) === 'active') g.guests += r.quantity
  }
  const groups = Array.from(groupsMap.values()).sort((a, b) => (a.eventDate < b.eventDate ? -1 : a.eventDate > b.eventDate ? 1 : a.nightName.localeCompare(b.nightName)))
  for (const g of groups) g.rows.sort((a, b) => a.guestName.localeCompare(b.guestName))
  if (f.period === 'last-30') groups.reverse()

  // Seats taken on upcoming events (website confirmed + counted OTA).
  const up = (upRes.data ?? []) as any[]
  const upIds = up.map((e) => e.id)
  const taken = new Map<string, number>()
  if (upIds.length) {
    const [{ data: web }, { data: ota }] = await Promise.all([
      supabase.from('bookings').select('event_id, quantity').eq('status', 'confirmed').in('event_id', upIds),
      supabase.from('ota_bookings').select('event_date, night_slug, quantity, booking_status').gte('event_date', today),
    ])
    for (const b of (web ?? []) as any[]) taken.set(b.event_id, (taken.get(b.event_id) ?? 0) + (b.quantity ?? 1))
    const slot = new Map(up.map((e) => [`${e.event_date}|${e.night_slug}`, e.id]))
    for (const o of (ota ?? []) as any[]) {
      if (['refunded', 'didnt_happen_refund_owed'].includes(o.booking_status ?? '')) continue
      const id = slot.get(`${o.event_date}|${o.night_slug}`)
      if (id) taken.set(id, (taken.get(id) ?? 0) + (o.quantity ?? 1))
    }
  }

  return {
    range,
    groups,
    total: { bookings: filtered.length, guests: groups.reduce((s, g) => s + g.guests, 0) },
    events: events.map((e) => ({ id: e.id, label: `${e.event_date} · ${e.night_name}` })),
    products: (pRes.data ?? []).filter((p: any) => p.status !== 'archived').map((p: any) => ({ id: p.id, name: p.name })),
    sources: sourcesPresent.sort().map((s) => ({ value: s, label: OTA_SOURCE_LABEL[s] ?? s })),
    targets: up.map((e) => ({
      id: e.id, eventDate: e.event_date, nightName: e.night_name, productId: e.product_id ?? null,
      capacity: e.capacity ?? null, remaining: e.capacity == null ? null : Math.max(e.capacity - (taken.get(e.id) ?? 0), 0), isOpen: !!e.is_open,
    })),
    error: error ? 'Failed to load some bookings.' : null,
  }
}
