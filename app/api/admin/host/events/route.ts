import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// Stage 9j — host RBAC foundation. Lists upcoming Event Instances a Host
// may operate. `requireAdmin()` (not requireRole) — any admin_users member,
// owner/admin/staff, may call this; the FILTER is what changes by role, not
// the auth gate itself.
//
// A 'staff' role is matched to event_dates.host_assigned by display_name —
// see the caveat on AdminUser.displayName in lib/admin-auth.ts. Owner/admin
// get the SAME actionable-only filtering as staff (see below) — this view
// IS "Host Operations", regardless of who's looking at it; an owner's full,
// unfiltered access to every event_dates row (open/closed, with or without
// bookings) stays on the existing /dashboard calendar, unchanged. Owner/
// admin skip only the host_assigned match, so they see every ACTIONABLE
// event rather than none — which doubles as this feature's own QA path: an
// owner can open /dashboard/host and click into any of them to see exactly
// the redacted view a real host would see, through the SAME code path.
//
// Stage 9k (round 2) — "actionable only": a closed date with zero bookings
// and no operational work in progress is noise for a host and is now
// excluded from this list entirely (not deleted, not hidden client-side —
// simply never returned). An event_dates row qualifies if ANY of:
//   • is_open = true (bookable, so still relevant to operate)
//   • event_date = today (Bangkok) — today's/live event, regardless of state
//   • operation_verdict has moved past the default 'Pending' (active
//     operational work — pre-confirmation, confirmed, cancelled/
//     rescheduled, completed, reviewed)
//   • has ≥1 real booking (website `bookings` or manually-entered
//     `ota_bookings`) for that (event_date, night_slug)
export async function GET() {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const today = bangkokToday()
  let query = supabase
    .from('event_dates')
    .select('id, event_date, night_name, night_slug, is_open, host_assigned, operation_verdict')
    .gte('event_date', today)
    .order('event_date', { ascending: true })

  if (auth.admin.role === 'staff') {
    query = query.eq('host_assigned', auth.admin.displayName ?? '__none__')
  }

  const { data, error } = await query
  if (error) {
    console.error('admin/host/events: query error:', error)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }

  const candidates = data ?? []
  if (candidates.length === 0) {
    return NextResponse.json({ events: [] })
  }

  // Booking counts per (event_date, night_slug) — a single pair of queries
  // across the whole candidate date range, not one query per event.
  const dates = Array.from(new Set(candidates.map((e: any) => e.event_date)))
  const [{ data: bookingRows }, { data: otaRows }] = await Promise.all([
    supabase.from('bookings').select('event_date, night_slug').eq('status', 'confirmed').in('event_date', dates),
    supabase.from('ota_bookings').select('event_date, night_slug').in('event_date', dates),
  ])
  const bookedKeys = new Set(
    [...(bookingRows ?? []), ...(otaRows ?? [])].map((b: any) => `${b.event_date}::${b.night_slug}`)
  )

  const actionable = candidates.filter((e: any) => {
    if (e.is_open) return true
    if (e.event_date === today) return true
    if (e.operation_verdict && e.operation_verdict !== 'Pending') return true
    if (bookedKeys.has(`${e.event_date}::${e.night_slug}`)) return true
    return false
  })

  return NextResponse.json({
    events: actionable.map((e: any) => ({
      id: e.id,
      eventDate: e.event_date,
      nightName: e.night_name,
      nightSlug: e.night_slug,
      isOpen: e.is_open,
    })),
  })
}
