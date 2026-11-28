import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { pendingRequests, resolveRequest } from '@/lib/selfService'

export const dynamic = 'force-dynamic'

// Owner: guests' move / credit requests made inside 7 days of the night.
// GET → pending requests. POST { id, approve: boolean, note? }.
export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  return NextResponse.json({ requests: await pendingRequests(getServiceSupabase()) })
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const r = await resolveRequest(getServiceSupabase(), String(body.id ?? ''), body.approve === true, auth.admin.displayName ?? auth.admin.email ?? 'owner', body.note ? String(body.note).slice(0, 300) : null)
  return NextResponse.json(r.body, { status: r.status })
}
