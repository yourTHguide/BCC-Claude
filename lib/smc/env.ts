import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import { hasPreviewAccess } from '@/lib/smc/previewAccess'

// Production Supabase project ref. A non-production deployment must never
// write SMC data here, whatever its environment variables say.
const PRODUCTION_SUPABASE_REF = 'oomhftxgvikzxlvqdcmr'

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

export function isPreviewOrDev(): boolean {
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'
}

// Public launch switch: SMC_PAGE_PUBLISHED=true in the Production
// environment. Unset (the default) keeps every SMC page a 404 on production.
export function isSmcPagePublished(): boolean {
  return process.env.SMC_PAGE_PUBLISHED === 'true'
}

// SMC pages render on Vercel Preview / local dev, and on production only on
// the BNT host: publicly once published, or before that only for a browser
// holding a valid private-access cookie (lib/smc/previewAccess.ts).
export function canRenderSmcPage(): boolean {
  if (isPreviewOrDev()) return true
  if (resolveStorefront(headers().get('host')) !== 'bnt') return false
  return isSmcPagePublished() || hasPreviewAccess()
}

// May this request start an SMC checkout? Same audience as the page.
export function smcCheckoutAudienceAllowed(): boolean {
  if (!isProductionDeployment()) return true
  return isSmcPagePublished() || hasPreviewAccess()
}

// Search engines may index the landing page only on a published production site.
export function smcPageIndexable(): boolean {
  return isProductionDeployment() && isSmcPagePublished()
}

export interface SmcCheckoutReadiness {
  ready: boolean
  // Safe to show to a guest; never contains configuration details.
  publicReason: string | null
  // For server logs only.
  internalReasons: string[]
}

// Environment isolation rules shared by every SMC payment route (checkout,
// webhook, email retry). Production may take payments only with a live-mode
// Stripe key against the production database; every other environment only
// with a test-mode key against a non-production database. A mismatch refuses
// to run, whatever else is configured.
export function smcEnvironmentIssues(): string[] {
  const reasons: string[] = []
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''
  const usesProductionDb = supabaseUrl.includes(PRODUCTION_SUPABASE_REF)

  if (isProductionDeployment()) {
    if (!usesProductionDb) reasons.push('production deployment is not pointed at the production Supabase project')
    if (!stripeKey.startsWith('sk_live_')) reasons.push('production deployment does not have a Stripe live-mode secret key')
  } else {
    if (usesProductionDb) reasons.push('non-production deployment is pointed at the production Supabase project')
    if (!stripeKey.startsWith('sk_test_')) reasons.push('non-production deployment does not have a Stripe test-mode secret key')
  }
  return reasons
}

// Every condition that must hold before SMC checkout may create a
// registration or a Stripe session. Checked on every request. New checkouts
// stay closed everywhere (production included) until SMC_CHECKOUT_ENABLED is
// exactly "true"; setting it to anything else closes them immediately. The webhook
// and email retry use smcEnvironmentIssues() only, so payments already in
// progress still complete if new checkouts are switched off.
export function smcCheckoutReadiness(): SmcCheckoutReadiness {
  const reasons: string[] = []
  if (process.env.SMC_CHECKOUT_ENABLED !== 'true') {
    reasons.push('SMC_CHECKOUT_ENABLED is not "true"')
  }
  reasons.push(...smcEnvironmentIssues())

  return {
    ready: reasons.length === 0,
    publicReason: reasons.length === 0 ? null : 'Online booking is not open yet.',
    internalReasons: reasons,
  }
}
