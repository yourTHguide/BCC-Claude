import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import {
  generateOccurrences,
  DEFAULT_HORIZON_WEEKS,
  type RecurrenceRule,
  type Weekday,
} from '@/lib/recurrence'

export const dynamic = 'force-dynamic'

// Schedule PREVIEW — computes the exact occurrence dates for a recurrence rule
// and returns them. It performs NO database writes and touches no tables of its
// own; the only DB access is requireAdmin()'s authorization READ. This is the
// seam Stage 4 will extend with an action:'generate' that materializes these
// same dates as Event Instances.
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner','admin'])
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let rule: RecurrenceRule
  if (body?.freq === 'once') {
    rule = { freq: 'once', date: String(body.date ?? '') }
  } else if (body?.freq === 'weekly') {
    rule = {
      freq: 'weekly',
      weekday: Number(body.weekday) as Weekday,
      startDate: String(body.startDate ?? ''),
      untilDate: body.untilDate ? String(body.untilDate) : null,
      horizonWeeks:
        body.horizonWeeks != null ? Number(body.horizonWeeks) : DEFAULT_HORIZON_WEEKS,
    }
  } else {
    return NextResponse.json({ error: 'Unknown recurrence type' }, { status: 400 })
  }

  const result = generateOccurrences(rule)
  return NextResponse.json(result)
}
