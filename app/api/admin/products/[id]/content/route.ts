import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MEETING_POINT_TEXT_KEYS = ['display_name', 'address', 'maps_url', 'instructions'] as const
const VISIBILITY_VALUES = ['public', 'after_booking', 'private']

type Result<T> = { value: T } | { error: string }

function validateTextField(v: any, label: string): Result<string | null> {
  if (v === undefined || v === null) return { value: null }
  if (typeof v !== 'string') return { error: `${label} must be a string` }
  const t = v.trim()
  return { value: t.length ? t : null }
}

function validateStringList(v: any, label: string): Result<string[]> {
  if (v === undefined || v === null) return { value: [] }
  if (!Array.isArray(v)) return { error: `${label} must be an array of strings` }
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== 'string') return { error: `${label} items must be strings` }
    const t = item.trim()
    if (t) out.push(t)
  }
  return { value: out }
}

function validateItinerary(v: any): Result<{ title: string; description: string }[]> {
  if (v === undefined || v === null) return { value: [] }
  if (!Array.isArray(v)) return { error: 'itinerary must be an array' }
  const out: { title: string; description: string }[] = []
  for (const item of v) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return { error: 'itinerary items must be objects with title/description' }
    }
    if (item.title !== undefined && typeof item.title !== 'string') {
      return { error: 'itinerary item title must be a string' }
    }
    if (item.description !== undefined && typeof item.description !== 'string') {
      return { error: 'itinerary item description must be a string' }
    }
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const description = typeof item.description === 'string' ? item.description.trim() : ''
    if (!title && !description) continue // drop a fully-empty row rather than persist it
    out.push({ title, description })
  }
  return { value: out }
}

function validateMeetingPoint(v: any): Result<Record<string, string>> {
  if (v === undefined || v === null) return { value: {} }
  if (typeof v !== 'object' || Array.isArray(v)) return { error: 'meetingPoint must be an object' }

  const unknown = Object.keys(v).find(
    (k) => !MEETING_POINT_TEXT_KEYS.includes(k as any) && k !== 'visibility'
  )
  if (unknown) return { error: `meetingPoint has an unknown field: ${unknown}` }

  const out: Record<string, string> = {}
  for (const key of MEETING_POINT_TEXT_KEYS) {
    const val = v[key]
    if (val === undefined || val === null || val === '') continue
    if (typeof val !== 'string') return { error: `meetingPoint.${key} must be a string` }
    const t = val.trim()
    if (t) out[key] = t
  }

  if (v.visibility !== undefined && v.visibility !== null && v.visibility !== '') {
    if (!VISIBILITY_VALUES.includes(v.visibility)) {
      return { error: `meetingPoint.visibility must be one of ${VISIBILITY_VALUES.join(', ')}` }
    }
    out.visibility = v.visibility
  }

  return { value: out }
}

const DEFAULT_CONTENT = {
  tagline: null,
  short_description: null,
  full_description: null,
  duration_minutes: null,
  meeting_point: {},
  highlights: [],
  itinerary: [],
  whats_included: [],
  whats_not_included: [],
  important_info: [],
  updated_at: null,
}

// Read-only Product Content. Returns the product_content row, or a default
// empty shape if none exists yet (no row is created by GET — only PUT creates
// one, via upsert).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('product_content')
    .select(
      'product_id, tagline, short_description, full_description, duration_minutes, ' +
        'meeting_point, highlights, itinerary, whats_included, whats_not_included, important_info, updated_at'
    )
    .eq('product_id', params.id)
    .maybeSingle()

  if (error) {
    console.error('admin/products content GET error:', error)
    return NextResponse.json({ error: 'Failed to load content' }, { status: 500 })
  }

  return NextResponse.json({ content: data ?? { product_id: params.id, ...DEFAULT_CONTENT } })
}

// Upsert the ONE product_content row for this Product (1:1). Only writes
// product_content — never touches products, event_dates, or any operational
// table. Does not change status/visibility; saving content never publishes.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tagline = validateTextField(body.tagline, 'tagline')
  if ('error' in tagline) return NextResponse.json({ error: tagline.error }, { status: 400 })

  const shortDescription = validateTextField(body.shortDescription, 'shortDescription')
  if ('error' in shortDescription) return NextResponse.json({ error: shortDescription.error }, { status: 400 })

  const fullDescription = validateTextField(body.fullDescription, 'fullDescription')
  if ('error' in fullDescription) return NextResponse.json({ error: fullDescription.error }, { status: 400 })

  let durationMinutes: number | null = null
  if (body.durationMinutes !== undefined && body.durationMinutes !== null && body.durationMinutes !== '') {
    const n = Number(body.durationMinutes)
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json(
        { error: 'durationMinutes must be a positive whole number, or empty to clear it' },
        { status: 400 }
      )
    }
    durationMinutes = n
  }

  const meetingPoint = validateMeetingPoint(body.meetingPoint)
  if ('error' in meetingPoint) return NextResponse.json({ error: meetingPoint.error }, { status: 400 })

  const highlights = validateStringList(body.highlights, 'highlights')
  if ('error' in highlights) return NextResponse.json({ error: highlights.error }, { status: 400 })

  const itinerary = validateItinerary(body.itinerary)
  if ('error' in itinerary) return NextResponse.json({ error: itinerary.error }, { status: 400 })

  const whatsIncluded = validateStringList(body.whatsIncluded, 'whatsIncluded')
  if ('error' in whatsIncluded) return NextResponse.json({ error: whatsIncluded.error }, { status: 400 })

  const whatsNotIncluded = validateStringList(body.whatsNotIncluded, 'whatsNotIncluded')
  if ('error' in whatsNotIncluded) return NextResponse.json({ error: whatsNotIncluded.error }, { status: 400 })

  const importantInfo = validateStringList(body.importantInfo, 'importantInfo')
  if ('error' in importantInfo) return NextResponse.json({ error: importantInfo.error }, { status: 400 })

  const { data, error } = await supabase
    .from('product_content')
    .upsert(
      {
        product_id: params.id,
        tagline: tagline.value,
        short_description: shortDescription.value,
        full_description: fullDescription.value,
        duration_minutes: durationMinutes,
        meeting_point: meetingPoint.value,
        highlights: highlights.value,
        itinerary: itinerary.value,
        whats_included: whatsIncluded.value,
        whats_not_included: whatsNotIncluded.value,
        important_info: importantInfo.value,
      },
      { onConflict: 'product_id' }
    )
    .select(
      'product_id, tagline, short_description, full_description, duration_minutes, ' +
        'meeting_point, highlights, itinerary, whats_included, whats_not_included, important_info, updated_at'
    )
    .single()

  if (error) {
    if ((error as any).code === '23503') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    console.error('admin/products content PUT error:', error)
    return NextResponse.json({ error: 'Failed to save content' }, { status: 500 })
  }

  return NextResponse.json({ content: data })
}
