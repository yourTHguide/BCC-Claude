// Operator booking actions (Nov 2026): reschedule, cancel with Stripe /
// manual / no refund, move a whole event, email preview. Real route
// handlers; in-memory database; stub mail + Stripe; no network.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
globalThis.fetch = (async () => {
  throw new Error('network is blocked in this test')
}) as typeof fetch

const reschedule = await import('../app/api/reschedule-booking/route.ts')
const cancel = await import('../app/api/cancel-booking/route.ts')
const preview = await import('../app/api/booking-email-preview/route.ts')
const move = await import('../app/api/operator/events/[id]/move/route.ts')

let db: FakeDb
const mail = () => (globalThis as any).__mail.sent as any[]
const stripeState = () => (globalThis as any).__stripe

async function call(handler: any, url: string, body: object, ctx?: object) {
  const res: Response = await handler(new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx)
  return { status: res.status, json: await res.json().catch(() => null) }
}

let nov: any, dec: any, jan: any
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [], refunds: [] } })
  db.insertRow('products', { id: 'p-smc', slug: 'smc', name: 'Single Meet Club', status: 'active' })
  nov = db.insertRow('event_dates', { event_date: '2027-11-25', night_slug: 'smc', night_name: 'Single Meet Club', product_id: 'p-smc', is_open: true, capacity: 3, notes: null })
  dec = db.insertRow('event_dates', { event_date: '2027-12-09', night_slug: 'smc', night_name: 'Single Meet Club', product_id: 'p-smc', is_open: true, capacity: 2, notes: null })
  jan = db.insertRow('event_dates', { event_date: '2028-01-27', night_slug: 'smc', night_name: 'Single Meet Club', product_id: 'p-smc', is_open: true, capacity: 40, notes: null })
})

function booking(extra: object = {}) {
  return db.insertRow('bookings', {
    event_id: nov.id, event_date: nov.event_date, night_slug: 'smc', night_name: 'Single Meet Club', product_id: 'p-smc',
    guest_name: 'Pier Giorgio', guest_email: 'pg@example.test', quantity: 1, total_paid: 400, status: 'confirmed',
    booking_status: null, booked_for_date: null, storefront: 'bnt', stripe_payment_id: 'pi_1', payment_method: 'card', notes: null, ...extra,
  })
}

test('reschedule moves the booking, records the original date, and emails the owner\'s own words', async () => {
  const b = booking()
  const r = await call(reschedule.POST, 'http://x/api/reschedule-booking', { bookingId: b.id, newEventId: jan.id, message: 'We need a better mix of guests.\n\nSee you in January!' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.email, 'sent')
  const row = db.tables.bookings[0]
  assert.deepEqual([row.event_id, row.event_date, row.booking_status, row.booked_for_date], [jan.id, '2028-01-27', 'rescheduled', '2027-11-25'])
  assert.match(row.notes, /Rescheduled from 2027-11-25 to 2028-01-27/)
  const m = mail()[0]
  assert.equal(m.to, 'pg@example.test')
  assert.equal(m.reply_to, 'bestnightlifethailand@gmail.com')
  assert.match(m.html, /We need a better mix of guests\./)
  assert.match(m.html, /See you in January!/)
  assert.match(m.html, /Single <span[^>]*>Meet Club<\/span>/, 'SMC bookings get the SMC look')
  assert.match(m.html, /#F0444B/)
})

test('reschedule with notify off sends nothing; message HTML is escaped', async () => {
  const b = booking()
  const r = await call(reschedule.POST, 'http://x/api/reschedule-booking', { bookingId: b.id, newEventId: jan.id, notify: false })
  assert.equal(r.status, 200)
  assert.equal(r.json.email, 'skipped')
  assert.equal(mail().length, 0)
  const b2 = booking({ guest_email: 'x@example.test' })
  await call(reschedule.POST, 'http://x/api/reschedule-booking', { bookingId: b2.id, newEventId: jan.id, message: '<script>alert(1)</script>' })
  assert.doesNotMatch(mail()[0].html, /<script>/)
})

test('reschedule refuses a full night unless forced', async () => {
  booking({ guest_email: 'a@x.test' }); booking({ guest_email: 'b@x.test', event_id: dec.id, event_date: dec.event_date })
  const b = booking({ quantity: 2 })
  const r = await call(reschedule.POST, 'http://x/api/reschedule-booking', { bookingId: b.id, newEventId: dec.id })
  assert.equal(r.status, 409)
  assert.equal(r.json.overCapacity, true)
  assert.equal(r.json.remaining, 1)
  const forced = await call(reschedule.POST, 'http://x/api/reschedule-booking', { bookingId: b.id, newEventId: dec.id, force: true })
  assert.equal(forced.status, 200)
})

test('cancel + Stripe refund marks refunded with the refund id', async () => {
  const b = booking()
  const r = await call(cancel.POST, 'http://x/api/cancel-booking', { bookingId: b.id, refundMode: 'stripe', message: 'So sorry!' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual(stripeState().refunds, [{ payment_intent: 'pi_1' }])
  const row = db.tables.bookings[0]
  assert.deepEqual([row.status, row.booking_status], ['cancelled', 'refunded'])
  assert.match(row.notes, /refunded via Stripe \(re_test_1\)/)
  assert.match(mail()[0].html, /has been issued to your original payment method/)
})

test('Stripe refund failure changes nothing and suggests manual for PromptPay', async () => {
  const b = booking({ payment_method: 'promptpay' })
  stripeState().refundError = 'This payment method does not support refunds'
  const r = await call(cancel.POST, 'http://x/api/cancel-booking', { bookingId: b.id, refundMode: 'stripe' })
  assert.equal(r.status, 502)
  assert.match(r.json.error, /Refund manually/)
  assert.equal(db.tables.bookings[0].status, 'confirmed')
  assert.equal(mail().length, 0)
})

test('manual refund: cancels, records the note, no Stripe call; and can mark an already-cancelled booking refunded', async () => {
  const b = booking()
  const r = await call(cancel.POST, 'http://x/api/cancel-booking', { bookingId: b.id, refundMode: 'manual', refundNote: 'PromptPay transfer to guest', notify: false })
  assert.equal(r.status, 200)
  assert.equal(stripeState().refunds.length, 0)
  assert.match(db.tables.bookings[0].notes, /refunded manually — PromptPay transfer to guest/)
  assert.equal(db.tables.bookings[0].booking_status, 'refunded')

  const dk = booking({ status: 'cancelled' })
  const again = await call(cancel.POST, 'http://x/api/cancel-booking', { bookingId: dk.id, refundMode: 'manual', notify: false })
  assert.equal(again.status, 200)
  assert.equal(db.tables.bookings[1].booking_status, 'refunded')
  const twice = await call(cancel.POST, 'http://x/api/cancel-booking', { bookingId: dk.id, refundMode: 'manual' })
  assert.equal(twice.status, 400)
})

test('cancel with no refund keeps it out of "refunded" and the email does not promise money', async () => {
  const b = booking()
  const r = await call(cancel.POST, 'http://x/api/cancel-booking', { bookingId: b.id, refundMode: 'none' })
  assert.equal(r.status, 200)
  assert.deepEqual([db.tables.bookings[0].status, db.tables.bookings[0].booking_status], ['cancelled', null])
  assert.doesNotMatch(mail()[0].html, /Refund amount/)
})

test('legacy dashboard call (no refundMode, no payment id) still cancels without a refund', async () => {
  const b = booking({ stripe_payment_id: null })
  const r = await call(cancel.POST, 'http://x/api/cancel-booking', { bookingId: b.id })
  assert.equal(r.status, 200)
  assert.match(db.tables.bookings[0].notes, /refund not processed automatically/)
})

test('move event: date changes, every confirmed guest follows and is emailed, OTA guests follow', async () => {
  booking({ guest_name: 'A', guest_email: 'a@x.test' })
  booking({ guest_name: 'B', guest_email: null })
  booking({ guest_name: 'C', status: 'cancelled' })
  db.insertRow('ota_bookings', { event_date: nov.event_date, night_slug: 'smc', source: 'airbnb', guest_name: 'O', quantity: 1, booking_status: null, notes: null })
  const r = await call(move.POST, 'http://x/api/operator/events/x/move', { newDate: '2027-12-16', message: 'Moving to the 16th.' }, { params: { id: nov.id } })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual([r.json.moved, r.json.emailed, r.json.noEmail, r.json.otaMoved], [2, 1, ['B'], 1])
  assert.equal(db.tables.event_dates.find((e) => e.id === nov.id)!.event_date, '2027-12-16')
  const [a, b, c] = db.tables.bookings
  assert.deepEqual([a.event_date, b.event_date, c.event_date], ['2027-12-16', '2027-12-16', '2027-11-25'])
  assert.equal(db.tables.ota_bookings[0].event_date, '2027-12-16')
  assert.match(mail()[0].html, /Moving to the 16th\./)
})

test('move event refuses a date that already has the same product, and past dates', async () => {
  const clash = await call(move.POST, 'http://x', { newDate: dec.event_date }, { params: { id: nov.id } })
  assert.equal(clash.status, 409)
  const past = await call(move.POST, 'http://x', { newDate: '2020-01-01' }, { params: { id: nov.id } })
  assert.equal(past.status, 400)
})

test('preview renders without changing anything or sending', async () => {
  const b = booking()
  const r = await call(preview.POST, 'http://x', { action: 'cancel', bookingId: b.id, refundMode: 'manual', message: 'Hi!' })
  assert.equal(r.status, 200)
  assert.match(r.json.html, /refunding <strong[^>]*>฿400/)
  assert.equal(mail().length, 0)
  assert.equal(db.tables.bookings[0].status, 'confirmed')
})

test('non-SMC bookings keep the BEST / BCC look', async () => {
  const crawl = db.insertRow('event_dates', { event_date: '2027-12-03', night_slug: 'tgif', night_name: 'TGIF Bangkok', product_id: 'p-bcc', is_open: true, capacity: 20, notes: null })
  const crawl2 = db.insertRow('event_dates', { event_date: '2027-12-10', night_slug: 'tgif', night_name: 'TGIF Bangkok', product_id: 'p-bcc', is_open: true, capacity: 20, notes: null })
  const b = booking({ event_id: crawl.id, event_date: crawl.event_date, night_slug: 'tgif', night_name: 'TGIF Bangkok', product_id: 'p-bcc', storefront: 'bcc' })
  const r = await call(reschedule.POST, 'http://x', { bookingId: b.id, newEventId: crawl2.id })
  assert.equal(r.status, 200)
  assert.match(mail()[0].html, /BANGKOK CLUB CRAWL/)
  assert.doesNotMatch(mail()[0].html, /Meet Club<\/span>/)
})

test('only the owner can reschedule, cancel or move an event', async () => {
  const b = booking()
  ;(globalThis as any).__admin = { email: 'ice@example.test', userId: 'ice', role: 'admin', displayName: 'Ice' }
  try {
    assert.equal((await call(reschedule.POST, 'http://x', { bookingId: b.id, newEventId: jan.id })).status, 403)
    assert.equal((await call(cancel.POST, 'http://x', { bookingId: b.id, refundMode: 'none' })).status, 403)
    assert.equal((await call(move.POST, 'http://x', { newDate: '2027-12-16' }, { params: { id: nov.id } })).status, 403)
    assert.equal(db.tables.bookings[0].status, 'confirmed')
  } finally {
    delete (globalThis as any).__admin
  }
})
