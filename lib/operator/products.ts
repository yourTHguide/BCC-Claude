// SNX Operator OS — Products / Experiences (Phase 2C). Server-only reads,
// same pattern as lib/operator/eventOps.ts and lib/operator/calendar.ts:
// getServiceSupabase() directly from Server Components, never from a
// 'use client' file. Every write goes through the EXISTING Product Admin API
// routes (see each client component) — this file only ports read logic out
// of app/api/admin/products/**/route.ts so the mobile surface reads the
// identical shape, not a second implementation.
//
// Scope note (SNX_PHASE2C_*): this is the canonical BCC/BNT Product Admin
// data, unchanged. "Brand" here is deliberately NOT a canonical model — it's
// the two real storefront-visibility booleans (visible_bcc/visible_bnt) that
// already exist. No brand table, no Flow Lab/YTG data, no operation-type
// field — none of that exists in the schema, so none of it is read here.
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday } from '@/lib/dates'
import { productMediaPublicUrl } from '@/lib/media'
import { getItemText, type ContentItem } from '@/lib/contentItems'

const PRODUCT_FIELDS =
  'id, slug, name, status, default_price, default_start_time, early_bird_price, early_bird_cutoff_hours, visible_bcc, visible_bnt, created_at, updated_at'

export interface ProductListRow {
  id: string
  slug: string
  name: string
  status: 'active' | 'draft' | 'archived'
  defaultPrice: number | null
  defaultStartTime: string | null
  visibleBcc: boolean
  visibleBnt: boolean
  coverUrl: string | null
}

// List + cover thumbnails in two queries total (not N+1) — same list the
// desktop Products page reads (PRODUCT_FIELDS unchanged), plus a single
// batched product_media lookup for grid-view thumbnails.
export async function getProductsList(): Promise<ProductListRow[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .order('created_at', { ascending: true })

  if (error || !data) {
    if (error) console.error('lib/operator/products getProductsList: query error:', error)
    return []
  }

  const ids = data.map((p: any) => p.id)
  const coverByProduct = new Map<string, string>()
  if (ids.length) {
    const { data: covers } = await supabase
      .from('product_media')
      .select('product_id, storage_path')
      .eq('kind', 'cover')
      .in('product_id', ids)
    for (const c of covers ?? []) {
      coverByProduct.set((c as any).product_id, productMediaPublicUrl((c as any).storage_path))
    }
  }

  return data.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    defaultPrice: p.default_price ?? null,
    defaultStartTime: p.default_start_time ?? null,
    visibleBcc: p.visible_bcc,
    visibleBnt: p.visible_bnt,
    coverUrl: coverByProduct.get(p.id) ?? null,
  }))
}

export interface ProductDetail {
  id: string
  slug: string
  name: string
  status: 'active' | 'draft' | 'archived'
  defaultPrice: number | null
  defaultStartTime: string | null
  earlyBirdPrice: number | null
  earlyBirdCutoffHours: number | null
  visibleBcc: boolean
  visibleBnt: boolean
  createdAt: string
  updatedAt: string | null
  coverUrl: string | null
  scheduleLabel: string
  events: { total: number; upcomingOpen: number; nextOpenDate: string | null }
}

// Display-only schedule-mode label, derived purely from the real
// product_schedules.freq values that already exist — never a stored/
// canonical field (SNX_PHASE2C plan, Refinement 3). Zero schedules reads as
// "Not configured" — a configuration-state description, not "On Request"
// (Refinement 2 — absence of a schedule is ambiguous, not a real product
// mode; a product can have real event_dates with zero product_schedules
// rows, e.g. older instances created before schedules existed).
export function deriveScheduleLabel(freqs: string[]): string {
  if (freqs.length === 0) return 'Not configured'
  const hasWeekly = freqs.includes('weekly')
  const hasOnce = freqs.includes('once')
  if (hasWeekly && hasOnce) return 'Mixed schedules'
  if (hasWeekly) return 'Recurring'
  return 'One-time'
}

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const supabase = getServiceSupabase()

  const { data: product, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('id', id)
    .maybeSingle()

  if (error || !product) {
    if (error) console.error('lib/operator/products getProductDetail: query error:', error)
    return null
  }

  const today = bangkokToday()
  const p = product as any

  const [{ data: cover }, { data: schedules }, { count: totalEvents }, { count: upcomingOpen }, { data: nextRow }] = await Promise.all([
    supabase.from('product_media').select('storage_path').eq('product_id', id).eq('kind', 'cover').maybeSingle(),
    supabase.from('product_schedules').select('freq').eq('product_id', id),
    supabase.from('event_dates').select('id', { count: 'exact', head: true }).eq('product_id', id),
    supabase.from('event_dates').select('id', { count: 'exact', head: true }).eq('product_id', id).eq('is_open', true).gte('event_date', today),
    supabase.from('event_dates').select('event_date').eq('product_id', id).eq('is_open', true).gte('event_date', today).order('event_date', { ascending: true }).limit(1).maybeSingle(),
  ])

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    defaultPrice: p.default_price ?? null,
    defaultStartTime: p.default_start_time ?? null,
    earlyBirdPrice: p.early_bird_price ?? null,
    earlyBirdCutoffHours: p.early_bird_cutoff_hours ?? null,
    visibleBcc: p.visible_bcc,
    visibleBnt: p.visible_bnt,
    createdAt: p.created_at,
    updatedAt: p.updated_at ?? null,
    coverUrl: cover ? productMediaPublicUrl((cover as any).storage_path) : null,
    scheduleLabel: deriveScheduleLabel((schedules ?? []).map((s: any) => s.freq)),
    events: {
      total: totalEvents ?? 0,
      upcomingOpen: upcomingOpen ?? 0,
      nextOpenDate: (nextRow as any)?.event_date ?? null,
    },
  }
}

export interface ProductContentData {
  productId: string
  tagline: string | null
  shortDescription: string | null
  fullDescription: string | null
  durationMinutes: number | null
  meetingPoint: { display_name?: string; address?: string; maps_url?: string; instructions?: string; visibility?: string }
  highlights: string[]
  itinerary: { title: string; description: string }[]
  whatsIncluded: string[]
  whatsNotIncluded: string[]
  importantInfo: string[]
}

function toStringList(items: ContentItem[] | null | undefined): string[] {
  return (items ?? []).map(getItemText)
}

// Same shape GET /api/admin/products/[id]/content returns (default empty
// shape if no row exists yet — no row is created by a read).
export async function getProductContent(id: string): Promise<ProductContentData> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('product_content')
    .select(
      'product_id, tagline, short_description, full_description, duration_minutes, meeting_point, highlights, itinerary, whats_included, whats_not_included, important_info'
    )
    .eq('product_id', id)
    .maybeSingle()

  if (error) console.error('lib/operator/products getProductContent: query error:', error)

  const c = (data as any) ?? {}
  return {
    productId: id,
    tagline: c.tagline ?? null,
    shortDescription: c.short_description ?? null,
    fullDescription: c.full_description ?? null,
    durationMinutes: c.duration_minutes ?? null,
    meetingPoint: c.meeting_point ?? {},
    highlights: toStringList(c.highlights),
    itinerary: c.itinerary ?? [],
    whatsIncluded: toStringList(c.whats_included),
    whatsNotIncluded: toStringList(c.whats_not_included),
    importantInfo: toStringList(c.important_info),
  }
}

export interface ProductInstanceRow {
  id: string
  eventDate: string
  isOpen: boolean
  bookingCount: number
}

// Same computation as app/api/admin/products/[id]/events/route.ts (booking
// counts across bookings + ota_bookings by night_slug+event_date) — ported,
// not re-derived. Used for Product Overview's inline instance context, not a
// second calendar (Calendar/Instances stays Phase 2B's module).
export async function getProductInstanceRows(id: string): Promise<ProductInstanceRow[]> {
  const supabase = getServiceSupabase()

  const { data: product } = await supabase.from('products').select('slug').eq('id', id).maybeSingle()
  if (!product) return []
  const nightSlug = (product as any).slug as string

  const { data: events, error } = await supabase
    .from('event_dates')
    .select('id, event_date, night_slug, is_open')
    .eq('product_id', id)
    .order('event_date', { ascending: true })

  if (error || !events) {
    if (error) console.error('lib/operator/products getProductInstanceRows: query error:', error)
    return []
  }

  const slugs = Array.from(new Set(events.map((e: any) => e.night_slug)))
  const key = (s: string, d: string) => `${s}|${d}`
  const counts: Record<string, number> = {}
  if (slugs.length) {
    for (const table of ['bookings', 'ota_bookings']) {
      const { data: bk } = await supabase.from(table).select('night_slug, event_date, quantity').in('night_slug', slugs)
      for (const b of bk ?? []) {
        const k = key((b as any).night_slug, (b as any).event_date)
        counts[k] = (counts[k] ?? 0) + ((b as any).quantity ?? 1)
      }
    }
  }

  return events.map((e: any) => ({
    id: e.id,
    eventDate: e.event_date,
    isOpen: e.is_open,
    bookingCount: counts[key(e.night_slug, e.event_date)] ?? 0,
  }))
}
