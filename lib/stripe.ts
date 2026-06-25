import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Map night slug → Stripe Price ID
export function getPriceId(slug: string): string {
  const signature = ['saturday-signature']
  const weekend = ['tgif', 'lgbtplus-night']
  // All others are weekday

  if (signature.includes(slug)) return process.env.STRIPE_PRICE_SIGNATURE!
  if (weekend.includes(slug)) return process.env.STRIPE_PRICE_WEEKEND!
  return process.env.STRIPE_PRICE_WEEKDAY!
}

// Map night slug → price in THB (for display / records)
export function getPriceTHB(slug: string): number {
  const signature = ['saturday-signature']
  const weekend = ['tgif', 'lgbtplus-night']
  if (signature.includes(slug)) return 1500
  if (weekend.includes(slug)) return 1200
  return 1000
}

// Night display names
export const NIGHT_NAMES: Record<string, string> = {
  'solo-night': "Solo Traveler's Night",
  'new-in-bangkok': 'New in Bangkok Night',
  'nomad-nights': 'Digital Nomad Crawl',
  'girls-night': 'Girls Night Bangkok',
  '30plus-night': '30+ Social Night',
  'tgif': 'TGIF Bangkok',
  'saturday-signature': 'Signature Night',
  'lgbtplus-night': 'LGBT+ Night Bangkok',
}
