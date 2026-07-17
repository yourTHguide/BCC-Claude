import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { generateRescheduleEmail } from '@/emails/reschedule'

// Lazily instantiated so importing this route doesn't run the Resend
// constructor during Next.js's build-time "collecting page data" step,
// which crashed the build when RESEND_API_KEY wasn't available there.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(req: NextRequest) {
  try {
    const { bookingId, newDate } = await req.json()

    if (!bookingId || !newDate) {
      return NextResponse.json({ error: 'Missing bookingId or newDate' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return NextResponse.json({ error: 'newDate must be in YYYY-MM-DD format' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: `Booking is ${booking.status}, not confirmed` }, { status: 400 })
    }

    const oldDate = booking.event_date

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        event_date: newDate,
        notes: `${booking.notes ? booking.notes + ' | ' : ''}Rescheduled from ${oldDate} to ${newDate} on ${new Date().toISOString()}`,
      })
      .eq('id', bookingId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    if (booking.guest_email) {
      const emailHtml = generateRescheduleEmail({
        guestName: booking.guest_name,
        nightName: booking.night_name,
        oldDate,
        newDate,
        quantity: booking.quantity,
        totalPaid: booking.total_paid,
      })

      const { error: emailError } = await getResend().emails.send({
        from: `Bangkok Club Crawl <${process.env.RESEND_FROM}>`,
        to: booking.guest_email,
        subject: `Your booking date has changed — ${booking.night_name}`,
        html: emailHtml,
      })

      if (emailError) console.error('Resend reschedule email error:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Reschedule-booking route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
