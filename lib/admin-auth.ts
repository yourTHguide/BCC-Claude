import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase'

export type AdminRole = 'owner' | 'admin' | 'staff'
export interface AdminUser {
  userId: string
  role: AdminRole
  email: string | null
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
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) return { status: 'not_admin' }
  return {
    status: 'ok',
    admin: { userId: user.id, role: (adminRow as { role: AdminRole }).role, email: user.email ?? null },
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
