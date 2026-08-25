import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the Day Panel previously ran these three
// queries directly with the anon key (permissive public SELECT policies on
// bookings/ota_bookings/expenses — see PHASE4_CHECKPOINT.md's RLS audit).
// Same three filters/shapes, just behind requireAdmin() + the service role now.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const eventDate = searchParams.get('eventDate')
  const nightSlug = searchParams.get('nightSlug')
  if (!eventDate || !nightSlug) {
    return NextResponse.json({ error: 'eventDate and nightSlug are required' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const [b, o, e] = await Promise.all([
    supabase.from('bookings').select('*').eq('event_date', eventDate).eq('night_slug', nightSlug).eq('status', 'confirmed'),
    supabase.from('ota_bookings').select('*').eq('event_date', eventDate).eq('night_slug', nightSlug),
    supabase.from('expenses').select('*').eq('event_date', eventDate).eq('night_slug', nightSlug),
  ])

  if (b.error || o.error || e.error) {
    console.error('admin/dashboard/day-detail: query error:', b.error || o.error || e.error)
    return NextResponse.json({ error: 'Failed to load day detail' }, { status: 500 })
  }

  return NextResponse.json({
    bookings: b.data ?? [],
    otaBookings: o.data ?? [],
    expenses: e.data ?? [],
  })
}
