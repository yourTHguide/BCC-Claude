import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getPartner } from '@/lib/partners'

export const dynamic = 'force-dynamic'

// Read-only: the Proposal Setup wizard uses this to load a selected existing
// partner's locations (for the "optional location" field on a new Deal).
// No write here -- Partner updates are not in scope for Phase 3E.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const partner = await getPartner(params.id)
  if (!partner) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  return NextResponse.json({ partner })
}
