import { createServerSupabase } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase'

export type AdminRole = 'owner' | 'admin' | 'staff'
export interface AdminUser {
  userId: string
  role: AdminRole
  email: string | null
}

// Authorization gate for /dashboard and /api/admin/* (Stage 1+).
//
// 1. Validates the Supabase Auth session from cookies (getUser() verifies the
//    JWT with the auth server — not just a decode).
// 2. Confirms the user has an admin_users row (created by Migration A / seeded
//    in the Supabase dashboard).
//
// Returns the admin on success, or null on failure — callers must respond
// 401/403 and touch NO data otherwise. The privileged work then uses
// getServiceSupabase() (service role) ONLY after this passes.
//
// Not imported anywhere yet — scaffolding for the Stage 1 auth boundary.
// admin_users does not exist in production until Migration A is applied; this
// module is never invoked until Stage 1 wires it into routes.
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  // Independent server-side role lookup via the service role, so authorization
  // never depends on client-supplied RLS context.
  const svc = getServiceSupabase()
  const { data: adminRow } = await svc
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!adminRow) return null
  return {
    userId: user.id,
    role: (adminRow as { role: AdminRole }).role,
    email: user.email ?? null,
  }
}
