import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { saveFeedback } from '@/lib/reviewRequests'

export const dynamic = 'force-dynamic'

// POST { text } — private feedback from the review email; emailed to the owner.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => ({}))
  const r = await saveFeedback(getServiceSupabase(), params.token, body.text)
  if (r.status === 404) return NextResponse.json({ error: 'This link is not valid.' }, { status: 404 })
  if (r.status === 400) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
