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
// see every upcoming event (no assignment concept applies to them), which
// doubles as this feature's own QA path: an owner can open /dashboard/host
// and click into any event to see exactly the redacted view a real host
// would see, through the SAME code path — not a separate mock.
export async function GET() {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  let query = supabase
    .from('event_dates')
    .select('id, event_date, night_name, night_slug, is_open, host_assigned')
    .gte('event_date', bangkokToday())
    .order('event_date', { ascending: true })

  if (auth.admin.role === 'staff') {
    query = query.eq('host_assigned', auth.admin.displayName ?? '__none__')
  }

  const { data, error } = await query
  if (error) {
    console.error('admin/host/events: query error:', error)
    return NextResponse.json({ error: 'Failed to load events' }, { status: 500 })
  }

  return NextResponse.json({
    events: (data ?? []).map((e: any) => ({
      id: e.id,
      eventDate: e.event_date,
      nightName: e.night_name,
      nightSlug: e.night_slug,
      isOpen: e.is_open,
    })),
  })
}
