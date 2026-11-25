import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { resolveNightType } from '@/lib/bccNights'
import { bangkokToday } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the owner dashboard's calendar previously read
// event_dates directly with the anon key (permissive public SELECT policy —
// see PHASE4_CHECKPOINT.md's RLS audit). Same query/shape/order as that direct
// read, just behind requireAdmin() + the service role now.
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required (YYYY-MM-DD)' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('event_dates')
    .select('*')
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date')
    .order('is_open', { ascending: false })
    .order('created_at')

  if (error) {
    console.error('admin/dashboard/events: query error:', error)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }
  return NextResponse.json({ events: data ?? [] })
}

// Add one Bangkok Club Crawl night on any date (owner/admin only). Used by the
// dashboard calendar's "Add a night". Guests only see it when isOpen is true;
// an OFF night exists for the team only (e.g. to hold OTA bookings).
// One Club Crawl night per date. Price/time are stored as overrides only when
// they differ from the product's defaults, exactly like the NYE night.
const ISO = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))

  const date = String(body.date ?? '')
  if (!ISO.test(date)) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 })
  if (date < bangkokToday()) return NextResponse.json({ error: 'That date has already passed.' }, { status: 400 })
  const night = resolveNightType(String(body.type ?? ''), String(body.name ?? ''))
  if ('error' in night) return NextResponse.json({ error: night.error }, { status: 400 })

  const supabase = getServiceSupabase()
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, default_price, default_start_time')
    .eq('slug', BCC_PRODUCT_SLUG)
    .maybeSingle()
  if (productError || !product) return NextResponse.json({ error: 'Bangkok Club Crawl product not found.' }, { status: 500 })

  const price = body.priceThb === undefined || body.priceThb === null || body.priceThb === '' ? product.default_price : Number(body.priceThb)
  if (!Number.isInteger(price) || price < 1 || price > 100000) return NextResponse.json({ error: 'Price must be a whole number of baht.' }, { status: 400 })
  const time = body.startTime ? String(body.startTime) : String(product.default_start_time ?? '21:30').slice(0, 5)
  if (!TIME.test(time)) return NextResponse.json({ error: 'Start time must look like 21:30.' }, { status: 400 })
  const capacity = body.capacity === undefined || body.capacity === null || body.capacity === '' ? 12 : Number(body.capacity)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return NextResponse.json({ error: 'Capacity must be between 1 and 500.' }, { status: 400 })

  const { data: existing, error: existingError } = await supabase
    .from('event_dates')
    .select('id, night_name, is_open')
    .eq('event_date', date)
    .eq('product_id', product.id)
    .limit(1)
  if (existingError) return NextResponse.json({ error: 'Could not check the calendar. Try again.' }, { status: 503 })
  if (existing && existing.length) {
    const e = existing[0]
    return NextResponse.json(
      { error: `${date} already has a Club Crawl night (${e.night_name}, ${e.is_open ? 'ON' : 'OFF'}). Open it to change it.`, existingId: e.id },
      { status: 409 }
    )
  }

  const defaultTime = String(product.default_start_time ?? '').slice(0, 5)
  const { data, error } = await supabase
    .from('event_dates')
    .insert({
      event_date: date,
      night_slug: night.slug,
      night_name: night.name,
      product_id: product.id,
      schedule_id: null,
      is_open: body.isOpen === true,
      capacity,
      price_override: price === product.default_price ? null : price,
      start_time_override: time === defaultTime ? null : `${time}:00`,
    })
    .select('*')
    .single()
  if (error?.code === '23505') return NextResponse.json({ error: `${date} already has a ${night.name} night.` }, { status: 409 })
  if (error) {
    console.error('add night error:', error)
    return NextResponse.json({ error: 'Could not add the night. Try again.' }, { status: 500 })
  }
  console.log(`[calendar] ${auth.admin.email ?? auth.admin.userId} added ${night.name} on ${date} (${data.is_open ? 'ON' : 'OFF'})`)
  return NextResponse.json({ event: data }, { status: 201 })
}
