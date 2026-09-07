import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import {
  updateProposalDraft,
  regenerateProposalDraft,
  requestProposalChanges,
  updateProposalDealVariables,
} from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3E: Working Draft actions only -- edit, regenerate, request changes,
// update deal variables. Every one of these is a plain UPDATE on the same
// row (lib/proposals.ts's assertStillDraft guard rejects any of them once
// version is no longer NULL); none of them ever assigns or increments
// `version`. Finalize & Generate PDF is a separate, not-yet-built action --
// no case for it exists here.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : ''

  try {
    switch (action) {
      case 'edit': {
        if (typeof body.draftContent !== 'string') {
          return NextResponse.json({ error: "Field 'draftContent' is required" }, { status: 400 })
        }
        const proposal = await updateProposalDraft(params.id, body.draftContent)
        return NextResponse.json({ proposal })
      }
      case 'regenerate': {
        const proposal = await regenerateProposalDraft(params.id)
        return NextResponse.json({ proposal })
      }
      case 'request-changes': {
        const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''
        if (!instruction) return NextResponse.json({ error: "Field 'instruction' is required" }, { status: 400 })
        const proposal = await requestProposalChanges(params.id, instruction)
        return NextResponse.json({ proposal })
      }
      case 'update-deal-variables': {
        if (!Array.isArray(body.dealVariables)) {
          return NextResponse.json({ error: "Field 'dealVariables' is required" }, { status: 400 })
        }
        const proposal = await updateProposalDealVariables(params.id, body.dealVariables)
        return NextResponse.json({ proposal })
      }
      default:
        return NextResponse.json({ error: `Unknown action '${action}'` }, { status: 400 })
    }
  } catch (error) {
    console.error('PATCH /api/admin/proposals/[id]:', error)
    const message = error instanceof Error ? error.message : 'Failed to update proposal'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
