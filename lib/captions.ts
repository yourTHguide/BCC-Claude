// Caption Library — shared vocabulary for the SNX Operator Captions page and
// its API routes. Client-safe (no server imports). Mirrors the domain model
// that originated in Living OS (sanctuary-nexus src/livingos/captions.ts) so
// both surfaces read and write the same public.captions rows.

export const CAPTION_SCOPE = {
  ventureId: 'best-nightlife',
  cityId: 'bangkok',
  productId: 'bangkok-club-crawl',
  livingAddress: 'livingos://best-nightlife/creative-studio/social-floor/caption-library',
} as const

export const CAPTION_CATEGORIES = [
  { id: 'funny', label: 'Funny Moments', icon: '😂' },
  { id: 'connection', label: 'Connection & Friends', icon: '🤝' },
  { id: 'classy', label: 'Classy Night Out', icon: '✨' },
  { id: 'party', label: 'Party Energy', icon: '🍸' },
  { id: 'solo', label: 'Solo Travelers', icon: '🌍' },
  { id: 'host', label: 'Host Perspective', icon: '❤️' },
  { id: 'recap', label: 'Event Recap', icon: '🎉' },
  { id: 'promotional', label: 'Promotional', icon: '📢' },
] as const

export type CaptionCategoryId = (typeof CAPTION_CATEGORIES)[number]['id']
export type CaptionStatus = 'available' | 'used'

// How many new captions one "Generate" tap aims to add.
export const CAPTIONS_PER_GENERATE = 20

export interface CaptionRecord {
  id: string
  categoryId: CaptionCategoryId
  text: string
  status: CaptionStatus
  createdAt: string
  usedAt: string | null
}

export function isCaptionCategory(value: unknown): value is CaptionCategoryId {
  return CAPTION_CATEGORIES.some((category) => category.id === value)
}

export function captionCategory(id: CaptionCategoryId) {
  return CAPTION_CATEGORIES.find((category) => category.id === id)!
}

// ── Near-duplicate protection ─────────────────────────────────
// Two captions count as the same when, after normalisation, they're identical
// or share >= 82% of their meaningful words (Jaccard). Same rule Living OS used.
const NON_WORD = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu')

export function normalizeCaptionText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(NON_WORD, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter((token) => token.length > 2))
}

export function captionsAreNearDuplicates(a: string, b: string): boolean {
  const left = normalizeCaptionText(a)
  const right = normalizeCaptionText(b)
  if (!left || !right) return false
  if (left === right) return true
  const aTokens = tokens(left)
  const bTokens = tokens(right)
  const intersection = Array.from(aTokens).filter((token) => bTokens.has(token)).length
  const union = new Set(Array.from(aTokens).concat(Array.from(bTokens))).size
  return union > 0 && intersection / union >= 0.82
}

export function uniqueCaptionTexts(candidates: string[], existing: string[]): string[] {
  const accepted: string[] = []
  for (const raw of candidates) {
    const text = raw.trim()
    if (text.length < 8) continue
    if (existing.some((item) => captionsAreNearDuplicates(item, text))) continue
    if (accepted.some((item) => captionsAreNearDuplicates(item, text))) continue
    accepted.push(text)
  }
  return accepted
}
