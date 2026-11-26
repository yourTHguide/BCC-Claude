// Stub: a signed-in admin. Defaults to the owner; a test can set
// globalThis.__admin = { userId, role, email, displayName } to act as a host.
import { NextResponse } from 'next/server'

const OWNER = { email: 'owner@example.test', userId: 'test-owner', role: 'owner', displayName: 'Guide' }
const current = () => (globalThis as any).__admin ?? OWNER

export async function requireAdmin() {
  return { admin: current() }
}
export async function requireRole(roles: string[]) {
  const admin = current()
  if (!roles.includes(admin.role)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { admin }
}
export async function getAdminUser() {
  return current()
}
