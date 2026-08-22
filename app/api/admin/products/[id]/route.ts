import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Today's date in Asia/Bangkok (YYYY-MM-DD), matching /api/events' availability
// cutoff so "upcoming" here means the same thing the storefront shows.
function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Read-only Product detail. Returns the canonical products row plus a small,
// derived Event-Instance summary (counts only — NO writes, NO schedule logic).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()

  const { data: product, error } = await supabase
    .from('products')
    .select(
      'id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, created_at, updated_at'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (error) {
    console.error('admin/products detail error:', error)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const today = bangkokToday()

  const { count: totalEvents } = await supabase
    .from('event_dates')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', params.id)

  const { count: upcomingOpen } = await supabase
    .from('event_dates')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', params.id)
    .eq('is_open', true)
    .gte('event_date', today)

  const { data: nextRow } = await supabase
    .from('event_dates')
    .select('event_date')
    .eq('product_id', params.id)
    .eq('is_open', true)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    product,
    events: {
      total: totalEvents ?? 0,
      upcomingOpen: upcomingOpen ?? 0,
      nextOpenDate: (nextRow as { event_date?: string } | null)?.event_date ?? null,
    },
  })
}

const PRODUCT_FIELDS =
  'id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, created_at, updated_at'
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

// Update the product-level operational defaults — default_price,
// default_start_time, visible_bcc, visible_bnt. Deliberately does NOT accept
// `status`: Draft<->Active stays exclusively behind the guarded
// activate/deactivate transitions (activate's visible_bcc=true requirement,
// deactivate's status='active' precondition) so this route can't be used to
// bypass them. Partial update — only keys present in the body are changed,
// exactly like PATCH /api/admin/events/[id] — so a caller that only wants to
// flip visible_bcc never has to resend price/time, and nothing here can wipe
// a sibling field the way a whole-row upsert could.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const patch: Record<string, any> = {}

  if ('defaultPrice' in body) {
    const v = body.defaultPrice
    if (v !== null && (!Number.isInteger(Number(v)) || Number(v) <= 0)) {
      return NextResponse.json(
        { error: 'Default price must be a positive whole number, or empty to clear it' },
        { status: 400 }
      )
    }
    patch.default_price = v === null ? null : Number(v)
  }

  if ('defaultStartTime' in body) {
    const v = body.defaultStartTime
    if (v !== null && !TIME_RE.test(String(v))) {
      return NextResponse.json(
        { error: 'Default start time must be HH:MM, or empty to clear it' },
        { status: 400 }
      )
    }
    patch.default_start_time = v === null ? null : String(v)
  }

  if ('visibleBcc' in body) {
    if (typeof body.visibleBcc !== 'boolean') {
      return NextResponse.json({ error: 'visibleBcc must be true/false' }, { status: 400 })
    }
    patch.visible_bcc = body.visibleBcc
  }

  if ('visibleBnt' in body) {
    if (typeof body.visibleBnt !== 'boolean') {
      return NextResponse.json({ error: 'visibleBnt must be true/false' }, { status: 400 })
    }
    patch.visible_bnt = body.visibleBnt
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('products')
    .update(patch)
    .eq('id', params.id)
    .select(PRODUCT_FIELDS)
    .maybeSingle()

  if (updateError) {
    console.error('admin/products patch error:', updateError)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ product: updated })
}
