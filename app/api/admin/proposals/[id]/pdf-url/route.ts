import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getProposalPdfUrl } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3F/3G: a fresh, short-lived signed URL for a finalized proposal's
// PDF — never a public URL, never persisted (Phase 3B §8). ?mode=download
// sets the Storage object's Content-Disposition so the browser saves the
// file instead of rendering it inline; default is view-in-tab.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const download = req.nextUrl.searchParams.get('mode') === 'download'

  try {
    const url = await getProposalPdfUrl(params.id, { download })
    return NextResponse.json({ url })
  } catch (error) {
    console.error('GET /api/admin/proposals/[id]/pdf-url:', error)
    const message = error instanceof Error ? error.message : 'Failed to get PDF URL'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
