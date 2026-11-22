// Stub: a signed-in owner. The real requireRole needs a Supabase session.
export async function requireRole(_roles: string[]) {
  return { admin: { email: 'owner@example.test', userId: 'test-owner', role: 'owner' } }
}
export async function getAdminUser() {
  return { email: 'owner@example.test', userId: 'test-owner', role: 'owner' }
}
