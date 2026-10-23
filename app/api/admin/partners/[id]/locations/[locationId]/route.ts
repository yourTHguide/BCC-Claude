import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { updatePartnerLocation } from '@/lib/partners'
import { LOCATION_LINK_FIELDS, normalizeLocationLink, type LocationLinks } from '@/lib/partnerLinks'

export const dynamic = 'force-dynamic'

// Venue links (Instagram / Facebook / TikTok / website / Google Maps) — the
// Edit Links form on the partner profile. Owner/admin only. Each field is
// normalised server-side; an empty field clears that link.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; locationId: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const body = (await req.json().catch(() => null)) as { links?: Record<string, unknown> } | null
  if (!body?.links || typeof body.links !== 'object') {
    return NextResponse.json({ error: 'No links provided.' }, { status: 400 })
  }

  const links: Partial<LocationLinks> = {}
  try {
    for (const field of LOCATION_LINK_FIELDS) {
      const raw = body.links[field.key]
      if (raw === undefined) continue
      if (raw !== null && typeof raw !== 'string') throw new Error(`${field.label} must be text.`)
      links[field.key] = normalizeLocationLink(field.key, raw)
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid link.' }, { status: 400 })
  }

  // The location must belong to the partner in the URL.
  const { data: owned } = await getServiceSupabase()
    .from('partner_locations')
    .select('id')
    .eq('id', params.locationId)
    .eq('partner_id', params.id)
    .maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Venue not found for this partner.' }, { status: 404 })

  try {
    const location = await updatePartnerLocation(params.locationId, { links })
    return NextResponse.json({ location })
  } catch (error) {
    console.error('PATCH /api/admin/partners/[id]/locations/[locationId]:', error)
    return NextResponse.json({ error: 'The links could not be saved.' }, { status: 500 })
  }
}
