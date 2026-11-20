import type { Storefront } from '@/lib/storefront'
import { isProductionHost } from '@/lib/consentConfig'

// Privacy notices (pre-release review, Nov 2026).
//
// /privacy serves the brand-specific notice for the host it's requested on.
// On previews and local development it always renders (marked DRAFT) so it
// can be reviewed. On the production domains it is only served — and only
// linked from the cookie banner and footers — when BOTH:
//   1. the notice text is marked final below (all [LEGAL]/[CONFIRM] items
//      resolved in components/privacy/*), and
//   2. the Vercel env var PRIVACY_NOTICE_PUBLISHED is 'true' (owner's switch).
// Until then production returns 404 and shows no privacy link, so nothing
// links to a page that isn't there and no draft wording goes live.
export const PRIVACY_TEXT_FINAL: Record<Storefront, boolean> = {
  bnt: false,
  bcc: false,
}

export const PRIVACY_PATH = '/privacy'

export function privacyPublished(storefront: Storefront): boolean {
  return process.env.PRIVACY_NOTICE_PUBLISHED === 'true' && PRIVACY_TEXT_FINAL[storefront]
}

export function privacyAvailable(host: string | null | undefined, storefront: Storefront): boolean {
  return privacyPublished(storefront) || !isProductionHost(host)
}
