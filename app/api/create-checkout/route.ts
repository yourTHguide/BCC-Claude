import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPriceId, NIGHT_NAMES } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { nightSlug, eventDate, quantity } = await req.json()

    if (!nightSlug || !eventDate || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const nightName = NIGHT_NAMES[nightSlug] || nightSlug
    const priceId = getPriceId(nightSlug)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'

    // Format date nicely for Stripe description
    const dateObj = new Date(eventDate)
    const formattedDate = dateObj.toLocaleDateString('en', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',

      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],

      // Collect name, email, phone at checkout
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },

      // Allow promo codes (managed in Stripe dashboard)
      allow_promotion_codes: true,

      // Pass all booking data as metadata — retrieved in webhook
      metadata: {
        night_slug: nightSlug,
        night_name: nightName,
        event_date: eventDate,
        quantity: String(quantity),
        formatted_date: formattedDate,
      },

      // Pre-fill description so guest sees the night name
      custom_text: {
        submit: {
          message: `You're booking ${quantity} ticket${quantity > 1 ? 's' : ''} for ${nightName} on ${formattedDate}. Meet-up at 9:30 PM — location shared via WhatsApp by 7 PM.`,
        },
      },

      success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/book?night=${nightSlug}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
