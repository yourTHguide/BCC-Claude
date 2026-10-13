import { headers } from 'next/headers'
import { resolveStorefront } from '@/lib/storefront'
import { SMC_PAGE_PUBLISHED } from '@/lib/smc/config'

// Production Supabase project ref. A non-production deployment must never
// write SMC data here, whatever its environment variables say.
const PRODUCTION_SUPABASE_REF = 'oomhftxgvikzxlvqdcmr'

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

export function isPreviewOrDev(): boolean {
  return process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'
}

// SMC pages render on Vercel Preview / local dev, and on production only on
// the BNT host once SMC_PAGE_PUBLISHED is set. Same rule for every SMC page.
export function canRenderSmcPage(): boolean {
  if (isPreviewOrDev()) return true
  return SMC_PAGE_PUBLISHED && resolveStorefront(headers().get('host')) === 'bnt'
}

export interface SmcCheckoutReadiness {
  ready: boolean
  // Safe to show to a guest; never contains configuration details.
  publicReason: string | null
  // For server logs only.
  internalReasons: string[]
}

// Every condition that must hold before SMC checkout may create a
// registration or a Stripe session. Checked on every request.
export function smcCheckoutReadiness(): SmcCheckoutReadiness {
  const reasons: string[] = []

  if (process.env.SMC_CHECKOUT_ENABLED !== 'true') {
    reasons.push('SMC_CHECKOUT_ENABLED is not "true"')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? ''

  if (isProductionDeployment()) {
    // Live payments are not approved. Production checkout stays closed until
    // a separate launch change removes this branch.
    reasons.push('live SMC payments are not enabled on production')
  } else {
    if (supabaseUrl.includes(PRODUCTION_SUPABASE_REF)) {
      reasons.push('non-production deployment is pointed at the production Supabase project')
    }
    if (!stripeKey.startsWith('sk_test_')) {
      reasons.push('non-production deployment does not have a Stripe test-mode secret key')
    }
  }

  return {
    ready: reasons.length === 0,
    publicReason: reasons.length === 0 ? null : 'Online booking is not open yet.',
    internalReasons: reasons,
  }
}
