import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getServiceSupabase } from '@/lib/supabase'
import { bokunConfigured } from '@/lib/bokun/client'
import { runBokunSync } from '@/lib/bokun/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Scheduled Bókun sync, called every 10 minutes by pg_cron (see
// supabase/production/cron_bokun_sync.sql). Shadow mode: it keeps a copy of
// Bókun's bookings and logs what it would do; it never changes nights,
// seats or OTA bookings.
// Auth: "Authorization: Bearer <BOKUN_SYNC_SECRET>" (24+ characters).

function authorized(req: NextRequest): boolean {
  const secret = process.env.BOKUN_SYNC_SECRET
  if (!secret || secret.length < 24) return false
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!bokunConfigured()) return NextResponse.json({ error: 'bokun_not_configured' }, { status: 503 })
  const result = await runBokunSync(getServiceSupabase(), 'schedule')
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
