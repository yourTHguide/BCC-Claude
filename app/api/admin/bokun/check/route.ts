import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { BokunError, bokunConfigured, bokunRequest } from '@/lib/bokun/client'
import { outline, summariseBooking } from '@/lib/bokun/inspect'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Bókun connection check (owner/admin, read-only, Nov 2026). Runs one
// booking search against Bókun with the deployment's keys and returns:
// the fields the sync will use (personal values reduced to initials, email
// type/domain and a masked phone), plus a value-free outline of the raw
// response. Saves nothing and changes nothing in Bókun or our database.
// The query is editable from /dashboard/bokun-check so the exact Bókun
// request shape can be confirmed without redeploying.
const ALLOWED_PATHS = ['/booking.json/booking-search']

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  if (!bokunConfigured()) return NextResponse.json({ error: 'BOKUN_ACCESS_KEY / BOKUN_SECRET_KEY are not set on this deployment.' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const path = typeof body.path === 'string' ? body.path : ALLOWED_PATHS[0]
  if (!ALLOWED_PATHS.includes(path)) return NextResponse.json({ error: 'Only booking search is allowed here.' }, { status: 400 })
  const query = body.query && typeof body.query === 'object' ? body.query : {}
  try {
    const res: any = await bokunRequest('POST', path, query)
    const items: any[] = Array.isArray(res?.items) ? res.items : Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : []
    return NextResponse.json({
      ok: true,
      totalHits: res?.totalHits ?? res?.total ?? items.length,
      returned: items.length,
      bookings: items.map(summariseBooking),
      responseOutline: outline(res, 5),
    })
  } catch (err) {
    if (err instanceof BokunError) return NextResponse.json({ ok: false, bokunStatus: err.status, bokunMessage: err.body }, { status: 502 })
    return NextResponse.json({ ok: false, error: String((err as Error)?.message || err) }, { status: 500 })
  }
}
