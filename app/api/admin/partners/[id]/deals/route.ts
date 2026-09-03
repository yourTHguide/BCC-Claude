import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { createPartnerDeal, listPartnerDeals, type PartnerDealStatus } from '@/lib/partners'

export const dynamic = 'force-dynamic'

// Phase 3E: list + create Deals for one Partner, used by the Create ->
// Proposal setup wizard's "choose an existing Deal, or create a minimal new
// one" step. Deal editing (status changes, term edits) is not built here --
// only creation, per the approved scope.
const DEAL_STATUSES: PartnerDealStatus[] = ['discussing', 'terms_agreed', 'active', 'paused', 'ended']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const deals = await listPartnerDeals(params.id)
  return NextResponse.json({ deals })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const businessContexts: string[] = Array.isArray(body.businessContexts)
    ? body.businessContexts.filter((c: unknown) => typeof c === 'string' && c.trim()).map((c: string) => c.trim())
    : []
  if (businessContexts.length === 0) {
    return NextResponse.json({ error: 'At least one business context is required' }, { status: 400 })
  }

  const status: PartnerDealStatus | undefined = DEAL_STATUSES.includes(body.status) ? body.status : undefined

  try {
    const deal = await createPartnerDeal(
      params.id,
      {
        locationId: typeof body.locationId === 'string' && body.locationId ? body.locationId : undefined,
        businessContexts,
        product: typeof body.product === 'string' && body.product.trim() ? body.product.trim() : undefined,
        status,
      },
      auth.admin.userId
    )
    return NextResponse.json({ deal }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/partners/[id]/deals:', error)
    const message = error instanceof Error ? error.message : 'Failed to create deal'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
