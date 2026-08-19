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

  const anchor: string = s.generated_through ?? s.start_date
  let newUntil: string
  if (body?.untilDate) {
    if (!ISO.test(String(body.untilDate))) {
      return NextResponse.json({ error: 'Choose a valid generate-through date' }, { status: 400 })
    }
    newUntil = String(body.untilDate)
  } else {
    newUntil = addDaysISO(anchor, DEFAULT_HORIZON_WEEKS * 7)
  }
  if (newUntil <= anchor) {
    return NextResponse.json(
      { error: `Choose a date after the current last generated date (${anchor}).` },
      { status: 422 }
    )
  }

  const result = generateOccurrences({
    freq: 'weekly',
    weekday: s.weekday as Weekday,
    startDate: s.start_date,
    untilDate: newUntil,
  })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 422 })

  const rows = result.dates.map((event_date) => ({
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
  await supabase
    .from('product_schedules')
    .update({ generated_through: result.effectiveUntil, until_date: body?.untilDate ? newUntil : s.until_date })
    .eq('id', s.id)

  return NextResponse.json({ created, newGeneratedThrough: result.effectiveUntil })
}
