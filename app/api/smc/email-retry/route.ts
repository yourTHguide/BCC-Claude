import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { smcEnvironmentIssues } from '@/lib/smc/env'
import { dispatchSmcOutbox } from '@/lib/smc/outbox'

export const dynamic = 'force-dynamic'

// Scheduled email retry (called every few minutes by pg_cron — see
// supabase/production/cron_email_retry.sql and supabase/staging/). Sends any SMC email
// still pending. It never creates or changes bookings.
// Auth: "Authorization: Bearer <SMC_EMAIL_RETRY_SECRET>".

function authorized(req: NextRequest): boolean {
  const secret = process.env.SMC_EMAIL_RETRY_SECRET
  if (!secret || secret.length < 24) return false
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const issues = smcEnvironmentIssues()
  if (issues.length) {
    console.error('SMC email retry refused:', issues.join('; '))
    return NextResponse.json({ error: 'environment_not_ready' }, { status: 503 })
  }

  const result = await dispatchSmcOutbox(20)
  return NextResponse.json(result)
}
