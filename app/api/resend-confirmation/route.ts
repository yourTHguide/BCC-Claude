
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { generateConfirmationEmail } from '@/emails/confirmation'

// Lazily instantiated so importing this route doesn't run the Resend
// constructor during Next.js's build-time "collecting page data" step,
// which crashed the build when RESEND_API_KEY wasn't available there.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json()
    if (!bookingId) {
      return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })
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

    if (!booking.guest_email) {
      return NextResponse.json({ error: 'Booking has no guest email on file' }, { status: 400 })
    }

    const dateObj = new Date(booking.event_date + 'T00:00:00')
    const formattedDate = dateObj.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })

    const emailHtml = generateConfirmationEmail({
      guestName: booking.guest_name,
      nightName: booking.night_name,
      eventDate: booking.event_date,
      quantity: booking.quantity,
      totalPaid: booking.total_paid,
      promoCode: booking.promo_code || undefined,
    })

    const { error: emailError } = await getResend().emails.send({
      from: `Bangkok Club Crawl <${process.env.RESEND_FROM}>`,
      to: booking.guest_email,
      subject: `You're booked — ${booking.night_name} on ${formattedDate}`,
      html: emailHtml,
    })

    if (emailError) {
      console.error('Resend resend-confirmation error:', emailError)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Resend-confirmation route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
