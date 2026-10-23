import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { listCaptions, setCaptionStatus } from '@/lib/captionStore'

export const dynamic = 'force-dynamic'

// Caption Library — read the shelf, and move a caption between Available and
// Used. Owner/admin only, same gate as the rest of /operator.

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  try {
    return NextResponse.json({ captions: await listCaptions() })
  } catch (error) {
    console.error('GET /api/admin/captions:', error)
    return NextResponse.json({ error: 'The caption shelf could not be opened.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown } | null
  if (!body || typeof body.id !== 'string' || (body.status !== 'available' && body.status !== 'used')) {
    return NextResponse.json({ error: 'A caption id and a valid status are required.' }, { status: 400 })
  }
  try {
    const caption = await setCaptionStatus(body.id, body.status)
    return caption
      ? NextResponse.json({ caption })
      : NextResponse.json({ error: 'Caption not found.' }, { status: 404 })
  } catch (error) {
    console.error('PATCH /api/admin/captions:', error)
    return NextResponse.json({ error: 'That change could not be saved.' }, { status: 500 })
  }
}
