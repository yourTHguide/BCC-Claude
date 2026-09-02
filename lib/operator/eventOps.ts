// SNX Operator OS — Event Operations (Phase 2A). Server-only reads, same
// pattern as lib/operator/queue.ts: getServiceSupabase() directly from
// Server Components, never from a 'use client' file. Every write goes
// through the EXISTING /dashboard-era API routes (see each client
// component) — this file only ports read logic and pure calculation
// functions (suggestedHostFee, revenue/profit) out of app/dashboard/page.tsx
// so the mobile surface computes them identically, not independently.
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday, addDaysISO, formatStartTime12h } from '@/lib/dates'

// Matches app/dashboard/page.tsx:8 exactly. Duplicated, not imported —
// page.tsx isn't meant to be imported as a module, and the Phase 0 audit
// already flagged this hardcoded list as free-text fragility (host_assigned
// has no FK). Not this slice's job to fix; kept here only so the mobile
// host-assignment control offers the same options the dashboard does.
export const HOSTS = ['Guide', 'Ice', 'Boom', 'JJ']

// Matches app/dashboard/page.tsx:9 exactly (DB CHECK constraint,
// supabase-schema.sql:129).
export const VERDICT_OPTIONS = [
  'Pending',
  'Pre-confirmation',
  'Operation Confirmed',
  'Cancelled / Rescheduled',
  'Completed',
  'Reviewed',
] as const

// Matches app/dashboard/page.tsx:10 — these two transitions get a
// confirmation prompt in the existing dashboard; preserved here for the
// same safety reason (accidental cancel/confirm is costly to undo in effect).
export const VERDICT_REQUIRING_CONFIRM = ['Operation Confirmed', 'Cancelled / Rescheduled']

export interface EventInstance {
  id: string
  eventDate: string
  nightSlug: string
  nightName: string
  isOpen: boolean
  hostAssigned: string | null
  operationVerdict: string
  meetUpLocation: string | null
  whatsappGroupLink: string | null
  venueRoute: { venue1?: string; venue2?: string; venue3?: string; venue4?: string; backup?: string; notes?: string }
  vanOrTaxiContact: string | null
  specialNotes: string | null
  hostPaymentStatus: string
  hostFeeFinal: number | null
  startTime: string | null
  productName: string | null
}

// Single-instance read — same columns app/dashboard/page.tsx's DayPanel
// uses (see SNX_PHASE2A_EVENT_OPS_PLAN.md §1). No API route needed: this
// runs server-side only, same as every other /operator read.
export async function getEventInstance(id: string): Promise<EventInstance | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('event_dates')
    .select(
      'id, event_date, night_slug, night_name, is_open, host_assigned, operation_verdict, meet_up_location, whatsapp_group_link, venue_route, van_or_taxi_contact, special_notes, host_payment_status, host_fee_final, start_time_override, products(default_start_time, name)'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('lib/operator/eventOps getEventInstance: query error:', error)
    return null
  }
  const e = data as any
  return {
    id: e.id,
    eventDate: e.event_date,
    nightSlug: e.night_slug,
    nightName: e.night_name,
    isOpen: e.is_open,
    hostAssigned: e.host_assigned ?? null,
    operationVerdict: e.operation_verdict,
    meetUpLocation: e.meet_up_location ?? null,
    whatsappGroupLink: e.whatsapp_group_link ?? null,
    venueRoute: e.venue_route ?? {},
    vanOrTaxiContact: e.van_or_taxi_contact ?? null,
    specialNotes: e.special_notes ?? null,
    hostPaymentStatus: e.host_payment_status,
    hostFeeFinal: e.host_fee_final ?? null,
    startTime: formatStartTime12h(e.start_time_override ?? e.products?.default_start_time ?? null),
    productName: e.products?.name ?? null,
  }
}

// Upcoming instances list for /operator/manage/events — same date-window
// convention as lib/operator/queue.ts (today forward), not a full calendar
// (that stays a link-out to /dashboard per the approved plan).
export interface InstanceListRow {
  id: string
  eventDate: string
  nightName: string
  isOpen: boolean
  operationVerdict: string
  hostAssigned: string | null
}

export async function getUpcomingInstances(): Promise<InstanceListRow[]> {
  const supabase = getServiceSupabase()
  const today = bangkokToday()
  const end = addDaysISO(today, 30)

  const { data, error } = await supabase
    .from('event_dates')
    .select('id, event_date, night_name, is_open, operation_verdict, host_assigned')
    .gte('event_date', today)
    .lte('event_date', end)
    .order('event_date', { ascending: true })
    .limit(30)

  if (error || !data) {
    if (error) console.error('lib/operator/eventOps getUpcomingInstances: query error:', error)
    return []
  }
  return data.map((e: any) => ({
    id: e.id,
    eventDate: e.event_date,
    nightName: e.night_name,
    isOpen: e.is_open,
    operationVerdict: e.operation_verdict,
    hostAssigned: e.host_assigned ?? null,
  }))
}

export interface GuestRow {
  id: string
  kind: 'bookings' | 'ota_bookings'
  guestName: string | null
  quantity: number
  totalPaid: number
  source: string
  attendanceStatus: 'expected' | 'checked_in' | 'no_show'
}

export interface ExpenseRow {
  id: string
  category: string
  description: string | null
  amount: number
  createdAt: string
}

export interface EventOpsData {
  guests: GuestRow[]
  expenses: ExpenseRow[]
  webRevenue: number
  otaRevenue: number
  totalRevenue: number
  totalExpenses: number
  profit: number
  totalGuests: number
  checkedInGuests: number
}

// Same three-table shape as app/api/admin/dashboard/day-detail/route.ts,
// read directly rather than over a fetch() round trip. Revenue/profit/
// host-fee math below is ported verbatim from app/dashboard/page.tsx so the
// mobile surface computes identical numbers, not a second implementation.
export async function getEventOpsData(eventDate: string, nightSlug: string): Promise<EventOpsData> {
  const supabase = getServiceSupabase()
  const [{ data: bookings }, { data: otaBookings }, { data: expenses }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, guest_name, quantity, total_paid, source, attendance_status')
      .eq('event_date', eventDate)
      .eq('night_slug', nightSlug)
      .eq('status', 'confirmed'),
    supabase
      .from('ota_bookings')
      .select('id, guest_name, quantity, total_paid, source, attendance_status')
      .eq('event_date', eventDate)
      .eq('night_slug', nightSlug),
    supabase
      .from('expenses')
      .select('id, category, description, amount, created_at')
      .eq('event_date', eventDate)
      .eq('night_slug', nightSlug)
      .order('created_at', { ascending: false }),
  ])

  const guests: GuestRow[] = [
    ...(bookings ?? []).map((b: any) => ({
      id: b.id, kind: 'bookings' as const, guestName: b.guest_name, quantity: b.quantity,
      totalPaid: b.total_paid ?? 0, source: b.source ?? 'website', attendanceStatus: b.attendance_status,
    })),
    ...(otaBookings ?? []).map((o: any) => ({
      id: o.id, kind: 'ota_bookings' as const, guestName: o.guest_name, quantity: o.quantity,
      totalPaid: o.total_paid ?? 0, source: o.source, attendanceStatus: o.attendance_status,
    })),
  ]

  const expenseRows: ExpenseRow[] = (expenses ?? []).map((e: any) => ({
    id: e.id, category: e.category, description: e.description, amount: e.amount, createdAt: e.created_at,
  }))

  // app/dashboard/page.tsx:491-499, ported verbatim (profit does not
  // subtract host_fee_final, matching existing production behavior).
  const webRevenue = (bookings ?? []).reduce((s: number, b: any) => s + (b.total_paid ?? 0), 0)
  const otaRevenue = (otaBookings ?? []).reduce((s: number, o: any) => s + (o.total_paid ?? 0), 0)
  const totalRevenue = webRevenue + otaRevenue
  const totalExpenses = expenseRows.reduce((s, e) => s + e.amount, 0)
  const profit = totalRevenue - totalExpenses
  const totalGuests = guests.reduce((s, g) => s + g.quantity, 0)
  const checkedInGuests = guests.filter((g) => g.attendanceStatus === 'checked_in').reduce((s, g) => s + g.quantity, 0)

  return { guests, expenses: expenseRows, webRevenue, otaRevenue, totalRevenue, totalExpenses, profit, totalGuests, checkedInGuests }
}

// app/dashboard/page.tsx:13-17, ported verbatim.
export function suggestedHostFee(showUpGuests: number): number {
  if (showUpGuests <= 5) return 1500
  return 1500 + (showUpGuests - 5) * 300
}
