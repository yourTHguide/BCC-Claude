import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PRODUCT_FIELDS =
  'id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt, created_at, updated_at'

// Read-only Product list.
export async function GET() {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('admin/products list error:', error)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
  return NextResponse.json({ products: data ?? [] })
}

// Create a Product. Stage 4 is DRAFT-ONLY: status is always forced to 'draft'
// here — activation/publishing is a later stage. Authorization first, then the
// service-role client.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: 'Slug must be lowercase letters, numbers and hyphens' }, { status: 400 })
  }

  // default_price: null or a positive integer (THB whole units)
  let defaultPrice: number | null = null
  if (body.defaultPrice != null && body.defaultPrice !== '') {
    defaultPrice = Number(body.defaultPrice)
    if (!Number.isInteger(defaultPrice) || defaultPrice <= 0) {
      return NextResponse.json({ error: 'Default price must be a positive whole number' }, { status: 400 })
    }
  }

  // default_start_time: null or 'HH:MM' / 'HH:MM:SS'
  let defaultStartTime: string | null = null
  if (body.defaultStartTime) {
    defaultStartTime = String(body.defaultStartTime)
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(defaultStartTime)) {
      return NextResponse.json({ error: 'Invalid start time' }, { status: 400 })
    }
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      slug,
      status: 'draft', // Stage 4: never activate
      default_price: defaultPrice,
      default_start_time: defaultStartTime,
      visible_bcc: body.visibleBcc === true,
      visible_bnt: body.visibleBnt === true,
    })
    .select(PRODUCT_FIELDS)
    .single()

  if (error) {
    if ((error as any).code === '23505') {
      return NextResponse.json({ error: 'A product with this slug already exists' }, { status: 409 })
    }
    console.error('admin/products create error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
  return NextResponse.json({ product: data }, { status: 201 })
}
