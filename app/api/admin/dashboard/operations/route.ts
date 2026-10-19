import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getOperationsReport } from '@/lib/operations/report'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Operations Sheet data (BCC /dashboard Operations tab and BNT
// /operator/manage/operations). Revenue + host pay, so owner/admin only.
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') || ''
  const end = searchParams.get('end') || ''
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    return NextResponse.json({ error: 'start and end must be YYYY-MM-DD, start <= end' }, { status: 400 })
  }

  try {
    const rows = await getOperationsReport(start, end)
    return NextResponse.json({ rows })
  } catch (err) {
    console.error('admin/dashboard/operations: query error:', err)
    return NextResponse.json({ error: 'Failed to load operations' }, { status: 500 })
  }
}
