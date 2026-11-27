// Phase 3D part 3b: guests use their credit — fully (no payment step) or
// partly (pay the difference at Stripe), credit held during checkout, refund
// on request, expiry. Real routes against the in-memory database.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.CHECKOUT_DYNAMIC_PRICING = 'true'
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const creditApi = await import('../app/api/credit/[token]/route.ts')
const creditBooking = await import('../app/api/credit-booking/route.ts')
const checkout = await import('../app/api/create-checkout/route.ts')
const webhook = await import('../app/api/webhook/route.ts')
const credits = await import('../app/api/admin/credits/route.ts')
const { runOptionTimers } = await import('../lib/bookingOptions.ts')

const TOKEN = 'tok_guest_aaaaaaaaaaaaaaaaaaaa'
const future = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10)
let db: FakeDb
let night: any
let credit: any
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [], refunds: [], coupons: [] }, __admin: undefined })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  night = db.insertRow('event_dates', { id: '66666666-6666-4666-8666-666666666666', product_id: 'p-bcc', event_date: future, night_slug: 'tgif', night_name: 'TGIF Bangkok', is_open: true, capacity: 12, price_override: null, start_time_override: null, operation_verdict: 'Pending' })
  const g = db.insertRow('guests', { id: 'g1', email: 'ann@example.test', name: 'Ann Lee', phone: '+66811111111' })
  const src = db.insertRow('bookings', { id: 'src', event_date: '2026-11-27', night_slug: 'tgif', status: 'cancelled', quantity: 2, total_paid: 2400, stripe_payment_id: 'pi_src', guest_id: g.id })
  db.insertRow('booking_options', { booking_id: src.id, guest_id: g.id, event_id: 'old', reason: 'night_short', token: TOKEN, status: 'resolved', resolution: 'credited' })
  credit = db.insertRow('guest_credits', { guest_id: g.id, amount: 2400, used_amount: 0, status: 'active', reason: 'night_short', source_booking_id: src.id, expires_at: new Date(Date.now() + 300 * 864e5).toISOString(), hold_key: null, hold_amount: null, hold_until: null })
})
async function post(handler: any, body: object) {
  const res: Response = await handler(new NextRequest('http://x', { method: 'POST', headers: { 'content-type': 'application/json', host: 'www.bkkclubcrawl.com' }, body: JSON.stringify(body) }))
  return { status: res.status, json: await res.json().catch(() => null) }
}

test('credit balance behind the personal link', async () => {
  const res: Response = await creditApi.GET(new NextRequest('http://x'), { params: { token: TOKEN } })
  assert.deepEqual(await res.json().then((j) => [j.available, j.firstName]), [2400, 'Ann'])
  const bad: Response = await creditApi.GET(new NextRequest('http://x'), { params: { token: 'nope' } })
  assert.equal((await bad.json()).available, 0)
})

test('credit covers it: booked with no payment step; credit used; ticket emailed; revenue counts the credit', async () => {
  const r = await post(creditBooking.POST, { token: TOKEN, eventId: night.id, quantity: 2 })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const b = db.tables.bookings.find((x) => x.source === 'credit')!
  assert.deepEqual([b.status, b.quantity, b.total_paid, b.credit_used, b.guest_email, b.event_date], ['confirmed', 2, 0, 2400, 'ann@example.test', future])
  assert.deepEqual([credit.used_amount, credit.status, credit.hold_key], [2400, 'used', null])
  assert.ok((globalThis as any).__mail.sent.some((m: any) => m.to === 'ann@example.test' && /You're booked — TGIF Bangkok/.test(m.subject)))
  assert.equal((globalThis as any).__stripe.sessions.length, 0, 'no Stripe')
  assert.ok(db.tables.guest_activity.some((a) => a.kind === 'credit_used'))
  // Spent: nothing left for another booking.
  assert.equal((await post(creditBooking.POST, { token: TOKEN, eventId: night.id, quantity: 1 })).json.needsCheckout, true)
})

test('credit covers part: pay the difference at Stripe; credit held during checkout, used on payment', async () => {
  credit.amount = 1200
  const r = await post(checkout.POST, { eventId: night.id, quantity: 2, creditToken: TOKEN })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.creditApplied, 1200)
  const s = (globalThis as any).__stripe.sessions[0]
  assert.deepEqual([s.line_items[0].price_data.unit_amount, s.discounts[0].coupon, s.allow_promotion_codes, s.customer_email], [120000, 'co_test_1', undefined, 'ann@example.test'])
  assert.equal((globalThis as any).__stripe.coupons[0].amount_off, 120000)
  assert.ok(credit.hold_key && credit.hold_until, 'held')
  // While held, a second checkout can't spend it again.
  const again = await post(checkout.POST, { eventId: night.id, quantity: 2, creditToken: TOKEN })
  assert.equal(again.json.creditApplied, undefined)

  const evt = { type: 'checkout.session.completed', data: { object: { id: 'cs_c1', payment_status: 'paid', amount_total: 120000, payment_intent: 'pi_c1', customer_details: { name: 'Ann Lee', email: 'ann@example.test' }, metadata: s.metadata, total_details: { amount_discount: 120000 } } } }
  const w: Response = await webhook.POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify(evt) }))
  assert.equal(w.status, 200)
  const b = db.tables.bookings.find((x) => x.stripe_session_id === 'cs_c1')!
  assert.deepEqual([b.total_paid, b.credit_used, b.discount_amount], [1200, 1200, 0])
  assert.deepEqual([credit.used_amount, credit.status, credit.hold_key], [1200, 'used', null])
})

test('checkout refuses when credit covers everything (the page books it directly)', async () => {
  const r = await post(checkout.POST, { eventId: night.id, quantity: 1, creditToken: TOKEN })
  assert.deepEqual([r.status, r.json.useCredit], [409, true])
})

test('owner refunds what is left to the card; not twice; not while held; expiry closes old credit', async () => {
  credit.used_amount = 1200
  const r = await post(credits.POST, { creditId: credit.id })
  assert.deepEqual([r.status, r.json.amount], [200, 1200])
  assert.deepEqual((globalThis as any).__stripe.refunds, [{ payment_intent: 'pi_src', amount: 120000 }])
  assert.equal(credit.status, 'refunded')
  assert.equal((await post(credits.POST, { creditId: credit.id })).status, 409)

  const c2 = db.insertRow('guest_credits', { guest_id: 'g1', amount: 500, used_amount: 0, status: 'active', reason: 'x', expires_at: new Date(Date.now() - 864e5).toISOString(), hold_key: 'k', hold_amount: 500, hold_until: new Date(Date.now() + 600_000).toISOString() })
  assert.equal((await post(credits.POST, { creditId: c2.id })).status, 409, 'checkout in progress')
  c2.hold_until = new Date(Date.now() - 1000).toISOString()
  const t = await runOptionTimers(db as any)
  assert.equal(t.expired, 1)
  assert.equal(c2.status, 'expired')
})
