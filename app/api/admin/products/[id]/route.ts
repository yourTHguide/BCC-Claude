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
