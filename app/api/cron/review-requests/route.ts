import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getServiceSupabase } from '@/lib/supabase'
import { runReviewRequests } from '@/lib/reviewRequests'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily 2 PM Bangkok (pg_cron): review request emails for last night's
// checked-in website guests (lib/reviewRequests.ts).
// Auth: "Authorization: Bearer <OPS_CRON_SECRET>".
function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_CRON_SECRET
  if (!secret || secret.length < 24) return false
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runReviewRequests(getServiceSupabase()))
  } catch (err) {
    console.error('review requests error', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
