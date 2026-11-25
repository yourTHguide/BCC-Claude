import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BCC_PRODUCT_SLUG,
  classifyInstance,
  isFriOrSat,
  seatKey,
  seatsTaken,
  type InstanceState,
} from '@/lib/bookingAvailability'

// Server-side loader for Bangkok Club Crawl event instances with their live
// state (Phase 3B). Uses the same columns and rules as /api/events and
// create-checkout; never writes anything.

export interface BccInstance {
  id: string
  eventDate: string
  nightSlug: string
  nightName: string
  startTime: string | null
  priceThb: number | null
  capacity: number | null
  taken: number
  remaining: number | null
  state: InstanceState
  friSat: boolean
  waitlistEligible: boolean // genuinely full Club Crawl night (any day)
}

const SELECT =
  'id, event_date, night_slug, night_name, is_open, price_override, start_time_override, capacity, operation_verdict, ' +
  'products!inner ( id, slug, status, default_price, default_start_time, visible_bcc )'

function toInstance(row: any, taken: Map<string, number>, now: Date): BccInstance {
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  const startTime = row.start_time_override ?? product?.default_start_time ?? null
  const price = row.price_override ?? product?.default_price ?? null
  const t = taken.get(seatKey(row)) ?? 0
  const { state, remaining } = classifyInstance(
    {
      eventDate: row.event_date,
      isOpen: row.is_open,
      operationVerdict: row.operation_verdict,
      capacity: row.capacity,
      taken: t,
      productSlug: product?.slug ?? null,
      productStatus: product?.status ?? null,
      visible: product?.visible_bcc ?? null,
      startTime,
      price,
    },
    now
  )
  const friSat = isFriOrSat(row.event_date)
  return {
    id: row.id,
    eventDate: row.event_date,
    nightSlug: row.night_slug,
    nightName: row.night_name,
    startTime,
    priceThb: price,
    capacity: row.capacity ?? null,
    taken: t,
    remaining,
    state,
    friSat,
    waitlistEligible: state === 'sold_out',
  }
}

async function load(supabase: SupabaseClient, filter: (q: any) => any, now: Date): Promise<BccInstance[]> {
  const { data, error } = await filter(
    supabase.from('event_dates').select(SELECT).eq('products.slug', BCC_PRODUCT_SLUG)
  )
  if (error) throw error
  const rows = (data ?? []) as any[]
  const capped = rows.filter((r) => r.capacity != null)
  const taken = capped.length ? await seatsTaken(supabase, capped) : new Map<string, number>()
  return rows.map((r) => toInstance(r, taken, now))
}

export async function loadBccInstance(supabase: SupabaseClient, eventId: string, now = new Date()): Promise<BccInstance | null> {
  const list = await load(supabase, (q) => q.eq('id', eventId).limit(1), now)
  return list[0] ?? null
}

export async function loadBccInstancesOn(supabase: SupabaseClient, eventDate: string, now = new Date()): Promise<BccInstance[]> {
  return load(supabase, (q) => q.eq('event_date', eventDate), now)
}

export async function loadBccInstancesByIds(supabase: SupabaseClient, ids: string[], now = new Date()): Promise<BccInstance[]> {
  if (!ids.length) return []
  return load(supabase, (q) => q.in('id', ids), now)
}

// Public wording for each state, so the guest is told why a date can't be
// booked instead of seeing it silently disappear.
export const STATE_MESSAGE: Record<InstanceState, string> = {
  bookable: 'Seats are available for this night.',
  sold_out: 'This night is sold out.',
  cancelled: 'This night has been cancelled.',
  unpublished: 'This night is not available for booking.',
  closed: 'Booking is closed for this night.',
  cutoff: 'Booking for tonight has closed — the night has started.',
  past: 'This date has passed.',
  no_price: 'This night is not available for booking yet.',
}

// Public sign-up switch. On in Preview and local dev; in production only when
// BCC_SOLDOUT_WAITLIST=on (set after the Bangkok Club Crawl privacy notice
// covers the waitlist — see docs/BCC_PHASE3B_WAITLIST.md). When off, sold-out
// nights still show as sold out with the next-night offer; only the waitlist
// form is hidden and the sign-up endpoint refuses. Unsubscribe and the admin
// tools always work.
export function soldOutWaitlistEnabled(): boolean {
  if (process.env.BCC_SOLDOUT_WAITLIST === 'on') return true
  if (process.env.BCC_SOLDOUT_WAITLIST === 'off') return false
  return process.env.VERCEL_ENV !== 'production'
}

// "Keep me updated" box on the waitlist form. Same pattern as the waitlist
// switch: on in Preview and local dev; in production only when
// BCC_UPDATES_OPTIN=on (after the privacy notice covers this list).
export function bccUpdatesOptInEnabled(): boolean {
  if (process.env.BCC_UPDATES_OPTIN === 'on') return true
  if (process.env.BCC_UPDATES_OPTIN === 'off') return false
  return process.env.VERCEL_ENV !== 'production'
}
