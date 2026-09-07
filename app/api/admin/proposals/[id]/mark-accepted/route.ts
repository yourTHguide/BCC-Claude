import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { markProposalAccepted } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3H: records that the partner accepted this Finalized Version --
// this is a manual operator confirmation only, never an e-signature or
// acceptance link. sent -> accepted, stamps accepted_at, and (per the
// approved Deal-activation boundary) moves a linked 'terms_agreed' Deal to
// 'active' in the same server operation -- see markProposalAccepted's own
// doc comment for the exact rules.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  try {
    const proposal = await markProposalAccepted(params.id, auth.admin.userId)
    return NextResponse.json({ proposal })
  } catch (error) {
    console.error('POST /api/admin/proposals/[id]/mark-accepted:', error)
    const message = error instanceof Error ? error.message : 'Failed to mark proposal as accepted'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
