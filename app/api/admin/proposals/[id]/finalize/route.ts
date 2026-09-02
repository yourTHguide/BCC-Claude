import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { finalizeProposal } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3F/3G: Finalize & Generate PDF. The ONLY route that ever assigns
// `version` — everything under PATCH /api/admin/proposals/[id] stays
// Working-Draft-only. actorUserId is always the server-resolved admin from
// the session, never anything the client could supply.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  // expectedDraftRevision is optional (the finalize call still works without
  // it) but the Preview screen always sends the revision it actually
  // rendered — see finalizeProposal()'s own doc comment for why this matters.
  let expectedDraftRevision: number | undefined
  try {
    const body = await req.json()
    if (typeof body?.expectedDraftRevision === 'number') expectedDraftRevision = body.expectedDraftRevision
  } catch {
    // No/invalid JSON body — proceed without the precondition; the CAS write itself still protects correctness.
  }

  try {
    const { proposal, alreadyFinalized } = await finalizeProposal(params.id, auth.admin.userId, expectedDraftRevision)
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
