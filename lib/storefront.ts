// Storefront → product visibility column. Whitelisted so the value passed to
// Supabase (as a column name) is only ever one of these two literals, never
// user-controlled SQL. Shared by every route that gates Product/Event
// visibility per storefront (/api/events, /api/products/[slug], ...) so the
// two callers can never drift out of sync with each other.
export type Storefront = 'bcc' | 'bnt'

export const VISIBILITY_COLUMN: Record<string, 'visible_bcc' | 'visible_bnt'> = {
  bcc: 'visible_bcc',
  bnt: 'visible_bnt',
}

// Host → storefront. The single place hostname branding decisions are made —
// callers pass the incoming request's Host header (e.g. `headers().get('host')`
// in a Server Component / Route Handler); nothing else should string-match a
// hostname. Unknown/local/preview hosts fall back to 'bcc', matching this
// app's pre-Stage-10 identity (bkkclubcrawl.com) so existing behavior never
// regresses for a host this function doesn't recognize. This decides content
// and branding only — product/event visibility is still gated separately by
// VISIBILITY_COLUMN against the DB, never inferred from the host alone.
const BNT_HOSTS = new Set(['bestnightlifethailand.com', 'www.bestnightlifethailand.com'])

export function resolveStorefront(host: string | null | undefined): Storefront {
  const normalized = (host ?? '').toLowerCase().split(':')[0]
  return BNT_HOSTS.has(normalized) ? 'bnt' : 'bcc'
}
