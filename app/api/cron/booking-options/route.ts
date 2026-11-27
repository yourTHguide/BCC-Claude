import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getServiceSupabase } from '@/lib/supabase'
import { runOptionTimers } from '@/lib/bookingOptions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Hourly (pg_cron): 24 h after the options email with no choice → reminder;
// 48 h → the money is kept as credit (refundable on request until used).
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
    return NextResponse.json(await runOptionTimers(getServiceSupabase()))
  } catch (err) {
    console.error('booking options timers error', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
