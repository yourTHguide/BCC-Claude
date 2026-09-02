import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { createProposal } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3E: creates the very first Working Draft of a new proposal "line" --
// mints series_id, leaves version NULL, generates a deterministic draft
// (lib/proposalGeneration.ts -- no hosted AI provider connected). This is
// the only proposal-creation route; Finalize & Generate PDF is not built.
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const partnerId = typeof body.partnerId === 'string' ? body.partnerId : ''
  if (!partnerId) return NextResponse.json({ error: 'partnerId is required' }, { status: 400 })

  const businessContexts: string[] = Array.isArray(body.businessContexts)
    ? body.businessContexts.filter((c: unknown) => typeof c === 'string' && c.trim()).map((c: string) => c.trim())
    : []
  if (businessContexts.length === 0) {
    return NextResponse.json({ error: 'At least one business context is required' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  try {
    const proposal = await createProposal({
      partnerId,
      dealId: typeof body.dealId === 'string' && body.dealId ? body.dealId : undefined,
      businessContexts,
      product: typeof body.product === 'string' && body.product.trim() ? body.product.trim() : undefined,
      title,
    })
    return NextResponse.json({ proposal }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/proposals:', error)
    return NextResponse.json({ error: 'Failed to create proposal draft' }, { status: 500 })
  }
}
