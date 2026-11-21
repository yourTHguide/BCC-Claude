import type { Storefront } from '@/lib/storefront'
import { isProductionHost } from '@/lib/consentConfig'

// Privacy notices (pre-release review, Nov 2026).
//
// /privacy serves the brand-specific notice for the host it's requested on.
// On previews and local development it always renders (marked DRAFT) so it
// can be reviewed. On the production domains it is served — and linked from
// the cookie banner and footers — only when ALL of these hold:
//   1. the notice text is marked ready below (no open placeholders),
//   2. PRIVACY_NOTICE_PUBLISHED=true in Vercel (Production) — owner's switch,
//   3. PRIVACY_NOTICE_EFFECTIVE_DATE=YYYY-MM-DD in Vercel (Production): the
//      real publication date, shown as the notice's effective date.
// Missing any one -> production returns 404 and shows no privacy link.
export const PRIVACY_TEXT_FINAL: Record<Storefront, boolean> = {
  // Text ready for publication (owner decisions applied 21 Nov 2026; legal
  // points use conservative wording — see docs/privacy/OPEN_QUESTIONS.md for
  // what still needs professional verification). Publishing is still off
  // until the two Vercel variables above are set.
  bnt: true,
  bcc: true,
}

export const PRIVACY_PATH = '/privacy'

// Effective date from PRIVACY_NOTICE_EFFECTIVE_DATE, formatted "1 December 2026";
// null if unset or not a real YYYY-MM-DD date.
export function privacyEffectiveDate(): string | null {
  const raw = (process.env.PRIVACY_NOTICE_EFFECTIVE_DATE || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const d = new Date(`${raw}T00:00:00Z`)
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return null
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function privacyPublished(storefront: Storefront): boolean {
  return process.env.PRIVACY_NOTICE_PUBLISHED === 'true' && PRIVACY_TEXT_FINAL[storefront] && privacyEffectiveDate() !== null
}

export function privacyAvailable(host: string | null | undefined, storefront: Storefront): boolean {
  return privacyPublished(storefront) || !isProductionHost(host)
}
