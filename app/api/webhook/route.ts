import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { generateConfirmationEmail } from '@/emails/confirmation'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only handle successful payments
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as any
  const meta = session.metadata

  try {
    const supabase = getServiceSupabase()

    // ── Extract guest info from Stripe session ──
    const guestName = session.customer_details?.name || ''
    const guestEmail = session.customer_details?.email || ''
    const guestPhone = session.customer_details?.phone || ''
    const quantity = parseInt(meta.quantity || '1')
    const totalPaid = session.amount_total / 100 // Stripe stores in satang (smallest unit)
    // Note: Stripe uses smallest currency unit. For THB, 1 THB = 100 satang
    // so amount_total of 100000 = ฿1,000
    const promoCode = session.discounts?.[0]?.promotion_code
      ? (await stripe.promotionCodes.retrieve(session.discounts[0].promotion_code))?.code
      : null
    const discountAmount = session.total_details?.amount_discount
      ? session.total_details.amount_discount / 100
      : 0

    // ── Save booking to Supabase ──
    const { error: dbError } = await supabase
      .from('bookings')
      .insert({
        night_slug: meta.night_slug,
        night_name: meta.night_name,
        event_date: meta.event_date,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        guest_whatsapp: guestPhone, // same field — guest can update via WhatsApp
        quantity,
        price_per_person: Math.round((totalPaid + discountAmount) / quantity),
        total_paid: totalPaid,
        promo_code: promoCode,
        discount_amount: discountAmount,
        source: 'website',
        status: 'confirmed',
        stripe_session_id: session.id,
        stripe_payment_id: session.payment_intent,
      })

    if (dbError) {
      console.error('Supabase insert error:', dbError)
      // Don't fail the webhook — payment already processed
      // Log and continue to send email
    }

    // ── Send confirmation email via Resend ──
    const emailHtml = generateConfirmationEmail({
      guestName,
      nightName: meta.night_name,
      eventDate: meta.event_date,
      quantity,
      totalPaid,
      promoCode: promoCode || undefined,
    })

    const { error: emailError } = await resend.emails.send({
      from: `Bangkok Club Crawl <${process.env.RESEND_FROM}>`,
      to: guestEmail,
      subject: `You're booked — ${meta.night_name} on ${meta.formatted_date}`,
      html: emailHtml,
    })

    if (emailError) {
      console.error('Resend email error:', emailError)
    }

    // ── Notify Guide via email (internal alert) ──
    await resend.emails.send({
      from: `BCC Bookings <${process.env.RESEND_FROM}>`,
      to: process.env.RESEND_FROM!, // sends to bangkokclubcrawl@gmail.com
      subject: `New booking: ${meta.night_name} — ${meta.formatted_date} (${quantity} ticket${quantity > 1 ? 's' : ''})`,
      html: `
        <p><strong>New booking received</strong></p>
        <p>Night: ${meta.night_name}</p>
        <p>Date: ${meta.formatted_date}</p>
        <p>Guest: ${guestName}</p>
        <p>Email: ${guestEmail}</p>
        <p>Phone: ${guestPhone}</p>
        <p>Tickets: ${quantity}</p>
        <p>Total: ฿${totalPaid.toLocaleString()}</p>
        ${promoCode ? `<p>Promo code: ${promoCode}</p>` : ''}
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard">View Dashboard →</a></p>
      `,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Webhook processing error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Required: disable body parsing so Stripe signature works
export const config = {
  api: { bodyParser: false },
}
