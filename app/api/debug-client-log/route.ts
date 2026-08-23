import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// TEMPORARY -- diagnosing the real-iPhone /dashboard/checkin/[token] crash
// (PHASE4_CHECKPOINT.md Stage 9). Public, unauthenticated, and deliberately
// so: the check-in flow can fail before or during auth, so this must accept
// a breadcrumb regardless of session state. Accepts any small JSON body and
// writes it to server (Vercel runtime) logs via console.error so it's
// visible without needing anything relayed back from the phone. No PII is
// intentionally sent here (see the call sites), but this is diagnostic-only
// and must be deleted once the real root cause is found -- never a
// permanent client-error-reporting endpoint.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    console.error('[CLIENT-DEBUG]', JSON.stringify(body))
  } catch (e) {
    console.error('[CLIENT-DEBUG] failed to parse body', e)
  }
  return new NextResponse(null, { status: 204 })
}
