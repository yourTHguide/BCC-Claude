import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { createDraftFromFinalizedVersion } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3F/3G: "Create New Draft" from a Finalized Version. Creates a NEW
// row (same series_id, version NULL) — the id in the URL is the source
// Finalized Version, not the row being returned.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  try {
    const proposal = await createDraftFromFinalizedVersion(params.id)
    return NextResponse.json({ proposal })
  } catch (error) {
    console.error('POST /api/admin/proposals/[id]/new-draft:', error)
    const message = error instanceof Error ? error.message : 'Failed to create a new draft'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
