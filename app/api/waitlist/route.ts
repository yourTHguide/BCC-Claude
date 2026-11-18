import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getServiceSupabase } from '@/lib/supabase'
import { resendFromHeader } from '@/lib/storefrontBrand'

// Phase 3 (Nov 2026): "notify me when dates open" for BEST events that have
// no open dates. Stores an email in bnt_waitlist and alerts the team. Does
// not touch products, event_dates, bookings or checkout.

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bestnightlifethailand@gmail.com'

// Only products that may collect a waitlist. Display names for the alert.
const WAITLIST_PRODUCTS: Record<string, string> = {
  'new-in-bkk': 'New in Bangkok',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHTML(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Honeypot: real visitors never fill this hidden field. Pretend success.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ success: true })
    }

    const product = typeof body.product === 'string' ? body.product : ''
    const productName = WAITLIST_PRODUCTS[product]
    if (!productName) {
      return NextResponse.json({ error: 'This waitlist is not available.' }, { status: 400 })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) || null : null

    const { error } = await getServiceSupabase()
      .from('bnt_waitlist')
      .upsert(
        { product_slug: product, email, name, source: 'website' },
        { onConflict: 'product_slug,email', ignoreDuplicates: true }
      )

    if (error) {
      console.error('waitlist insert error:', error)
      return NextResponse.json({ error: 'We couldn’t save your email. Please try again.' }, { status: 500 })
    }

    try {
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const { error: emailError } = await resend.emails.send({
          from: resendFromHeader('bnt'),
          to: ADMIN_EMAIL,
          subject: `Waitlist: ${productName} — ${email}`,
          html: `<p><strong>New waitlist sign-up</strong></p>
<p>Event: ${escapeHTML(productName)}<br>Name: ${escapeHTML(name || 'Not given')}<br>Email: ${escapeHTML(email)}</p>
<p style="color:#888">Saved in Supabase table bnt_waitlist.</p>`,
          text: `New waitlist sign-up\nEvent: ${productName}\nName: ${name || 'Not given'}\nEmail: ${email}`,
        })
        if (emailError) console.error('waitlist alert failed (non-blocking):', emailError)
      }
    } catch (emailErr) {
      console.error('waitlist alert dispatch failed (non-blocking):', emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('waitlist server error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
