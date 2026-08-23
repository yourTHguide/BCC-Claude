import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { resolveBookingByToken, ResolvedBooking } from '@/lib/bookingResolution'
import { formatBookingReference } from '@/lib/bookingReference'

export const dynamic = 'force-dynamic'

// QR check-in resolver (Stage 9d) — the reusable foundation any future SNX
// Event Operations UI calls, not something New in Bangkok or BCC own
// specially. GET resolves+previews (no mutation, safe to call from the
// ticket-lookup landing page before committing to a check-in). POST
// confirms. Both require an admin session — covered automatically by
// middleware.ts's existing `/api/admin/:path*` matcher, no middleware change
// needed. The token IS the credential; there is no separate booking-id
// lookup path here.
//
// MVP semantics, deliberately not exceeded here: `bookings.attendance_status`
// is one value per booking row, not per guest. A booking with quantity > 1
// checks in as a whole — there is no partial "2 of 3 guests" check-in.
// Building that would need a materially larger data-model change (a
// per-guest/per-seat table), which Stage 9 explicitly does not build. The
// `quantity` on the response is informational context for the host, not a
// counter this endpoint can partially decrement.

function toResponseShape(booking: ResolvedBooking, reference: string, alreadyCheckedIn: boolean) {
  return {
    booking: {
      id: booking.id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      quantity: booking.quantity,
      totalPaid: booking.totalPaid,
      status: booking.status,
      attendanceStatus: booking.attendanceStatus,
      reference,
    },
    event: {
      eventDate: booking.eventDate,
      startTime: booking.startTime,
    },
    product: {
      name: booking.productName,
      slug: booking.productSlug,
    },
    alreadyCheckedIn,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const booking = await resolveBookingByToken(supabase, params.token)
  if (!booking) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const reference = formatBookingReference(booking.productSlug, booking.id)
  return NextResponse.json(toResponseShape(booking, reference, booking.attendanceStatus === 'checked_in'))
}

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const booking = await resolveBookingByToken(supabase, params.token)
  if (!booking) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const reference = formatBookingReference(booking.productSlug, booking.id)

  if (booking.status === 'cancelled' || booking.status === 'refunded') {
    return NextResponse.json({ error: 'This booking was cancelled or refunded' }, { status: 409 })
  }

  // Repeat scan: idempotent, no side effect re-run — report the existing
  // state so the UI shows "Already checked in" instead of a fresh success.
  if (booking.attendanceStatus === 'checked_in') {
    return NextResponse.json(toResponseShape(booking, reference, true))
  }

  const { error } = await supabase
    .from('bookings')
    .update({ attendance_status: 'checked_in' })
    .eq('id', booking.id)

  if (error) {
    console.error('admin/checkin: update error:', error)
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 })
  }

  return NextResponse.json(
    toResponseShape({ ...booking, attendanceStatus: 'checked_in' }, reference, false)
  )
}
