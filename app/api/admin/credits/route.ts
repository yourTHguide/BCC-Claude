import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { logActivity } from '@/lib/guests'

export const dynamic = 'force-dynamic'

// Owner: refund what's left of a guest's credit to the card it came from
// (credit is refundable on request until used). POST { creditId }.
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const db = getServiceSupabase()
  const body = await req.json().catch(() => ({}))
  const { data: row } = await db.from('guest_credits').select('*').eq('id', String(body.creditId ?? '')).maybeSingle()
  const c = row as any
  if (!c) return NextResponse.json({ error: 'Credit not found.' }, { status: 404 })
  if (c.status !== 'active') return NextResponse.json({ error: `This credit is already ${c.status}.` }, { status: 409 })
  if (c.hold_until && Date.parse(c.hold_until) > Date.now()) return NextResponse.json({ error: 'The guest is using this credit at checkout right now. Try again in 30 minutes.' }, { status: 409 })
  const left = c.amount - c.used_amount
  const { data: src } = c.source_booking_id ? await db.from('bookings').select('stripe_payment_id').eq('id', c.source_booking_id).maybeSingle() : { data: null }
  const pi = (src as any)?.stripe_payment_id
  if (!pi) return NextResponse.json({ error: 'No card payment on file for this credit — refund it manually.' }, { status: 409 })
  // Claim first so two clicks can't refund twice.
  const { data: claimed } = await db.from('guest_credits').update({ status: 'refunded', resolved_at: new Date().toISOString() }).eq('id', c.id).eq('status', 'active').select('id')
  if (!claimed?.length) return NextResponse.json({ error: 'Already settled.' }, { status: 409 })
  try {
    const refund = await stripe.refunds.create({ payment_intent: pi, amount: left * 100 })
    await db.from('guest_credits').update({ note: [c.note, `refunded ฿${left} (${refund.id}) by ${auth.admin.email ?? auth.admin.userId}`].filter(Boolean).join('; ') }).eq('id', c.id)
    await logActivity(db, c.guest_id, 'credit_refunded', c.source_booking_id, { amount: left, refundId: refund.id })
    return NextResponse.json({ ok: true, amount: left })
  } catch (err: any) {
    await db.from('guest_credits').update({ status: 'active', resolved_at: null }).eq('id', c.id)
    console.error('credit refund failed', err)
    return NextResponse.json({ error: `Stripe refund failed: ${err?.message ?? 'unknown error'}` }, { status: 502 })
  }
}
