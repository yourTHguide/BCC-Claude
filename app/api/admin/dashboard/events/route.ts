import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the owner dashboard's calendar previously read
// event_dates directly with the anon key (permissive public SELECT policy —
// see PHASE4_CHECKPOINT.md's RLS audit). Same query/shape/order as that direct
// read, just behind requireAdmin() + the service role now.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
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
