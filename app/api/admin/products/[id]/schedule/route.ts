import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import {
  generateOccurrences,
  DEFAULT_HORIZON_WEEKS,
  type RecurrenceRule,
  type Weekday,
} from '@/lib/recurrence'

export const dynamic = 'force-dynamic'

// Generate Event Instances for a Product from a recurrence rule.
//
// Uses the SAME generateOccurrences() the Create Product UI previews with, so
// the dates written are exactly the dates the admin saw. Instances are linked by
// product_id + schedule_id and stamped with the product's slug as night_slug
// (1 Product : 1 night_slug). Draft products stay invisible because /api/events
// gates on products.status = 'active'.
//
// Idempotent: the existing UNIQUE(event_date, night_slug) constraint is the
// protection layer — the upsert uses ON CONFLICT DO NOTHING, so re-running never
// creates duplicate Event Instances (it just reports 0 created).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()

  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, slug, name, default_start_time')
    .eq('id', params.id)
    .maybeSingle()

  if (pErr) {
    console.error('schedule: product lookup error:', pErr)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let rule: RecurrenceRule
  if (body?.freq === 'once') {
    rule = { freq: 'once', date: String(body.date ?? '') }
  } else if (body?.freq === 'weekly') {
    rule = {
      freq: 'weekly',
      weekday: Number(body.weekday) as Weekday,
      startDate: String(body.startDate ?? ''),
      untilDate: body.untilDate ? String(body.untilDate) : null,
      horizonWeeks: body.horizonWeeks != null ? Number(body.horizonWeeks) : DEFAULT_HORIZON_WEEKS,
    }
  } else {
    return NextResponse.json({ error: 'Unknown recurrence type' }, { status: 400 })
  }

  const result = generateOccurrences(rule)
  if (result.error || result.dates.length === 0) {
    return NextResponse.json({ error: result.error ?? 'No dates in range' }, { status: 422 })
  }

  const p = product as { id: string; slug: string; name: string }

  // 1) Record the schedule (metadata; the booking calendar never reads it).
  const { data: schedule, error: sErr } = await supabase
    .from('product_schedules')
    .insert({
      product_id: p.id,
      night_slug: p.slug,
      night_name: p.name,
      freq: rule.freq,
      weekday: rule.freq === 'weekly' ? rule.weekday : null,
      start_date: rule.freq === 'weekly' ? rule.startDate : rule.date,
      until_date: rule.freq === 'weekly' ? rule.untilDate ?? null : null,
      start_time_default: null, // inherits products.default_start_time
      generated_through: result.effectiveUntil,
      is_active: true,
    })
    .select('*')
    .single()

  if (sErr || !schedule) {
    console.error('schedule: insert error:', sErr)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }

  // 2) Materialize Event Instances, idempotently.
  const rows = result.dates.map((event_date) => ({
    event_date,
    night_slug: p.slug,
    night_name: p.name,
    product_id: p.id,
    schedule_id: (schedule as { id: string }).id,
    is_open: true,
  }))

  const { data: inserted, error: eErr } = await supabase
    .from('event_dates')
    .upsert(rows, { onConflict: 'event_date,night_slug', ignoreDuplicates: true })
    .select('id')

  if (eErr) {
    console.error('schedule: event_dates upsert error:', eErr)
    return NextResponse.json({ error: 'Failed to generate event instances' }, { status: 500 })
  }

  const created = inserted?.length ?? 0
  return NextResponse.json(
    {
      schedule,
      requested: result.dates.length,
      created,
      skipped: result.dates.length - created,
      dates: result.dates,
    },
    { status: 201 }
  )
}
