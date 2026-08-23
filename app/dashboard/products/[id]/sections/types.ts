// Shared types for the Stage A section-based Product editor.
//
// This is the SAME shape the canonical `product_content` row and the
// `GET/PUT /api/admin/products/[id]/content` route already use (see
// ContentTab.tsx history / the route itself) — Stage A introduces no new
// fields, no new routes, no new data model.
//
// highlights/whats_included/whats_not_included/important_info are
// ContentItem[] (see lib/contentItems.ts) as of Stage 3 — each entry is
// either a plain string (all pre-existing data) or a {icon, text} object.
// Nothing here forces an upgrade to object form; that only happens when an
// admin assigns an icon to a specific item through ItemListEditor.

import type { ContentItem } from '@/lib/contentItems'

export interface ItineraryStep {
  title: string
  description: string
}

export interface MeetingPoint {
  display_name?: string
  address?: string
  maps_url?: string
  instructions?: string
  visibility?: 'public' | 'after_booking' | 'private' | ''
}

export interface ProductContent {
  product_id: string
  tagline: string | null
  short_description: string | null
  full_description: string | null
  duration_minutes: number | null
  meeting_point: MeetingPoint
  highlights: ContentItem[]
  itinerary: ItineraryStep[]
  whats_included: ContentItem[]
  whats_not_included: ContentItem[]
  important_info: ContentItem[]
  updated_at: string | null
}

export const EMPTY_CONTENT: ProductContent = {
  product_id: '',
  tagline: '',
  short_description: '',
  full_description: '',
  duration_minutes: null,
  meeting_point: {},
  highlights: [],
  itinerary: [],
  whats_included: [],
  whats_not_included: [],
  important_info: [],
  updated_at: null,
}

// Normalizes a raw API response's `content` object (which may be missing
// array/object fields entirely) into a fully-populated ProductContent so
// every section component can read its slice without null-checking.
export function normalizeContent(raw: any): ProductContent {
  return {
    ...EMPTY_CONTENT,
    ...raw,
    meeting_point: raw?.meeting_point ?? {},
    highlights: raw?.highlights ?? [],
    itinerary: raw?.itinerary ?? [],
    whats_included: raw?.whats_included ?? [],
    whats_not_included: raw?.whats_not_included ?? [],
    important_info: raw?.important_info ?? [],
  }
}

export interface MediaRow {
  id: string
  product_id: string
  kind: 'cover' | 'gallery'
  storage_path: string
  alt: string | null
  sort_order: number
  created_at: string
  url: string
}
