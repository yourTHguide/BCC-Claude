// Label shown in the Stripe dashboard's Description column for each payment,
// so Transactions shows the brand, night and date at a glance, e.g.
// "BKK Club Crawl · Friday Night Crawl · Fri 14 Nov 2026" or
// "Single Meet Club · Sat 22 Nov 2026". Stripe-side only; guests don't see it.
export function shortEventDate(eventDate: string | null | undefined): string | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null
  const [y, m, d] = eventDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export function stripePaymentLabel(brand: string, nightName: string | null, eventDate: string | null | undefined): string {
  return [brand, nightName, shortEventDate(eventDate)].filter(Boolean).join(' · ')
}
