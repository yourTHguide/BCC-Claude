import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { resendFromHeader } from '@/lib/storefrontBrand'
import {
  SENT_MARKER,
  buildHalloweenEmail,
  loadHalloweenBookings,
  sentAtFromNotes,
  toRecipient,
} from '@/lib/halloweenEmail'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  try {
    const rows = await loadHalloweenBookings(getServiceSupabase())
    return NextResponse.json({
      adminEmail: auth.admin.email,
      recipients: rows.map(toRecipient),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// action 'test': one email for the chosen booking's QR, sent to the logged-in
//   admin instead of the guest, subject prefixed [TEST]. Marks nothing as sent.
// action 'send': real send to each requested booking's own email. Bookings
//   already marked sent are skipped unless `resend` is true.
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({}))
  const action = body.action as 'test' | 'send'
  const ids: string[] = Array.isArray(body.bookingIds) ? body.bookingIds : []
  if ((action !== 'test' && action !== 'send') || ids.length === 0) {
    return NextResponse.json({ error: 'action and bookingIds are required' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const all = await loadHalloweenBookings(supabase)
  const byId = new Map(all.map((b) => [b.id, b]))
  const from = resendFromHeader('bnt')
  const results: { id: string; name: string; ok: boolean; skipped?: string; error?: string }[] = []

  if (action === 'test') {
    if (!auth.admin.email) {
      return NextResponse.json({ error: 'Your admin account has no email address' }, { status: 400 })
    }
    const b = byId.get(ids[0])
    if (!b) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    const { subject, html } = buildHalloweenEmail(b)
    const { error } = await getResend().emails.send({
      from,
      to: auth.admin.email,
      subject: `[TEST] ${subject}`,
      html,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })
    return NextResponse.json({ ok: true, sentTo: auth.admin.email })
  }

  for (const id of ids) {
    const b = byId.get(id)
    if (!b) {
      results.push({ id, name: '?', ok: false, error: 'Booking not found' })
      continue
    }
    const name = b.guest_name || 'Guest'
    if (sentAtFromNotes(b.notes) && !body.resend) {
      results.push({ id, name, ok: true, skipped: 'already sent' })
      continue
    }
    if (!EMAIL_RE.test(b.guest_email || '')) {
      results.push({ id, name, ok: false, error: 'No valid email address' })
      continue
    }
    const { subject, html } = buildHalloweenEmail(b)
    const { error } = await getResend().emails.send({ from, to: b.guest_email, subject, html })
    if (error) {
      results.push({ id, name, ok: false, error: error.message })
      continue
    }
    const stamp = `[${SENT_MARKER} ${new Date().toISOString()}]`
    const cleaned = (b.notes || '').replace(new RegExp(`\\s*\\[${SENT_MARKER} [^\\]]+\\]`), '')
    await supabase.from('bookings').update({ notes: `${cleaned} ${stamp}`.trim() }).eq('id', id)
    results.push({ id, name, ok: true })
  }

  return NextResponse.json({ results })
}
