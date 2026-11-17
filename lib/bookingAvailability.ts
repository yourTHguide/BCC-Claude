import type { SupabaseClient } from '@supabase/supabase-js'

// Booking availability rules shared by the calendar feed (/api/events) and
// checkout (/api/create-checkout), so what guests can see and what they can
// pay for are always decided by the same code (BCC Phase 2, Nov 2026).
//
// 1. Cancelled nights never take bookings — even if the dashboard left the
//    date "open". Marking a night "Cancelled / Rescheduled" in the dashboard
//    only records the verdict; it doesn't flip is_open, so this closes it.
// 2. Bangkok Club Crawl: bookings stay open on the night itself until the
//    9:30 PM start (the event's effective start time), then close. Other
//    products keep their existing date-only cutoff (BCC-only scope).
// 3. Capacity: when a date has a capacity set in the dashboard, seats already
//    taken (confirmed direct bookings + OTA bookings, the same count the dashboard
//    shows) are subtracted and the night closes when full. No capacity set =
//    no limit, exactly as before. Capacity is NEVER raised automatically.

export const BCC_PRODUCT_SLUG = 'bangkok-club-crawl'

const CANCELLED_VERDICTS = new Set(['Cancelled / Rescheduled'])

// Keyed on operation_verdict only: night_status ("didn't run") is recorded
// after the fact for past nights (already closed by the date cutoff), and it
// doesn't exist in every database (the Preview DB predates it).
export function isCancelledEvent(row: { operation_verdict?: string | null }): boolean {
  return !!row.operation_verdict && CANCELLED_VERDICTS.has(row.operation_verdict)
}

// Current date (YYYY-MM-DD) and time (HH:MM:SS) in Asia/Bangkok.
export function bangkokNow(now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` }
}

function normalizeTime(t: string): string {
  const [h = '00', m = '00', s = '00'] = t.split(':')
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`
}

// Has booking closed for this event because it is in the past / already
// started? BCC closes at its start time on the night; everything else keeps
// the existing rule (bookable through the end of the event date).
export function isPastBookingCutoff(
  eventDate: string,
  startTime: string | null | undefined,
  productSlug: string | null | undefined,
  now: Date = new Date()
): boolean {
  const { date, time } = bangkokNow(now)
  if (eventDate < date) return true
  if (eventDate > date) return false
  if (productSlug !== BCC_PRODUCT_SLUG || !startTime) return false
  return time >= normalizeTime(startTime)
}

interface SeatKey {
  event_date: string
  night_slug: string
}

// Seats already taken per (event_date, night_slug): confirmed direct
// bookings + OTA bookings — exactly the dashboard's guest count
// (lib/operator/queue.ts). Uses only long-standing columns so it works on
// every database (Preview's schema predates newer status columns). Only
// called for events that have a capacity.
export async function seatsTaken(supabase: SupabaseClient, keys: SeatKey[]): Promise<Map<string, number>> {
  const taken = new Map<string, number>()
  if (keys.length === 0) return taken
  const dates = Array.from(new Set(keys.map((k) => k.event_date)))
  const slugs = Array.from(new Set(keys.map((k) => k.night_slug)))
  const [{ data: direct, error: e1 }, { data: ota, error: e2 }] = await Promise.all([
    supabase.from('bookings').select('event_date, night_slug, quantity')
      .in('event_date', dates).in('night_slug', slugs).eq('status', 'confirmed'),
    supabase.from('ota_bookings').select('event_date, night_slug, quantity')
      .in('event_date', dates).in('night_slug', slugs),
  ])
  if (e1 || e2) throw e1 ?? e2
  const add = (k: string, q: number | null) => taken.set(k, (taken.get(k) ?? 0) + (q ?? 0))
  for (const b of direct ?? []) add(`${b.event_date}|${b.night_slug}`, b.quantity)
  for (const o of ota ?? []) add(`${o.event_date}|${o.night_slug}`, o.quantity)
  return taken
}

export function seatKey(k: SeatKey): string {
  return `${k.event_date}|${k.night_slug}`
}
