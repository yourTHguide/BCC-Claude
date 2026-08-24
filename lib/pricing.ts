// Canonical event pricing resolver (Stage 10 Phase 5).
//
// Single source of truth for "what does this specific event instance cost
// right now" — shared by /api/events (calendar), the public/preview Product
// Page loaders (lib/publicProductPage.ts, admin draft preview), and
// create-checkout's authoritative Stripe amount. A product that has never
// set early_bird_price behaves exactly as every product did before this
// file existed: always 'regular' at regularPrice, no early-bird branch ever
// evaluated. Nothing about existing BCC pricing changes by this file simply
// existing — only products that explicitly opt in (early_bird_price NOT
// NULL) get tiered pricing.

export type PriceTier = 'early_bird' | 'regular'

export interface EventPricingInput {
  eventDate: string // YYYY-MM-DD
  effectiveStartTime: string | null // HH:MM:SS, already resolved (start_time_override ?? default_start_time)
  regularPrice: number // already resolved (price_override ?? default_price)
  earlyBirdPrice: number | null // product.early_bird_price
  earlyBirdCutoffHours: number | null // product.early_bird_cutoff_hours
  now?: Date // injectable for controlled-clock testing; defaults to real time
}

export interface ResolvedEventPricing {
  tier: PriceTier
  price: number
  regularPrice: number
  earlyBirdPrice: number | null
  earlyBirdAvailable: boolean
}

// Combines an event's own date + effective start time into an absolute
// instant, assuming Asia/Bangkok's fixed UTC+7 offset (Thailand has no DST,
// so this is always correct — no timezone library needed, consistent with
// this codebase's existing no-tz-library convention, see lib/dates.ts).
function eventStartInstant(eventDate: string, startTime: string | null): Date {
  const time = (startTime ?? '00:00:00').slice(0, 8)
  return new Date(`${eventDate}T${time}+07:00`)
}

// Early Bird is available strictly before the cutoff instant (event start
// minus earlyBirdCutoffHours) and stops being available AT and AFTER it —
// "exactly 48 hours before start, Early Bird becomes invalid" per the
// product requirement, i.e. the cutoff instant itself is already too late.
export function resolveEventPricing(input: EventPricingInput): ResolvedEventPricing {
  const {
    eventDate,
    effectiveStartTime,
    regularPrice,
    earlyBirdPrice,
    earlyBirdCutoffHours,
    now = new Date(),
  } = input

  if (earlyBirdPrice == null || earlyBirdCutoffHours == null) {
    return {
      tier: 'regular',
      price: regularPrice,
      regularPrice,
      earlyBirdPrice: null,
      earlyBirdAvailable: false,
    }
  }

  const eventStart = eventStartInstant(eventDate, effectiveStartTime)
  const cutoff = new Date(eventStart.getTime() - earlyBirdCutoffHours * 60 * 60 * 1000)
  const earlyBirdAvailable = now.getTime() < cutoff.getTime()

  return earlyBirdAvailable
    ? { tier: 'early_bird', price: earlyBirdPrice, regularPrice, earlyBirdPrice, earlyBirdAvailable: true }
    : { tier: 'regular', price: regularPrice, regularPrice, earlyBirdPrice, earlyBirdAvailable: false }
}
