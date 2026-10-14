// Single Meet Club — single source of truth for event facts shown on the
// SMC landing page. Every date/time/venue/price/capacity value rendered by
// components/smc/* reads from here, never hardcoded in the UI, so a new
// monthly edition is a one-file change. When the booking phase lands, these
// values move to the Supabase `products` / `event_dates` rows for slug
// SMC_PRODUCT_SLUG and this object becomes the fallback/presentation layer.

// products.slug of Single Meet Club. SMC is sold ONLY through its own flow
// (/single-meet-club/book → /api/smc/checkout: attendee names, 20+ confirmation,
// seat holds, verified payment). The generic storefront listing, product pages
// and /api/create-checkout exclude it via isDedicatedFlowProduct().
export const SMC_PRODUCT_SLUG = 'smc'

export function isDedicatedFlowProduct(slug: string | null | undefined): boolean {
  return slug === SMC_PRODUCT_SLUG
}

// The public launch switch is the SMC_PAGE_PUBLISHED environment variable,
// read at request time in lib/smc/env.ts (unset = hidden on production).

export interface SmcEdition {
  // e.g. "Halloween Edition"; empty for a standard month
  editionName: string
  editionTagline: string
  // Optional theme note shown with the event details, e.g. costumes
  themeNote: string
  // YYYY-MM-DD, Asia/Bangkok local date
  date: string
  // HH:MM, 24h, Asia/Bangkok
  startTime: string
  venueName: string
  venueShortName: string
  venueArea: string
  venueCity: string
  mapUrl: string
  // THB, whole units
  priceThb: number
  inclusion: string
  capacity: number
}

// Fixed facts for every edition. The date shown on the site comes from the
// next SMC event in the database (lib/smc/event.ts); `date` here is only the
// fallback, computed as the next last Thursday of the month.
export const SMC_NEXT_EDITION: SmcEdition = {
  editionName: '',
  editionTagline: '',
  themeNote: '',
  date: nextLastThursday(),
  startTime: '19:30',
  venueName: "Tony's Restaurant & Bar",
  venueShortName: "Tony's",
  venueArea: 'Sukhumvit Soi 11',
  venueCity: 'Bangkok',
  mapUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent("Tony's Restaurant & Bar Sukhumvit Soi 11 Bangkok"),
  priceThb: 400,
  inclusion: 'Welcome drink included',
  capacity: 40,
}

export const SMC_FREQUENCY_LABEL = 'Last Thursday of every month'

// Last Thursday of the given month (UTC date math), as YYYY-MM-DD.
export function lastThursdayOf(year: number, monthIndex: number): string {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0))
  last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() - 4 + 7) % 7))
  return last.toISOString().slice(0, 10)
}

// The next last-Thursday on or after `fromIso` (default: today in Bangkok).
export function nextLastThursday(fromIso?: string): string {
  const today =
    fromIso ??
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const [y, m] = today.split('-').map(Number)
  const thisMonth = lastThursdayOf(y, m - 1)
  return thisMonth >= today ? thisMonth : lastThursdayOf(m === 12 ? y + 1 : y, m % 12)
}

// Where every "Reserve your spot" CTA points.
export const SMC_BOOKING_HREF = '/single-meet-club/book'

// ── Formatting helpers (pure; parse as UTC so the server TZ can't shift the day) ──

function editionDate(edition: SmcEdition): Date {
  return new Date(`${edition.date}T00:00:00Z`)
}

// "THU 29 OCT 2026"
export function formatShortDate(edition: SmcEdition): string {
  const d = editionDate(edition)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })
  const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  const year = d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'UTC' })
  return `${weekday} ${day} ${month} ${year}`.toUpperCase()
}

// "Thursday 29 October 2026"
export function formatLongDate(edition: SmcEdition): string {
  const d = editionDate(edition)
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  const rest = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return `${weekday} ${rest}`
}

// "7:30 PM"
export function formatStartTime(edition: SmcEdition): string {
  const [h, m] = edition.startTime.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

// "฿400"
export function formatPrice(edition: SmcEdition): string {
  return `฿${edition.priceThb.toLocaleString('en-US')}`
}
