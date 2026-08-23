import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase'

export type AdminRole = 'owner' | 'admin' | 'staff'
export interface AdminUser {
  userId: string
  role: AdminRole
  email: string | null
  // Stage 9j (host RBAC foundation): used to match a 'staff' admin against
  // event_dates.host_assigned (a free-text name, e.g. 'Guide'/'Ice'/'Boom'/
  // 'JJ' — there is no FK between the two). This is a real but acknowledged
  // limitation: it's a case-sensitive string match, not a durable
  // relationship. Good enough to gate what a host can see today; a future
  // iteration should replace host_assigned with a proper user_id FK.
  displayName: string | null
}

type AdminResult =
  | { status: 'ok'; admin: AdminUser }
  | { status: 'no_session' }
  | { status: 'not_admin' }

// Core resolver: validate the Supabase Auth session, then confirm admin_users
// membership. The role lookup uses the service role so authorization never
// depends on client-supplied RLS context. The service role stays server-side.
async function resolveAdmin(): Promise<AdminResult> {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return { status: 'no_session' }

  const svc = getServiceSupabase()
  const { data: adminRow } = await svc
    .from('admin_users')
    .select('user_id, role, display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) return { status: 'not_admin' }
  const row = adminRow as { role: AdminRole; display_name: string | null }
  return {
    status: 'ok',
    admin: { userId: user.id, role: row.role, email: user.email ?? null, displayName: row.display_name },
  }
}

// For Server Components / layouts: returns the admin, or null (caller redirects).
export async function getAdminUser(): Promise<AdminUser | null> {
  const r = await resolveAdmin()
  return r.status === 'ok' ? r.admin : null
}

// For /api/admin/* route handlers: returns { admin } on success, or { response }
// (401 no session / 403 not admin) that the handler should return immediately.
export async function requireAdmin(): Promise<{ admin: AdminUser } | { response: NextResponse }> {
  const r = await resolveAdmin()
  if (r.status === 'ok') return { admin: r.admin }
  const status = r.status === 'no_session' ? 401 : 403
  return {
    response: NextResponse.json(
      { error: status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status }
    ),
  }
}

// Stage 9j — the smallest reusable role-gate: requireAdmin() plus a role
// allowlist, for the specific existing /api/admin/* routes that must stay
// owner/admin-only now that a 'staff' (Host) role can hold a real admin_users
// row (storefront/product configuration, destructive event/date actions).
// Returns 403 (not 401) for an authenticated admin whose role just isn't
// permitted here, distinct from "not an admin at all".
export async function requireRole(
  allowed: AdminRole[]
): Promise<{ admin: AdminUser } | { response: NextResponse }> {
  const r = await requireAdmin()
  if ('response' in r) return r
  if (!allowed.includes(r.admin.role)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return r
}
