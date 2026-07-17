import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { generateCancellationEmail } from '@/emails/cancellation'

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
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: `Booking is already ${booking.status}` }, { status: 400 })
    }

    // ── Issue the Stripe refund first — if this fails, we don't want to mark
    // the booking cancelled and email the guest a refund promise we can't keep ──
    let refundId: string | null = null
    if (booking.stripe_payment_id) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: booking.stripe_payment_id,
        })
        refundId = refund.id
      } catch (refundErr: any) {
        console.error('Stripe refund error:', refundErr)
        return NextResponse.json({ error: `Refund failed: ${refundErr.message}` }, { status: 500 })
      }
    } else {
      console.warn(`Booking ${bookingId} has no stripe_payment_id — skipping refund, marking cancelled anyway`)
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        notes: `${booking.notes ? booking.notes + ' | ' : ''}Cancelled on ${new Date().toISOString()}${refundId ? ` — refunded via Stripe (${refundId})` : ' — no stripe_payment_id on file, refund not processed automatically'}`,
      })
      .eq('id', bookingId)

    if (updateError) {
      console.error('Cancel update error:', updateError)
      return NextResponse.json({ error: 'Refund processed but failed to update booking status — please check Supabase manually' }, { status: 500 })
    }

    if (booking.guest_email) {
      const emailHtml = generateCancellationEmail({
        guestName: booking.guest_name,
        nightName: booking.night_name,
        eventDate: booking.event_date,
        quantity: booking.quantity,
        totalPaid: booking.total_paid,
      })

      const { error: emailError } = await getResend().emails.send({
        from: `Bangkok Club Crawl <${process.env.RESEND_FROM}>`,
        to: booking.guest_email,
        subject: `Your booking has been cancelled — ${booking.night_name}`,
        html: emailHtml,
      })

      if (emailError) {
        console.error('Resend cancellation email error:', emailError)
        // Refund + DB update already succeeded — don't fail the request over email delivery
      }
    }

    return NextResponse.json({ success: true, refundId })
  } catch (err: any) {
    console.error('Cancel-booking route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
