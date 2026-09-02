// SNX Operator OS — Calendar/Instances (Phase 2B). Server-only reads, same
// pattern as lib/operator/eventOps.ts and lib/operator/queue.ts.
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday } from '@/lib/dates'

export interface CalendarInstance {
  id: string
  eventDate: string
  nightName: string
  isOpen: boolean
  operationVerdict: string
  hostAssigned: string | null
  capacity: number | null
  bookingCount: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// First/last day of a given year+month (1-12), as YYYY-MM-DD, using UTC
// date math to avoid timezone drift (same convention as addDaysISO in
// lib/dates.ts).
export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad2(month)}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate() // day 0 of next month = last day of this month
  const end = `${year}-${pad2(month)}-${pad2(lastDay)}`
  return { start, end }
}

// Today's year/month in Asia/Bangkok, for the calendar's default view.
export function bangkokTodayYearMonth(): { year: number; month: number } {
  const [y, m] = bangkokToday().split('-').map(Number)
  return { year: y, month: m }
}

// capacity is explicitly NOT a hard booking limit anywhere in production —
// checkout enforces only a flat 24-ticket-per-order UX safeguard, and
// app/book/BookingCalendarClient.tsx's own comment states real capacity
// enforcement is "out of scope" and event.capacity "is intentionally not
// used to drive purchase quantity." So this is an operational/planning
// signal only — "At capacity", never "Sold Out" (verified 2026-09-02
// before building this, see SNX_PHASE2B_CALENDAR_INSTANCES_PLAN.md).
export function isAtCapacity(capacity: number | null, bookingCount: number): boolean {
  return capacity != null && bookingCount >= capacity
}

// One query for the month's event_dates rows, one batched pair of queries
// for booking counts across every (event_date, night_slug) in that range —
// same aggregation shape app/api/admin/products/[id]/events/route.ts
// already does per-product, generalized here across a date range instead.
export async function getMonthInstances(year: number, month: number): Promise<CalendarInstance[]> {
  const supabase = getServiceSupabase()
  const { start, end } = monthRange(year, month)

  const { data, error } = await supabase
    .from('event_dates')
    .select('id, event_date, night_slug, night_name, is_open, operation_verdict, host_assigned, capacity')
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date', { ascending: true })

  if (error || !data || data.length === 0) {
    if (error) console.error('lib/operator/calendar getMonthInstances: query error:', error)
    return []
  }

  const [{ data: bookingRows }, { data: otaRows }] = await Promise.all([
    supabase.from('bookings').select('event_date, night_slug, quantity').eq('status', 'confirmed').gte('event_date', start).lte('event_date', end),
    supabase.from('ota_bookings').select('event_date, night_slug, quantity').gte('event_date', start).lte('event_date', end),
  ])

  const countByKey = new Map<string, number>()
  for (const b of [...(bookingRows ?? []), ...(otaRows ?? [])]) {
    const key = `${b.event_date}::${b.night_slug}`
    countByKey.set(key, (countByKey.get(key) ?? 0) + (b.quantity ?? 0))
  }

  return data.map((e: any) => ({
    id: e.id,
    eventDate: e.event_date,
    nightName: e.night_name,
    isOpen: e.is_open,
    operationVerdict: e.operation_verdict,
    hostAssigned: e.host_assigned ?? null,
    capacity: e.capacity ?? null,
    bookingCount: countByKey.get(`${e.event_date}::${e.night_slug}`) ?? 0,
  }))
}
