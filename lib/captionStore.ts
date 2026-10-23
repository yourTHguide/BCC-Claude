import 'server-only'
import { getServiceSupabase } from '@/lib/supabase'
import {
  CAPTION_SCOPE,
  isCaptionCategory,
  uniqueCaptionTexts,
  type CaptionCategoryId,
  type CaptionRecord,
  type CaptionStatus,
} from '@/lib/captions'

// Caption Library persistence — public.captions via the service role (the
// table is RLS-on/no-policies, so this is the only way in). Every query is
// pinned to CAPTION_SCOPE so the shelf can never leak across products.

type Row = {
  id: string
  category_id: string
  text: string
  status: string
  created_at: string
  used_at: string | null
}

const COLUMNS = 'id, category_id, text, status, created_at, used_at'

function toRecord(row: Row): CaptionRecord {
  if (!isCaptionCategory(row.category_id) || (row.status !== 'available' && row.status !== 'used')) {
    throw new Error(`Caption ${row.id} has an invalid category or status`)
  }
  return {
    id: row.id,
    categoryId: row.category_id,
    text: row.text,
    status: row.status,
    createdAt: row.created_at,
    usedAt: row.used_at,
  }
}

function scoped() {
  return getServiceSupabase()
    .from('captions')
    .select(COLUMNS)
    .eq('venture_id', CAPTION_SCOPE.ventureId)
    .eq('city_id', CAPTION_SCOPE.cityId)
    .eq('product_id', CAPTION_SCOPE.productId)
}

export async function listCaptions(): Promise<CaptionRecord[]> {
  const { data, error } = await scoped().order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Row[]).map(toRecord)
}

export async function listCategoryCaptions(categoryId: CaptionCategoryId): Promise<CaptionRecord[]> {
  const { data, error } = await scoped().eq('category_id', categoryId).order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Row[]).map(toRecord)
}

export async function setCaptionStatus(id: string, status: CaptionStatus): Promise<CaptionRecord | null> {
  const { data, error } = await getServiceSupabase()
    .from('captions')
    .update({ status, used_at: status === 'used' ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('venture_id', CAPTION_SCOPE.ventureId)
    .eq('city_id', CAPTION_SCOPE.cityId)
    .eq('product_id', CAPTION_SCOPE.productId)
    .select(COLUMNS)
    .maybeSingle()
  if (error) throw error
  return data ? toRecord(data as Row) : null
}

// Adds new captions after near-duplicate filtering against the whole scope
// (every category, available and used). Returns only rows actually inserted.
export async function appendCaptions(
  categoryId: CaptionCategoryId,
  candidates: string[],
  limit: number
): Promise<CaptionRecord[]> {
  const { data: existingRows, error: existingError } = await getServiceSupabase()
    .from('captions')
    .select('text')
    .eq('venture_id', CAPTION_SCOPE.ventureId)
    .eq('city_id', CAPTION_SCOPE.cityId)
    .eq('product_id', CAPTION_SCOPE.productId)
  if (existingError) throw existingError

  const existing = ((existingRows ?? []) as Array<{ text: string }>).map((row) => row.text)
  const unique = uniqueCaptionTexts(candidates, existing).slice(0, Math.max(0, limit))
  if (unique.length === 0) return []

  const { data, error } = await getServiceSupabase()
    .from('captions')
    .upsert(
      unique.map((text) => ({
        venture_id: CAPTION_SCOPE.ventureId,
        city_id: CAPTION_SCOPE.cityId,
        product_id: CAPTION_SCOPE.productId,
        category_id: categoryId,
        text,
        status: 'available',
        source: 'generated',
      })),
      { onConflict: 'venture_id,city_id,product_id,text', ignoreDuplicates: true }
    )
    .select(COLUMNS)
  if (error) throw error
  return ((data ?? []) as Row[]).map(toRecord)
}
