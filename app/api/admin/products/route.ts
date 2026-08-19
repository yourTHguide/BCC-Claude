import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

// Auth cookies + live DB → never cache.
export const dynamic = 'force-dynamic'

// Read-only Product list for the admin dashboard. Authorization is enforced by
// requireAdmin() (Stage 1) BEFORE any service-role access; the browser never
// touches Supabase directly.
export async function GET() {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, created_at, updated_at'
    )
    .order('created_at', { ascending: true })

  if (error) {
    console.error('admin/products list error:', error)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
  return NextResponse.json({ products: data ?? [] })
}
