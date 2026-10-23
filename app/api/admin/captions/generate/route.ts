import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { isCaptionCategory } from '@/lib/captions'
import { CaptionGenerationError, generateCaptions } from '@/lib/captionGeneration'

export const dynamic = 'force-dynamic'
// A free-tier Gemini call plus up to two fallbacks can take a while.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const body = (await req.json().catch(() => null)) as { categoryId?: unknown } | null
  if (!body || !isCaptionCategory(body.categoryId)) {
    return NextResponse.json({ error: 'A valid caption category is required.' }, { status: 400 })
  }

  try {
    const result = await generateCaptions(body.categoryId)
    return NextResponse.json({
      captions: result.inserted,
      inserted: result.inserted.length,
      requested: result.requested,
      model: result.model,
    })
  } catch (error) {
    console.error('POST /api/admin/captions/generate:', error instanceof Error ? error.message : error)
    const message = error instanceof CaptionGenerationError ? error.userMessage : 'Caption generation failed. Nothing was added.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
