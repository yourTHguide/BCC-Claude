// BEST event waitlists (Phase 3 finalization, Nov 2026).
//
// Consent is per product and per purpose. A sign-up for New in Bangkok is
// consent to hear about new New in Bangkok dates — nothing else. It is not
// consent to general marketing, and it does not carry over to a different
// product (e.g. a future Bangkok Mixer): that product gets its own slug here
// and its own sign-ups. Announcements are only ever sent to subscribers whose
// product_slug matches and whose consent_scope is 'event_dates'.

export interface WaitlistProduct {
  slug: string
  name: string
  // Public page the announcement links to.
  path: string
  // Shown under the sign-up button and stored verbatim on each row
  // (consent_text) so we can show exactly what someone agreed to.
  consentText: string
}

export const WAITLIST_PRODUCTS: Record<string, WaitlistProduct> = {
  'new-in-bkk': {
    slug: 'new-in-bkk',
    name: 'New in Bangkok',
    path: '/new-in-bangkok',
    consentText:
      'We’ll only email you about new New in Bangkok dates. No other marketing. Unsubscribe any time.',
  },
}

export const WAITLIST_CONSENT_SCOPE = 'event_dates'

export const BEST_ORIGIN = 'https://bestnightlifethailand.com'

export function unsubscribeUrl(token: string): string {
  return `${BEST_ORIGIN}/waitlist/unsubscribe?token=${encodeURIComponent(token)}`
}

export function oneClickUnsubscribeUrl(token: string): string {
  return `${BEST_ORIGIN}/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`
}
