import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { generateOccurrences, DEFAULT_HORIZON_WEEKS, type Weekday } from '@/lib/recurrence'
import { addDaysISO } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// Extend an existing WEEKLY schedule farther into the future. Uses the SAME
// generateOccurrences() as create/preview, then upserts with ON CONFLICT DO
// NOTHING so only NEW dates are inserted (never duplicates). Extending through
// an explicit date is supported; otherwise it adds the default 12 more weeks
// beyond the last generated date.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const { data: schedule } = await supabase
    .from('product_schedules')
    .select('id, product_id, night_slug, night_name, freq, weekday, start_date, until_date, generated_through')
    .eq('id', params.id)
    .maybeSingle()
  if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

  const s = schedule as any
  if (s.freq !== 'weekly') {
    return NextResponse.json({ error: 'Only recurring (weekly) schedules can be extended.' }, { status: 422 })
  }

  let body: any = {}
  try { body = await req.json() } catch { /* body optional */ }

  // The existing generated boundary. Extend must ONLY add dates strictly AFTER
  // this — it must never rescan earlier dates, so deleted / closed / manually
  // added instances in the historical range are never resurrected or touched.
  const boundary: string | null = s.generated_through
  let newUntil: string
  if (body?.untilDate) {
    if (!ISO.test(String(body.untilDate))) {
      return NextResponse.json({ error: 'Choose a valid generate-through date' }, { status: 400 })
    }
    newUntil = String(body.untilDate)
  } else {
    newUntil = addDaysISO(boundary ?? s.start_date, DEFAULT_HORIZON_WEEKS * 7)
  }

  const result = generateOccurrences({
    freq: 'weekly',
    weekday: s.weekday as Weekday,
    startDate: s.start_date,
    untilDate: newUntil,
  })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 })

  // INVARIANT: keep only occurrences strictly after the current boundary.
  const newDates = boundary ? result.dates.filter((d) => d > boundary) : result.dates
  if (newDates.length === 0) {
    // Nothing beyond the boundary (e.g. re-extending to the same date) — a no-op.
    return NextResponse.json({ created: 0, newGeneratedThrough: boundary })
  }

  const rows = newDates.map((event_date) => ({
    event_date, night_slug: s.night_slug, night_name: s.night_name,
    product_id: s.product_id, schedule_id: s.id, is_open: true,
  }))

  const { data: inserted, error: eErr } = await supabase
    .from('event_dates')
    .upsert(rows, { onConflict: 'event_date,night_slug', ignoreDuplicates: true })
    .select('id')
  if (eErr) {
    console.error('extend upsert error:', eErr)
    return NextResponse.json({ error: 'Failed to generate additional dates' }, { status: 500 })
  }

  const created = inserted?.length ?? 0
  // Advance the boundary ONLY after successful generation, to the last new date.
  const newBoundary = newDates[newDates.length - 1]
  await supabase
    .from('product_schedules')
    .update({ generated_through: newBoundary, until_date: body?.untilDate ? newUntil : s.until_date })
    .eq('id', s.id)

  return NextResponse.json({ created, newGeneratedThrough: newBoundary })
}
