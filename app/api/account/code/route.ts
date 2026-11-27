import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { CODE_MINUTES, normalizeEmail, requestCode } from '@/lib/guestAuth'
import { sendEmail } from '@/lib/sendEmail'
import { brandFor, resendFromHeader } from '@/lib/storefrontBrand'
import { generateLoginCodeEmail, loginCodeSubject } from '@/emails/login-code'

export const dynamic = 'force-dynamic'

// POST { email } → emails a 6-digit sign-in code. The reply is the same
// whether or not we know the email.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })
  const db = getServiceSupabase()
  const r = await requestCode(db, email)
  if (r.status === 'limited') return NextResponse.json({ error: 'Too many codes asked for. Please try again in an hour.' }, { status: 429 })
  if (r.status === 'wait') return NextResponse.json({ error: `Please wait ${r.seconds} seconds before asking for a new code.` }, { status: 429 })
  if (r.status === 'sent') {
    const { error } = await sendEmail({
      from: resendFromHeader('bcc'), to: email, reply_to: brandFor('bcc').supportEmail,
      subject: loginCodeSubject(r.code), html: generateLoginCodeEmail(r.code, CODE_MINUTES),
    })
    if (error) {
      console.error('account code email failed', error)
      return NextResponse.json({ error: 'We couldn’t send the email just now. Please try again.' }, { status: 502 })
    }
  }
  return NextResponse.json({ ok: true })
}
