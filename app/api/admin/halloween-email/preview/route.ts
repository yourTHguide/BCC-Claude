import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { buildHalloweenEmail, loadHalloweenBookings } from '@/lib/halloweenEmail'

export const dynamic = 'force-dynamic'

// Admin-only: the exact HTML a guest would receive, with their real QR. Sends nothing.
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const id = req.nextUrl.searchParams.get('bookingId')
  const rows = await loadHalloweenBookings(getServiceSupabase())
  const booking = rows.find((b) => b.id === id)
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  return new NextResponse(buildHalloweenEmail(booking).html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
