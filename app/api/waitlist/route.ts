import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { EMAIL_RE, isMissingColumnError, recordAlert, sendLeadAlert } from '@/lib/bnt/leads'
import { buildWaitlistAlert } from '@/lib/bnt/leadEmails'
import { WAITLIST_CONSENT_SCOPE, WAITLIST_PRODUCTS } from '@/lib/bnt/waitlist'

// "Notify me when dates open" for BEST events with no open dates. Stores the
// email with the exact consent wording shown (consent_text) and its scope
// (new dates for this product only). Never touches products, event_dates,
// bookings or checkout. Announcements are sent only by an admin from
// /dashboard/leads after confirming dates — never from here.
//
// Response: { success, duplicate }. duplicate=true means this address was
// already on the list, so the page does not count it as a new lead.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Honeypot: real visitors never fill this hidden field. Pretend success.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ success: true, duplicate: true })
    }

    const product = WAITLIST_PRODUCTS[typeof body.product === 'string' ? body.product : '']
    if (!product) {
      return NextResponse.json({ error: 'This waitlist is not available.' }, { status: 400 })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) || null : null
    const supabase = getServiceSupabase()

    const { data: existing, error: lookupError } = await supabase
      .from('bnt_waitlist')
      .select('id, unsubscribed_at')
      .eq('product_slug', product.slug)
      .eq('email', email)
      .maybeSingle()

    if (lookupError && isMissingColumnError(lookupError)) {
      // Lead-operations migration not applied yet: behave exactly as Phase 3.
      const { error } = await supabase
        .from('bnt_waitlist')
        .upsert({ product_slug: product.slug, email, name, source: 'website' }, { onConflict: 'product_slug,email', ignoreDuplicates: true })
      if (error) {
        console.error('waitlist insert error:', error)
        return NextResponse.json({ error: 'We couldn’t save your email. Please try again.' }, { status: 500 })
      }
      await sendLeadAlert(buildWaitlistAlert({ id: '', product_slug: product.slug, email, name }))
      return NextResponse.json({ success: true, duplicate: false })
    }
    if (lookupError) {
      console.error('waitlist lookup error:', lookupError)
      return NextResponse.json({ error: 'We couldn’t save your email. Please try again.' }, { status: 500 })
    }

    const now = new Date().toISOString()
    let id: string

    if (existing && !existing.unsubscribed_at) {
      return NextResponse.json({ success: true, duplicate: true })
    }

    if (existing) {
      // Previously unsubscribed and signing up again: a fresh, explicit opt-in.
      const { error } = await supabase
        .from('bnt_waitlist')
        .update({
          unsubscribed_at: null,
          consent_scope: WAITLIST_CONSENT_SCOPE,
          consent_text: product.consentText,
          consented_at: now,
          name: name ?? undefined,
          alert_status: 'pending',
        })
        .eq('id', existing.id)
      if (error) {
        console.error('waitlist resubscribe error:', error)
        return NextResponse.json({ error: 'We couldn’t save your email. Please try again.' }, { status: 500 })
      }
      id = existing.id
    } else {
      const { data, error } = await supabase
        .from('bnt_waitlist')
        .insert({
          product_slug: product.slug,
          email,
          name,
          source: 'website',
          consent_scope: WAITLIST_CONSENT_SCOPE,
          consent_text: product.consentText,
          consented_at: now,
          alert_status: 'pending',
        })
        .select('id')
        .single()
      if (error?.code === '23505') return NextResponse.json({ success: true, duplicate: true }) // double-click race
      if (error || !data) {
        console.error('waitlist insert error:', error)
        return NextResponse.json({ error: 'We couldn’t save your email. Please try again.' }, { status: 500 })
      }
      id = data.id
    }

    const result = await sendLeadAlert(buildWaitlistAlert({ id, product_slug: product.slug, email, name }))
    await recordAlert(supabase, 'bnt_waitlist', id, result)

    return NextResponse.json({ success: true, duplicate: false })
  } catch (err) {
    console.error('waitlist server error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
