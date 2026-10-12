// Single Meet Club — single source of truth for event facts shown on the
// SMC landing page. Every date/time/venue/price/capacity value rendered by
// components/smc/* reads from here, never hardcoded in the UI, so a new
// monthly edition is a one-file change. When the booking phase lands, these
// values move to the Supabase `products` / `event_dates` rows for slug
// SMC_PRODUCT_SLUG and this object becomes the fallback/presentation layer.

export const SMC_PRODUCT_SLUG = 'single-meet-club'

// Public launch switch. While false, /single-meet-club 404s on production
// (bestnightlifethailand.com) and only renders on Vercel Preview / local dev.
// Flip to true only after copy, photography, logos and booking are approved.
export const SMC_PAGE_PUBLISHED = false

export interface SmcEdition {
  // YYYY-MM-DD, Asia/Bangkok local date
  date: string
  // HH:MM, 24h, Asia/Bangkok
  startTime: string
  venueName: string
  venueShortName: string
  venueArea: string
  venueCity: string
  mapUrl: string
  // THB, whole units — WORKING price, pending final approval
  priceThb: number
  inclusion: string
  // WORKING capacity, pending final approval
  capacity: number
}

export const SMC_NEXT_EDITION: SmcEdition = {
  date: '2026-10-29',
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

// Where every "Reserve your spot" CTA points. The booking route is Phase 1c
// and does not exist yet — this will 404 until it is built.
export const SMC_BOOKING_HREF = '/single-meet-club/book'

// Photography currently on the page is existing BEST/BCC event photography
// standing in for genuine SMC photos. While true, every image carries a
// visible "Placeholder photo" tag so nothing is mistaken for real SMC content.
export const SMC_SHOW_PLACEHOLDER_TAGS = true

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
