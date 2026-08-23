import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import {
  PRODUCT_MEDIA_BUCKET_NAME,
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_MEDIA_FILE_SIZE_BYTES,
  extensionForMime,
  productMediaPublicUrl,
} from '@/lib/media'

export const dynamic = 'force-dynamic'

const MEDIA_FIELDS = 'id, product_id, kind, storage_path, alt, sort_order, created_at'

function withUrl(row: any) {
  return { ...row, url: productMediaPublicUrl(row.storage_path) }
}

// List all media for a Product — cover first (kind 'cover' sorts before
// 'gallery' alphabetically), then gallery images ordered by sort_order.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('product_media')
    .select(MEDIA_FIELDS)
    .eq('product_id', params.id)
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('admin/products media GET error:', error)
    return NextResponse.json({ error: 'Failed to load media' }, { status: 500 })
  }
  return NextResponse.json({ media: (data ?? []).map(withUrl) })
}

// Upload ONE image (cover or gallery) for this Product. multipart/form-data:
// file (required), kind ('cover'|'gallery', default 'gallery'), alt (optional).
// Uploading a new cover REPLACES any existing one (old object + row removed
// first) — one cover per Product, also enforced by the DB's partial unique
// index as a backstop. Gallery uploads append to the end (max sort_order + 1).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const kindRaw = form.get('kind')
  const kind: 'cover' | 'gallery' = kindRaw === 'cover' ? 'cover' : 'gallery'

  const altRaw = form.get('alt')
  const alt = typeof altRaw === 'string' && altRaw.trim() ? altRaw.trim() : null

  if (!ALLOWED_MEDIA_MIME_TYPES.includes(file.type as any)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 })
  }
  const ext = extensionForMime(file.type)
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  if (kind === 'cover') {
    const { data: existingCover } = await supabase
      .from('product_media')
      .select('id, storage_path')
      .eq('product_id', params.id)
      .eq('kind', 'cover')
      .maybeSingle()

    if (existingCover) {
      const { error: removeErr } = await supabase.storage
        .from(PRODUCT_MEDIA_BUCKET_NAME)
        .remove([existingCover.storage_path])
      if (removeErr) {
        // Tolerated: an orphaned old object is a cheap failure mode; a cover
        // that can never be replaced is not.
        console.error('admin media cover replace: storage remove error:', removeErr)
      }
      const { error: deleteRowErr } = await supabase
        .from('product_media')
        .delete()
        .eq('id', existingCover.id)
      if (deleteRowErr) {
        console.error('admin media cover replace: row delete error:', deleteRowErr)
        return NextResponse.json({ error: 'Failed to replace cover image' }, { status: 500 })
      }
    }
  }

  let sortOrder = 0
  if (kind === 'gallery') {
    const { data: maxRow } = await supabase
      .from('product_media')
      .select('sort_order')
      .eq('product_id', params.id)
      .eq('kind', 'gallery')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    sortOrder = maxRow ? (maxRow as any).sort_order + 1 : 0
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const storagePath = `${params.id}/${kind}/${filename}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_MEDIA_BUCKET_NAME)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('admin media upload error:', uploadError)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }

  const { data: row, error: insertError } = await supabase
    .from('product_media')
    .insert({ product_id: params.id, kind, storage_path: storagePath, alt, sort_order: sortOrder })
    .select(MEDIA_FIELDS)
    .single()

  if (insertError) {
    console.error('admin media insert error:', insertError)
    // Row failed — don't leave the just-uploaded object orphaned if avoidable.
    await supabase.storage.from(PRODUCT_MEDIA_BUCKET_NAME).remove([storagePath])
    if ((insertError as any).code === '23505') {
      return NextResponse.json({ error: 'This product already has a cover image' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to save image record' }, { status: 500 })
  }

  return NextResponse.json({ media: withUrl(row) }, { status: 201 })
}
