import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday } from '@/lib/dates'

// Next real open date per public event, for the BEST homepage event cards
// (Phase 3, Nov 2026). Read-only, and only long-standing columns
// (event_dates.is_open/event_date, products.slug/status) so it works on the
// Preview DB too. Shows only dates that already exist in the database —
// never invents one. Any error returns no dates (cards fall back to their
// schedule line), so the homepage can never fail because of this.
export type UpcomingDates = Partial<Record<string, string>> // slug -> YYYY-MM-DD

export async function loadNextOpenDates(slugs: string[]): Promise<UpcomingDates> {
  try {
    const { data, error } = await getServiceSupabase()
      .from('event_dates')
      .select('event_date, products!inner ( slug, status )')
      .eq('is_open', true)
      .gte('event_date', bangkokToday())
      .eq('products.status', 'active')
      .in('products.slug', slugs)
      .order('event_date', { ascending: true })
      .limit(200)
    if (error || !data) return {}
    const out: UpcomingDates = {}
    for (const row of data as any[]) {
      const slug = Array.isArray(row.products) ? row.products[0]?.slug : row.products?.slug
      if (slug && !out[slug]) out[slug] = row.event_date
    }
    return out
  } catch {
    return {}
  }
}

// "Fri 20 Nov" from YYYY-MM-DD, timezone-safe.
export function shortEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const wd = dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  const mon = dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  return `${wd} ${d} ${mon}`
}
