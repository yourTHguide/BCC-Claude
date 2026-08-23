import { NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/appUrl'

export const dynamic = 'force-dynamic'

// TEMPORARY — same pattern as the diagnostic route Stage 9l used and
// deleted after confirming the getAppUrl() fix. Reports exactly what the QR
// endpoint's checkin URL will resolve to on THIS deployment, so it can be
// confirmed empirically (not just read from code) before handing Guide a
// link. Delete this route after use — never leave it in the codebase.
export async function GET() {
  return NextResponse.json({
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    resolvedAppUrl: getAppUrl(),
    exampleCheckinUrl: `${getAppUrl()}/dashboard/checkin/preview-test-alexchen-b7d2f4a19c3e0561`,
  })
}
