import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

// Depends on the request's auth cookies + live DB state — never cache.
export const dynamic = 'force-dynamic'

// Returns the caller's admin identity, or 401 (no session) / 403 (not an admin).
// Also the first guarded /api/admin/* route, used to verify the auth boundary.
export async function GET() {
  const result = await requireAdmin()
  if ('response' in result) return result.response
  return NextResponse.json({
    authenticated: true,
    role: result.admin.role,
    email: result.admin.email,
  })
}
