import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { updatePartnerDealStatus, type PartnerDealStatus } from '@/lib/partners'

export const dynamic = 'force-dynamic'

const DEAL_STATUSES: PartnerDealStatus[] = ['discussing', 'terms_agreed', 'active', 'paused', 'ended']

// Phase 3H: Deal lifecycle actions from Manage -> Partner Profile. The only
// write this route allows is `status` -- transition validity itself is
// enforced in lib/partners.ts's updatePartnerDealStatus() (DEAL_STATUS_
// TRANSITIONS), not duplicated here, so the same rule applies whether the
// call comes from an operator's direct click or the Proposal-acceptance
// auto-transition (markProposalAccepted).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status: PartnerDealStatus | undefined = DEAL_STATUSES.includes(body.status) ? body.status : undefined
  if (!status) return NextResponse.json({ error: `status must be one of ${DEAL_STATUSES.join(', ')}` }, { status: 400 })

  try {
    const deal = await updatePartnerDealStatus(params.id, status, auth.admin.userId)
    return NextResponse.json({ deal })
  } catch (error) {
    console.error('PATCH /api/admin/deals/[id]:', error)
    const message = error instanceof Error ? error.message : 'Failed to update deal status'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
