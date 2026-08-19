import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PRODUCT_FIELDS =
  'id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, created_at, updated_at'

// Publish a Draft product. BCC is the only storefront checkout currently
// enforces (app/api/create-checkout/route.ts gate 5 checks visible_bcc, not
// visible_bnt — there is no BNT checkout yet), so this workflow requires the
// resulting row to have visible_bcc=true. visible_bnt stays a stored,
// editable field for a future BNT storefront but is not enforced anywhere yet.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  let body: any = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    // Empty/absent body is fine — activation can rely on the product's
    // existing visibility flags.
  }

  const supabase = getServiceSupabase()

  const { data: product, error: readError } = await supabase
    .from('products')
    .select('id, status, visible_bcc, visible_bnt')
    .eq('id', params.id)
    .maybeSingle()

  if (readError) {
    console.error('admin/products activate read error:', readError)
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 })
  }
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (product.status !== 'draft') {
    return NextResponse.json({ error: 'Product is not in Draft status' }, { status: 409 })
  }

  const nextVisibleBcc = 'visibleBcc' in body ? Boolean(body.visibleBcc) : product.visible_bcc
  const nextVisibleBnt = 'visibleBnt' in body ? Boolean(body.visibleBnt) : product.visible_bnt

  if (nextVisibleBcc !== true) {
    return NextResponse.json(
      {
        error:
          'Publishing requires "Show on BCC" — BCC is the only storefront checkout currently supports.',
      },
      { status: 400 }
    )
  }

  // Conditional on status='draft' so a concurrent/duplicate activate request
  // loses the race cleanly (409) instead of silently double-applying.
  const { data: updated, error: updateError } = await supabase
    .from('products')
    .update({ status: 'active', visible_bcc: nextVisibleBcc, visible_bnt: nextVisibleBnt })
    .eq('id', params.id)
    .eq('status', 'draft')
    .select(PRODUCT_FIELDS)
    .maybeSingle()

  if (updateError) {
    console.error('admin/products activate update error:', updateError)
    return NextResponse.json({ error: 'Failed to activate product' }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json(
      { error: 'Product status changed before activation completed. Please retry.' },
      { status: 409 }
    )
  }

  return NextResponse.json({ product: updated })
}
