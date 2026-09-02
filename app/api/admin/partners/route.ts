import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { createPartner, type PartnerOrganizationType, type RelationshipStatus } from '@/lib/partners'

export const dynamic = 'force-dynamic'

// Phase 3E: the one Partner write this phase needs -- creating a new Partner
// from the Create -> Proposal setup flow. Same requireRole gate as every
// other /api/admin/* write route. Contacts/Locations/full-Deal CRUD and
// relationship-note editing are explicitly deferred to a later phase.
const ORG_TYPES: PartnerOrganizationType[] = ['hospitality-group', 'venue', 'brand', 'agency', 'individual', 'other']
const STATUSES: RelationshipStatus[] = ['prospect', 'in-conversation', 'proposal-pending', 'active', 'paused', 'archived']

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (!displayName) return NextResponse.json({ error: 'Display name is required' }, { status: 400 })

  const organizationType: PartnerOrganizationType | undefined = ORG_TYPES.includes(body.organizationType) ? body.organizationType : undefined
  const relationshipStatus: RelationshipStatus | undefined = STATUSES.includes(body.relationshipStatus) ? body.relationshipStatus : undefined

  try {
    const partner = await createPartner({
      displayName,
      legalName: typeof body.legalName === 'string' && body.legalName.trim() ? body.legalName.trim() : undefined,
      organizationType,
      relationshipStatus,
      relationshipSummary: typeof body.relationshipSummary === 'string' && body.relationshipSummary.trim() ? body.relationshipSummary.trim() : undefined,
    })
    return NextResponse.json({ partner }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/partners:', error)
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 })
  }
}
