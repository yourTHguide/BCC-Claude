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

// ─── Phase 3B: one place that names WHY a date is or isn't bookable ───────
// /api/events and checkout keep their own (unchanged) gates; this mirrors
// them exactly so the sold-out waitlist can tell a genuinely full night
// apart from one that is cancelled, unpublished, closed, past its cutoff or
// mispriced. Only 'sold_out' may ever offer a waitlist.
export type InstanceState =
  | 'bookable'
  | 'sold_out' // open, published, priced, before cutoff, capacity > 0 and every seat taken
  | 'cancelled'
  | 'unpublished' // product not active, or not visible on this storefront
  | 'closed' // is_open = false, or capacity 0 (closed by the team, not sold out)
  | 'cutoff' // tonight, past the start time
  | 'past'
  | 'no_price'

export interface InstanceFacts {
  eventDate: string
  isOpen: boolean | null
  operationVerdict?: string | null
  capacity: number | null
  taken: number
  productSlug: string | null
  productStatus: string | null
  visible: boolean | null
  startTime: string | null
  price: number | null
}

export function classifyInstance(f: InstanceFacts, now: Date = new Date()): { state: InstanceState; remaining: number | null } {
  const remaining = f.capacity != null ? Math.max(0, f.capacity - f.taken) : null
  const out = (state: InstanceState) => ({ state, remaining })
  if (f.eventDate < bangkokNow(now).date) return out('past')
  if (f.productStatus !== 'active' || f.visible !== true) return out('unpublished')
  if (isCancelledEvent({ operation_verdict: f.operationVerdict })) return out('cancelled')
  if (f.isOpen !== true) return out('closed')
  if (isPastBookingCutoff(f.eventDate, f.startTime, f.productSlug, now)) return out('cutoff')
  if (!Number.isInteger(f.price) || (f.price as number) <= 0) return out('no_price')
  if (f.capacity != null && remaining === 0) {
    return out(f.capacity > 0 && f.taken >= f.capacity ? 'sold_out' : 'closed')
  }
  return out('bookable')
}

// Friday or Saturday, from the YYYY-MM-DD calendar date (no timezone shift).
export function isFriOrSat(eventDate: string): boolean {
  const [y, m, d] = eventDate.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 5 || dow === 6
}

// The only dates the sold-out waitlist accepts: a Bangkok Club Crawl night
// that is genuinely full right now, on any day of the week (owner decision,
// 25 Nov 2026: weekday and special nights too). isFriOrSat is kept for
// display and reporting only.
export function isWaitlistEligible(f: InstanceFacts, now: Date = new Date()): boolean {
  return f.productSlug === BCC_PRODUCT_SLUG && classifyInstance(f, now).state === 'sold_out'
}
