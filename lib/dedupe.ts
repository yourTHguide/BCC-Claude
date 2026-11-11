import type { SupabaseClient } from '@supabase/supabase-js'

// Double-submit guard for manual entry forms (expenses, OTA / direct
// bookings). A second tap on Save — or a slow mobile connection retrying —
// used to insert the same row two or three times within a second or two.
// Returns true when an identical row (same columns/values) was created in
// the last `windowSeconds`; callers then treat the request as already done.
export async function isRecentDuplicate(
  supabase: SupabaseClient,
  table: 'expenses' | 'ota_bookings',
  match: Record<string, string | number | null>,
  windowSeconds = 15
): Promise<boolean> {
  let q = supabase
    .from(table)
    .select('id')
    .gte('created_at', new Date(Date.now() - windowSeconds * 1000).toISOString())
    .limit(1)
  for (const [col, val] of Object.entries(match)) {
    q = val === null ? q.is(col, null) : q.eq(col, val)
  }
  const { data } = await q
  return !!data && data.length > 0
}
