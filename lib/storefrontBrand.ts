import type { Storefront } from './storefront'

// Customer-facing brand identity per storefront — Stage 10 Phase 6. The ONE
// place presentation facts (display name, logo, support contacts, email
// sender identity) live for either brand, so every surface in the booking
// journey (calendar, success page, ticket page, transactional emails) reads
// from here instead of re-hardcoding "Bangkok Club Crawl" text piecemeal.
// This is presentation ONLY — it never gates access or pricing (that stays
// resolveStorefront()/VISIBILITY_COLUMN/resolveEventPricing()'s job).
//
// Contact details were not invented: the BNT WhatsApp number and support
// email below are the same ones already live on the ported BNT contact page
// (components/bnt/BntContactPage.tsx) — https://wa.me/66660399569 and
// bestnightlifethailand@gmail.com — confirmed identical to BCC's own
// WhatsApp number (one shared operations phone across both brands).
export interface StorefrontBrand {
  name: string
  // Short, uppercase header/eyebrow tag as used in the existing email
  // templates (e.g. "BANGKOK CLUB CRAWL").
  shortName: string
  logoSrc: string
  logoAlt: string
  homeHref: string
  backLabel: string
  supportWhatsappUrl: string
  supportWhatsappDisplay: string
  supportEmail: string
  siteDomain: string
  emailSenderName: string
}

export const STOREFRONT_BRAND: Record<Storefront, StorefrontBrand> = {
  bcc: {
    name: 'Bangkok Club Crawl',
    shortName: 'BANGKOK CLUB CRAWL',
    logoSrc: '/images/bcc-logo.png',
    logoAlt: 'Bangkok Club Crawl',
    homeHref: '/',
    backLabel: 'Back to Bangkok Club Crawl',
    supportWhatsappUrl: 'https://wa.me/66660399569',
    supportWhatsappDisplay: '(+66) 66-039-9569',
    supportEmail: 'bangkokclubcrawl@gmail.com',
    siteDomain: 'www.bkkclubcrawl.com',
    emailSenderName: 'Bangkok Club Crawl',
  },
  bnt: {
    name: 'BEST Nightlife Thailand',
    shortName: 'BEST NIGHTLIFE THAILAND',
    logoSrc: '/bnt/logo/best-nightlife-thailand-logo.png',
    logoAlt: 'BEST Nightlife Thailand',
    homeHref: '/',
    backLabel: 'Back to BEST Nightlife Thailand',
    supportWhatsappUrl: 'https://wa.me/66660399569',
    supportWhatsappDisplay: '(+66) 66-039-9569',
    supportEmail: 'bestnightlifethailand@gmail.com',
    siteDomain: 'www.bestnightlifethailand.com',
    emailSenderName: 'BEST Nightlife Thailand',
  },
}

export function brandFor(storefront: Storefront | null | undefined): StorefrontBrand {
  return STOREFRONT_BRAND[storefront === 'bnt' ? 'bnt' : 'bcc']
}

// Resend "from" header for a storefront's transactional email. BCC's address
// (`RESEND_FROM`, the only sender this app has ever had) is untouched and
// stays the sole address for 'bcc' — zero change to live BCC delivery.
//
// For 'bnt': prefers a second verified sender (`RESEND_FROM_BNT`) so a real
// bestnightlifethailand.com address can be configured later without a code
// change (see .env.example). Until Guide completes that Resend/DNS domain
// verification, this falls back to the SAME verified `RESEND_FROM` address
// — the email still sends successfully (a Resend "from" address must be on a
// domain verified in that Resend account; bestnightlifethailand@gmail.com
// cannot be used directly, see PHASE4_CHECKPOINT.md Phase 6 entry) — but the
// display NAME is already correct ("BEST Nightlife Thailand"), fixing the
// customer-visible identity today even before the infra work lands.
export function resendFromHeader(storefront: Storefront | null | undefined): string {
  const brand = brandFor(storefront)
  const address =
    storefront === 'bnt' && process.env.RESEND_FROM_BNT
      ? process.env.RESEND_FROM_BNT
      : process.env.RESEND_FROM
  return `${brand.emailSenderName} <${address}>`
}
