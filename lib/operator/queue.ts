// SNX Operator OS data helpers (Phase 1). Server-only — these call
// getServiceSupabase() directly and must only ever be imported from Server
// Components / route handlers, never from a 'use client' file. No new tables:
// every field read here already exists in event_dates/bookings/ota_bookings
// per supabase-schema.sql (see SNX_PHASE0.5_SECURITY_REPORT.md for the RLS
// posture these tables carry — service-role-only, by design).
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday, addDaysISO, formatStartTime12h } from '@/lib/dates'
import { operatorTheme as T } from '@/lib/operator/theme'

// Shared between Home's Work In Progress preview and the full /operator/work
// list, so a reason always reads the same severity color in both places.
export const REASON_COLOR: Record<string, string> = {
  'Missing host assignment': T.statusAmber,
  'Past event still open': T.statusRed,
  'Host fee not finalized': T.statusBlue,
}

// operation_verdict values that mean an event's operational lifecycle is
// over — cancelled, or already closed out. Rows in these states are
// excluded from the queue entirely so they don't linger forever just
// because is_open/host_payment_status weren't also updated.
const NON_ACTIONABLE_VERDICTS = new Set(['Cancelled / Rescheduled', 'Completed', 'Reviewed'])

export interface TodayEvent {
  id: string
  eventDate: string
  nightName: string
  nightSlug: string
  isOpen: boolean
  startTime: string | null
  meetUpLocation: string | null
  confirmedGuests: number
  otaGuests: number
}

// Today's event_dates rows (Asia/Bangkok "today"), enriched with a guest
// count from bookings + ota_bookings. Used by Home's At a Glance / Today's
// Agenda. Mirrors the same table/filter shape as
// app/api/admin/dashboard/day-detail/route.ts, just for "today" specifically
// and read directly server-side instead of over a fetch() round trip.
export async function getTodaysEvents(): Promise<TodayEvent[]> {
  const supabase = getServiceSupabase()
  const today = bangkokToday()

  const { data, error } = await supabase
    .from('event_dates')
    .select(
      'id, event_date, night_name, night_slug, is_open, start_time_override, meet_up_location, products(default_start_time)'
    )
    .eq('event_date', today)
    .order('night_name', { ascending: true })

  if (error || !data || data.length === 0) {
    if (error) console.error('lib/operator/queue getTodaysEvents: query error:', error)
    return []
  }

  const nightSlugs = Array.from(new Set(data.map((e: any) => e.night_slug)))
  const [{ data: bookingRows }, { data: otaRows }] = await Promise.all([
    supabase
      .from('bookings')
      .select('night_slug, quantity')
      .eq('event_date', today)
      .eq('status', 'confirmed')
      .in('night_slug', nightSlugs),
    supabase.from('ota_bookings').select('night_slug, quantity').eq('event_date', today).in('night_slug', nightSlugs),
  ])

  const confirmedBySlug = new Map<string, number>()
  for (const b of bookingRows ?? []) {
    confirmedBySlug.set(b.night_slug, (confirmedBySlug.get(b.night_slug) ?? 0) + (b.quantity ?? 0))
  }
  const otaBySlug = new Map<string, number>()
  for (const o of otaRows ?? []) {
    otaBySlug.set(o.night_slug, (otaBySlug.get(o.night_slug) ?? 0) + (o.quantity ?? 0))
  }

  return data.map((e: any) => ({
    id: e.id,
    eventDate: e.event_date,
    nightName: e.night_name,
    nightSlug: e.night_slug,
    isOpen: e.is_open,
    startTime: formatStartTime12h(e.start_time_override ?? e.products?.default_start_time ?? null),
    meetUpLocation: e.meet_up_location ?? null,
    confirmedGuests: confirmedBySlug.get(e.night_slug) ?? 0,
    otaGuests: otaBySlug.get(e.night_slug) ?? 0,
  }))
}

export interface QueueItem {
  id: string
  eventDate: string
  nightName: string
  nightSlug: string
  reasons: string[]
}

// Read-only operational queue: event_dates rows in a +/-30 day window around
// today that need attention, derived purely from existing columns
// (host_assigned, is_open, host_payment_status, event_date). No new table —
// this is a filtered view, matching SNX_PHASE0_ROUTE_MAP.md's "Work" scope.
// Per Guide's 2026-09-01 decision: does NOT attempt to fix free-text
// host_assigned, only flags when it's missing.
export async function getOpenOperationalItems(): Promise<QueueItem[]> {
  const supabase = getServiceSupabase()
  const today = bangkokToday()
  const windowStart = addDaysISO(today, -30)
  const windowEnd = addDaysISO(today, 30)

  const { data, error } = await supabase
    .from('event_dates')
    .select('id, event_date, night_name, night_slug, is_open, host_assigned, host_payment_status, operation_verdict')
    .gte('event_date', windowStart)
    .lte('event_date', windowEnd)
    .order('event_date', { ascending: true })

  if (error || !data) {
    if (error) console.error('lib/operator/queue getOpenOperationalItems: query error:', error)
    return []
  }

  const items: QueueItem[] = []
  for (const e of data as any[]) {
    if (NON_ACTIONABLE_VERDICTS.has(e.operation_verdict)) continue

    const reasons: string[] = []
    const isPast = e.event_date < today
    const isTodayOrFuture = e.event_date >= today

    if (e.is_open && isTodayOrFuture && !e.host_assigned) {
      reasons.push('Missing host assignment')
    }
    if (e.is_open && isPast) {
      reasons.push('Past event still open')
    }
    if (isPast && e.host_payment_status !== 'Paid') {
      reasons.push('Host fee not finalized')
    }

    if (reasons.length > 0) {
      items.push({
        id: e.id,
        eventDate: e.event_date,
        nightName: e.night_name,
        nightSlug: e.night_slug,
        reasons,
      })
    }
  }
  return items
}
