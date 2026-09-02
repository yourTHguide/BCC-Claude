import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { finalizeProposal } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3F/3G: Finalize & Generate PDF. The ONLY route that ever assigns
// `version` — everything under PATCH /api/admin/proposals/[id] stays
// Working-Draft-only. actorUserId is always the server-resolved admin from
// the session, never anything the client could supply.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  try {
    const { proposal, alreadyFinalized } = await finalizeProposal(params.id, auth.admin.userId)
    return NextResponse.json({ proposal, alreadyFinalized })
  } catch (error) {
    console.error('POST /api/admin/proposals/[id]/finalize:', error)
    const message = error instanceof Error ? error.message : 'Failed to finalize proposal'
    // The one expected, recoverable failure mode (draft changed mid-render)
    // gets its own status so the client can show a specific message instead
    // of a generic error.
    const status = message.startsWith('The draft changed since') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
