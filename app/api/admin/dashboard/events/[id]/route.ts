import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the owner dashboard's Day Panel (open/close
// toggle, host assignment, operations fields, host pay) previously wrote to
// event_dates directly with the anon key (permissive public UPDATE policy —
// see PHASE4_CHECKPOINT.md's RLS audit). Same fields, now behind
// requireAdmin() + the service role. Only this explicit allowlist is ever
// written — anything else in the body is ignored, matching what the old
// direct-client code actually sent (never anything outside this set).
//
// Deliberately a separate route from /api/admin/events/[id] (owner/admin-only
// isOpen/priceOverride/startTimeOverride/capacity editor for the Products/
// Schedule-Instances UI) — that route and its access scope are untouched by
// this migration.
const ALLOWED: Record<string, string> = {
  isOpen: 'is_open',
  hostAssigned: 'host_assigned',
  operationVerdict: 'operation_verdict',
  meetUpLocation: 'meet_up_location',
  whatsappGroupLink: 'whatsapp_group_link',
  venueRoute: 'venue_route',
  vanOrTaxiContact: 'van_or_taxi_contact',
  specialNotes: 'special_notes',
  hostFeeFinal: 'host_fee_final',
  hostPaymentStatus: 'host_payment_status',
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, any> = {}
  for (const [key, column] of Object.entries(ALLOWED)) {
    if (key in body) patch[column] = body[key]
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('event_dates')
    .update(patch)
    .eq('id', params.id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('admin/dashboard/events/[id]: update error:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  return NextResponse.json({ event: data })
}
