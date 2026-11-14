// Which night an OTA guest belongs to, from the date alone.
// OTA listings run Tue–Sun on the same route, so there are no themed nights:
//   Friday → TGIF Bangkok, Saturday → Signature Night,
//   other days → BKK Club Crawl (internal only, never sold on the website),
//   and a special night (e.g. Halloween) wins when it's on the calendar that date.

export const OTA_NIGHT_NAMES: Record<string, string> = {
  tgif: 'TGIF Bangkok',
  'saturday-signature': 'Signature Night',
  'club-crawl': 'BKK Club Crawl',
}

/** Nights OTA guests can sit on (the rest — SMC, New in Bangkok, old themes — never). */
export function isOtaNight(slug: string): boolean {
  return slug in OTA_NIGHT_NAMES || slug.startsWith('halloween')
}

export function otaNightSlug(date: string, slugsOnDate: string[]): string {
  const special = slugsOnDate.find((s) => s.startsWith('halloween'))
  if (special) return special
  const dow = new Date(date + 'T00:00:00Z').getUTCDay()
  const byDay = dow === 5 ? 'tgif' : dow === 6 ? 'saturday-signature' : 'club-crawl'
  if (slugsOnDate.includes(byDay)) return byDay
  // A date that already has one OTA night (e.g. a club-crawl added on a Friday) keeps it.
  return slugsOnDate.find((s) => s in OTA_NIGHT_NAMES) ?? byDay
}

export function otaNightName(slug: string): string {
  return OTA_NIGHT_NAMES[slug] ?? slug
}
