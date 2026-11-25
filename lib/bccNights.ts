// Bangkok Club Crawl night types for "Add a night" on the dashboard calendar
// (Nov 2026). Names and codes match what checkout, the OTA import
// (lib/ota-import/nights.ts) and the existing calendar already use, so a
// night added here behaves exactly like one made by the weekly schedule.

export type BccNightType = 'club-crawl' | 'tgif' | 'saturday-signature' | 'special'

export const BCC_NIGHT_TYPES: { value: BccNightType; label: string; slug?: string; name?: string }[] = [
  { value: 'club-crawl', label: 'BKK Club Crawl (no theme)', slug: 'club-crawl', name: 'BKK Club Crawl' },
  { value: 'tgif', label: 'TGIF Bangkok', slug: 'tgif', name: 'TGIF Bangkok' },
  { value: 'saturday-signature', label: 'Signature Night', slug: 'saturday-signature', name: 'Signature Night' },
  { value: 'special', label: 'Special theme (type a name)' },
]

// "Halloween Crawl" -> "halloween-crawl". Never collides with the fixed codes.
export function specialNightSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const slug = base || 'special-night'
  return ['club-crawl', 'tgif', 'saturday-signature'].includes(slug) ? `${slug}-special` : slug
}

export function resolveNightType(type: string, specialName: string): { slug: string; name: string } | { error: string } {
  const t = BCC_NIGHT_TYPES.find((x) => x.value === type)
  if (!t) return { error: 'Choose a night type.' }
  if (t.value !== 'special') return { slug: t.slug!, name: t.name! }
  const name = specialName.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (name.length < 2) return { error: 'Type a name for the special night.' }
  return { slug: specialNightSlug(name), name }
}
