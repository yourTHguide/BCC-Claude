import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { markProposalSent } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3H: records that the operator delivered the PDF to the partner
// themselves (WhatsApp/email/etc.) -- this route never sends anything.
// finalized -> sent only.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  try {
    const proposal = await markProposalSent(params.id)
    return NextResponse.json({ proposal })
  } catch (error) {
    console.error('POST /api/admin/proposals/[id]/mark-sent:', error)
    const message = error instanceof Error ? error.message : 'Failed to mark proposal as sent'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
