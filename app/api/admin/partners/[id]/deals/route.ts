import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { createPartnerDeal, listPartnerDeals, type PartnerDealStatus } from '@/lib/partners'
import type { ProposalDealVariable } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3E: list + create Deals for one Partner, used by the Create ->
// Proposal setup wizard's "choose an existing Deal, or create a minimal new
// one" step. Deal editing (status changes) is not built here -- only
// creation (Phase 3F added terms, since Step 2 is now the real Deal
// workspace where commercial terms are entered), per the approved scope.
const DEAL_STATUSES: PartnerDealStatus[] = ['discussing', 'terms_agreed', 'active', 'paused', 'ended']

function parseTerms(value: unknown): ProposalDealVariable[] | undefined {
  if (!Array.isArray(value)) return undefined
  const parsed = value
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    .filter((v) => typeof v.key === 'string' && typeof v.label === 'string')
    .map((v) => ({
      key: v.key as string,
      label: v.label as string,
      value: typeof v.value === 'string' && v.value.trim() ? v.value.trim() : undefined,
      required: typeof v.required === 'boolean' ? v.required : undefined,
    }))
  return parsed.length > 0 ? parsed : undefined
}

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
  const terms = parseTerms(body.terms)

  try {
    const deal = await createPartnerDeal(
      params.id,
      {
        locationId: typeof body.locationId === 'string' && body.locationId ? body.locationId : undefined,
        businessContexts,
        product: typeof body.product === 'string' && body.product.trim() ? body.product.trim() : undefined,
        status,
        terms,
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
