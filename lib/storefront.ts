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
