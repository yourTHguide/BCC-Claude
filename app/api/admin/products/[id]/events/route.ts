import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ISO = /^\d{4}-\d{2}-\d{2}$/

async function loadProduct(supabase: any, id: string) {
  const { data } = await supabase
    .from('products')
    .select('id, slug, name, status, default_price, default_start_time, visible_bcc')
    .eq('id', id)
    .maybeSingle()
  return data as
    | { id: string; slug: string; name: string; status: string; default_price: number | null; default_start_time: string | null; visible_bcc: boolean }
    | null
}

// List all Event Instances for a Product (+ its schedules), each with a booking
// count used by the hard-delete guard.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const product = await loadProduct(supabase, params.id)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const { data: events, error } = await supabase
    .from('event_dates')
    .select('id, event_date, night_slug, night_name, is_open, price_override, start_time_override, capacity, schedule_id')
    .eq('product_id', params.id)
    .order('event_date', { ascending: true })
  if (error) {
    console.error('events list error:', error)
    return NextResponse.json({ error: 'Failed to load instances' }, { status: 500 })
  }

  const rows = events ?? []
  const slugs = Array.from(new Set(rows.map((r: any) => r.night_slug)))
  const key = (s: string, d: string) => `${s}|${d}`
  const counts: Record<string, number> = {}
  if (slugs.length) {
    for (const table of ['bookings', 'ota_bookings']) {
      const { data: bk } = await supabase.from(table).select('night_slug, event_date').in('night_slug', slugs)
      for (const b of bk ?? []) counts[key(b.night_slug, b.event_date)] = (counts[key(b.night_slug, b.event_date)] ?? 0) + 1
    }
  }

  const withCounts = rows.map((r: any) => ({ ...r, booking_count: counts[key(r.night_slug, r.event_date)] ?? 0 }))

  const { data: schedules } = await supabase
    .from('product_schedules')
    .select('id, freq, weekday, start_date, until_date, generated_through, is_active, night_slug')
    .eq('product_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    product: {
      slug: product.slug, name: product.name, status: product.status,
      default_price: product.default_price, default_start_time: product.default_start_time,
    },
    events: withCounts,
    schedules: schedules ?? [],
  })
}

// Add a single Event Instance (manual one-off) to the Product.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const product = await loadProduct(supabase, params.id)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const date = String(body.date ?? '')
  if (!ISO.test(date)) return NextResponse.json({ error: 'Choose a valid date' }, { status: 400 })

  const { data, error } = await supabase
    .from('event_dates')
    .insert({
      event_date: date, night_slug: product.slug, night_name: product.name,
      product_id: product.id, schedule_id: null, is_open: true,
    })
    .select('id, event_date, is_open, price_override, start_time_override, capacity, schedule_id')
    .single()

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: `This product already has a date on ${date}` }, { status: 409 })
    }
    console.error('add event error:', error)
    return NextResponse.json({ error: 'Failed to add date' }, { status: 500 })
  }
  return NextResponse.json({ event: { ...data, booking_count: 0 } }, { status: 201 })
}
