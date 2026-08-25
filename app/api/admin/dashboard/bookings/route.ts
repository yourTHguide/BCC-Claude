import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the owner dashboard's Bookings tab previously
// read bookings directly with the anon key (permissive public SELECT policy —
// see PHASE4_CHECKPOINT.md's RLS audit, which flags this table's guest
// PII/ticket_token exposure as critical). Same query/shape/order as that
// direct read, just behind requireAdmin() + the service role now.
export async function GET() {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('admin/dashboard/bookings: query error:', error)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
  return NextResponse.json({ bookings: data ?? [] })
}
