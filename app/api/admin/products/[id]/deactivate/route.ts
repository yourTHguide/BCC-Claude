import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PRODUCT_FIELDS =
  'id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, created_at, updated_at'

// Return an Active product to Draft. Status-only: visibility flags, schedules,
// Event Instances and their overrides are all untouched, so re-activating
// later restores the exact same storefront configuration. /api/events and
// checkout both gate on products.status='active', so this alone is sufficient
// to make the product (and all its instances) invisible/unbookable again.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()

  const { data: product, error: readError } = await supabase
    .from('products')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (readError) {
    console.error('admin/products deactivate read error:', readError)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (product.status !== 'active') {
    return NextResponse.json({ error: 'Product is not Active' }, { status: 409 })
  }

  // Conditional on status='active' so a concurrent/duplicate deactivate
  // request loses the race cleanly (409) instead of silently double-applying.
  const { data: updated, error: updateError } = await supabase
    .from('products')
    .update({ status: 'draft' })
    .eq('id', params.id)
    .eq('status', 'active')
    .select(PRODUCT_FIELDS)
    .maybeSingle()

  if (updateError) {
    console.error('admin/products deactivate update error:', updateError)
    return NextResponse.json({ error: 'Failed to deactivate product' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json(
      { error: 'Product status changed before deactivation completed. Please retry.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ product: updated })
}
