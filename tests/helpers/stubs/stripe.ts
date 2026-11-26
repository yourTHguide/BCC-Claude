// Stub for '@/lib/stripe': records Checkout Session requests and returns a
// fake URL. No Stripe client is constructed and nothing leaves the process.
// getPriceId / NIGHT_NAMES mirror lib/stripe.ts (legacy path only).
export const stripe = {
  // Webhook tests send the event as the raw body; no signature check here.
  webhooks: { constructEvent: (body: string) => JSON.parse(body) },
  paymentIntents: { retrieve: async (id: string) => ({ id, latest_charge: `ch_${id}` }) },
  promotionCodes: { retrieve: async (id: string) => ({ id, code: 'PROMO' }) },
  checkout: {
    sessions: {
      create: async (params: any) => {
        const s = (globalThis as any).__stripe
        s.sessions.push(params)
        return { id: `cs_test_stub_${s.sessions.length}`, url: `https://checkout.stripe.test/cs_test_stub_${s.sessions.length}` }
      },
    },
  },
}
export function getPriceId(slug: string): string {
  return ['tgif', 'saturday-signature', 'lgbtplus-night'].includes(slug) ? 'price_test_weekend' : 'price_test_weekday'
}
export const NIGHT_NAMES: Record<string, string> = { tgif: 'TGIF Bangkok', 'saturday-signature': 'Signature Night' }
