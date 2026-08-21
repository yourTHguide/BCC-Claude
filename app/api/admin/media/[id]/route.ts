import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { PRODUCT_MEDIA_BUCKET_NAME, productMediaPublicUrl } from '@/lib/media'

export const dynamic = 'force-dynamic'

const MEDIA_FIELDS = 'id, product_id, kind, storage_path, alt, sort_order, created_at'

// Edit alt text and/or sort_order for ONE media row. Never touches the
// underlying file — replacing an image goes through POST (upload) + DELETE
// (remove the old one), not PATCH.
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
  if ('alt' in body) {
    if (body.alt !== null && typeof body.alt !== 'string') {
      return NextResponse.json({ error: 'alt must be a string or null' }, { status: 400 })
    }
    const t = typeof body.alt === 'string' ? body.alt.trim() : null
    patch.alt = t && t.length ? t : null
  }
  if ('sortOrder' in body) {
    const n = Number(body.sortOrder)
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json({ error: 'sortOrder must be a non-negative whole number' }, { status: 400 })
    }
    patch.sort_order = n
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('product_media')
    .update(patch)
    .eq('id', params.id)
    .select(MEDIA_FIELDS)
    .maybeSingle()

  if (error) {
    console.error('admin media PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  return NextResponse.json({ media: { ...data, url: productMediaPublicUrl((data as any).storage_path) } })
}

// Delete ONE media row + its underlying Storage object. Row is deleted FIRST:
// if the storage remove then fails, the result is a harmless orphaned object
// (tolerated); the reverse order could leave a row pointing at nothing.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const { data: row } = await supabase
    .from('product_media')
    .select('id, storage_path')
    .eq('id', params.id)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  const { error: deleteRowError } = await supabase.from('product_media').delete().eq('id', params.id)
  if (deleteRowError) {
    console.error('admin media DELETE row error:', deleteRowError)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }

  const { error: removeObjectError } = await supabase.storage
    .from(PRODUCT_MEDIA_BUCKET_NAME)
    .remove([(row as any).storage_path])
  if (removeObjectError) {
    console.error('admin media DELETE storage remove error:', removeObjectError)
  }

  return NextResponse.json({ deleted: true })
}
