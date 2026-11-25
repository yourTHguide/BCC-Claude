// Bangkok Club Crawl sold-out recovery (Phase 3B, Nov 2026).
//
// Pure helpers shared by the /book calendar (client), the sign-up route and
// the admin reopen notice. No server imports, so the browser shows exactly
// the consent wording the server stores.
//
// Audience rule: a sold-out sign-up is consent to ONE email about seats
// reopening for ONE event instance (consent_scope 'sold_out_date', keyed by
// event_date_id). It is never used for another date, another product, the
// New in Bangkok list ('event_dates' scope) or general marketing.

export const SOLD_OUT_SCOPE = 'sold_out_date'
export const SOLD_OUT_SOURCE = 'bcc_book_sold_out'
export const MAX_PARTY_SIZE = 24 // same per-order cap as create-checkout
export const MAX_ACTIVE_SIGNUPS_PER_EMAIL = 3 // spam control: upcoming dates per address
export const MIN_FILL_MS = 2500 // spam control: faster than this is a bot

// "Saturday 28 November 2026" from YYYY-MM-DD. Built by hand (not Intl) so
// the browser and the server produce byte-identical consent wording.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export function longEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DAYS[dow]} ${d} ${MONTHS[m - 1]} ${y}`
}

// Stored verbatim on the row (consent_text) next to consented_at.
export function soldOutConsentText(nightName: string, eventDate: string): string {
  return (
    `Email me once if seats open up for ${nightName} on ${longEventDate(eventDate)}. ` +
    'Joining the waitlist does not reserve a seat or guarantee entry; reopened seats go to whoever books first at the normal price. ' +
    'This list is used for this date only. I can unsubscribe any time.'
  )
}

export interface BookableNight {
  eventId: string
  eventDate: string
  productSlug: string | null
  remaining?: number | null
}

// Primary recovery offer: the next genuinely bookable Club Crawl night after
// the sold-out date that fits the party (seats left >= party size, or no
// capacity limit). Falls back to the nearest one before it. Only ever picks
// from the live bookable list — never a fabricated date. null = none.
export function pickNextBookable<T extends BookableNight>(
  events: T[],
  soldOutDate: string,
  partySize: number | null,
  productSlug: string
): T | null {
  const fits = (e: T) =>
    e.productSlug === productSlug &&
    e.eventDate !== soldOutDate &&
    (partySize == null || e.remaining == null || e.remaining >= partySize)
  const sorted = events.filter(fits).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  return sorted.find((e) => e.eventDate > soldOutDate) ?? sorted.reverse()[0] ?? null
}

export interface SoldOutSubscriber {
  email: string
  product_slug: string
  consent_scope: string
  consented_at: string | null
  consent_text: string | null
  event_date_id: string | null
  party_size: number | null
  unsubscribed_at: string | null
  notified_at: string | null
}

export type RecipientCheck =
  | { ok: true }
  | { ok: false; status: 'skipped'; reason: string }

// Send-time re-check for one reopen-notice recipient. `seatCap` is the
// smaller of the party-size limit the admin approved and the seats left right
// now. Any failure is 'skipped': nothing was sent, and the person stays on
// the list (except where they opted out or were already told).
export function checkReopenRecipient(
  s: SoldOutSubscriber | null,
  target: { productSlug: string; eventDateId: string; seatCap: number },
  ctx: { alreadyNotified: boolean; alreadyBooked: boolean; emailValid: boolean }
): RecipientCheck {
  const skip = (reason: string): RecipientCheck => ({ ok: false, status: 'skipped', reason })
  if (!s) return skip('removed from the list')
  if (s.unsubscribed_at) return skip('unsubscribed')
  if (s.consent_scope !== SOLD_OUT_SCOPE || !s.consented_at || !s.consent_text) return skip('no sold-out consent on record')
  if (s.product_slug !== target.productSlug || s.event_date_id !== target.eventDateId) return skip('signed up for a different date')
  if (s.notified_at || ctx.alreadyNotified) return skip('already sent a notice for this date')
  if (ctx.alreadyBooked) return skip('already booked this date')
  if (!ctx.emailValid) return skip('invalid email')
  if (!s.party_size || s.party_size > target.seatCap) return skip(`party of ${s.party_size ?? '?'} is more than the ${target.seatCap} seat(s) available`)
  return { ok: true }
}

// The seat limit a reopen notice may use right now: the admin's approved
// maximum, never more than the seats actually left. 0 = nothing to offer.
export function seatCap(maxPartySize: number, remaining: number | null): number {
  const cap = Math.min(maxPartySize, MAX_PARTY_SIZE)
  return remaining == null ? cap : Math.max(0, Math.min(cap, remaining))
}

// Optional, separate "keep me updated" list (consent_scope 'bcc_updates').
// Offered as an unticked box under the waitlist consent; never implied by it.
export const BCC_UPDATES_SCOPE = 'bcc_updates'
export const BCC_UPDATES_CONSENT_TEXT =
  'Also email me about new Bangkok Club Crawl nights and events. Optional; I can unsubscribe any time.'
