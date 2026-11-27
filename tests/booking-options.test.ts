// "Not enough guests" options, guest records and credit (Phase 3D part 3a).
// Real routes and lib against the in-memory database; Stripe and email stubs.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
process.env.OPS_CRON_SECRET = 'o'.repeat(32)
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const vans = await import('../app/api/admin/vans/[eventId]/route.ts')
const mine = await import('../app/api/my-booking/[token]/route.ts')
const timers = await import('../app/api/cron/booking-options/route.ts')
const webhook = await import('../app/api/webhook/route.ts')
const { runOptionTimers } = await import('../lib/bookingOptions.ts')

const future = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
let db: FakeDb
let night: any
let other: any
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [], refunds: [] }, __admin: undefined })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true })
  night = db.insertRow('event_dates', { id: '44444444-4444-4444-8444-444444444444', product_id: 'p-bcc', event_date: future(3), night_slug: 'tgif', night_name: 'TGIF Bangkok', is_open: true, capacity: 20, van_count: 2, van2_state: 'open', operation_verdict: 'Pending', price_override: null, start_time_override: null })
  other = db.insertRow('event_dates', { id: '55555555-5555-4555-8555-555555555555', product_id: 'p-bcc', event_date: future(10), night_slug: 'saturday-signature', night_name: 'Signature Night', is_open: true, capacity: 12, van_count: null, van2_state: 'open', operation_verdict: 'Pending', price_override: null, start_time_override: null })
  db.insertRow('bookings', { id: 'v1', event_date: night.event_date, night_slug: 'tgif', night_name: 'TGIF Bangkok', status: 'confirmed', quantity: 10, guest_name: 'Van One', guest_email: 'one@example.test', total_paid: 12000, stripe_payment_id: 'pi_v1', created_at: '2026-11-01T00:00:00Z' })
  db.insertRow('bookings', { id: 'b2', event_date: night.event_date, night_slug: 'tgif', night_name: 'TGIF Bangkok', status: 'confirmed', quantity: 2, guest_name: 'Ann Two', guest_email: 'Ann@Example.test', total_paid: 2400, stripe_payment_id: 'pi_b2', created_at: '2026-11-02T00:00:00Z' })
  db.insertRow('bookings', { id: 'b3', event_date: night.event_date, night_slug: 'tgif', night_name: 'TGIF Bangkok', status: 'confirmed', quantity: 1, guest_name: 'Bo Three', guest_email: 'bo@example.test', total_paid: 1200, stripe_payment_id: 'pi_b3', created_at: '2026-11-03T00:00:00Z' })
  db.insertRow('ota_bookings', { id: 'o1', event_date: night.event_date, night_slug: 'tgif', guest_name: 'Otto', source: 'airbnb', quantity: 1, created_at: '2026-11-04T00:00:00Z' })
})
const ctx = { params: { eventId: night?.id ?? '44444444-4444-4444-8444-444444444444' } }
async function call(handler: any, method: string, body?: object, c: any = { params: { eventId: '44444444-4444-4444-8444-444444444444' } }, headers: Record<string, string> = {}) {
  const res: Response = await handler(new NextRequest('http://x/y', { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }), c)
  return { status: res.status, json: await res.json().catch(() => null) }
}
const tok = (bookingId: string) => db.tables.booking_options.find((o) => o.booking_id === bookingId).token

test('van 2 short: one click emails only van 2 website guests (guest records made), closes van 2, lists OTA', async () => {
  const r = await call(vans.POST, 'POST', { action: 'send_options', reason: 'van2_short' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual(r.json.sent, ['Ann Two', 'Bo Three'])
  assert.deepEqual(r.json.ota.map((o: any) => o.name), ['Otto'])
  assert.deepEqual([night.van2_state, night.capacity], ['closed', 14])
  const mail = (globalThis as any).__mail.sent
  assert.equal(mail.length, 2)
  assert.match(mail[0].subject, /Change to your booking: TGIF Bangkok/)
  assert.ok(mail[0].html.includes('Van 2 didn’t reach the 4 guests') && mail[0].html.includes('/my-booking/'))
  assert.deepEqual(db.tables.guests.map((g) => g.email).sort(), ['ann@example.test', 'bo@example.test'])
  assert.equal(db.tables.bookings.find((b) => b.id === 'b2').guest_id, db.tables.guests.find((g) => g.email === 'ann@example.test').id)
  const again = await call(vans.POST, 'POST', { action: 'send_options', reason: 'van2_short' })
  assert.deepEqual([again.json.sent.length, again.json.skipped.length], [0, 2], 'never sent twice')
})

test('guest page: shows the booking and nights with room; refund choice → owner approves → Stripe refund', async () => {
  await call(vans.POST, 'POST', { action: 'send_options', reason: 'van2_short' })
  const t = tok('b2')
  const g = await call(mine.GET, 'GET', undefined, { params: { token: t } })
  assert.equal(g.status, 200)
  assert.deepEqual([g.json.reason, g.json.booking.nightName, g.json.booking.totalPaid], ['van2_short', 'TGIF Bangkok', 2400])
  const sig = g.json.dates.find((x: any) => x.date === other.event_date)
  assert.deepEqual([sig.kind, sig.nightName, sig.eventId], ['night', 'Signature Night', other.id], 'running nights are marked')
  assert.ok(!g.json.dates.some((x: any) => x.date === night.event_date), 'not the night they are leaving')
  const weekends = g.json.dates.filter((x: any) => x.kind === 'weekend')
  assert.ok(weekends.length >= 20 && weekends.every((x: any) => [5, 6].includes(new Date(x.date + 'T00:00:00Z').getUTCDay())), 'every Fri/Sat for 3 months')
  assert.equal(JSON.stringify(g.json).includes('ann@example'), false, 'no email on the public page')
  assert.equal((await call(mine.GET, 'GET', undefined, { params: { token: 'nope' } })).status, 404)

  assert.equal((await call(mine.POST, 'POST', { choice: 'bogus' }, { params: { token: t } })).status, 400)
  assert.equal((await call(mine.POST, 'POST', { choice: 'refund' }, { params: { token: t } })).status, 200)
  const opt = db.tables.booking_options.find((o) => o.token === t)
  assert.deepEqual([opt.status, opt.choice], ['chosen', 'refund'])

  const ok = await call(vans.POST, 'POST', { action: 'resolve', optionId: opt.id, resolution: 'refunded' })
  assert.equal(ok.status, 200, JSON.stringify(ok.json))
  assert.deepEqual((globalThis as any).__stripe.refunds, [{ payment_intent: 'pi_b2' }])
  const b = db.tables.bookings.find((x) => x.id === 'b2')
  assert.deepEqual([b.status, b.booking_status, opt.status, opt.resolution], ['cancelled', 'refunded', 'resolved', 'refunded'])
  assert.equal((await call(vans.POST, 'POST', { action: 'resolve', optionId: opt.id, resolution: 'credited' })).status, 409, 'settled once')
  assert.ok(db.tables.guest_activity.some((a) => a.kind === 'refunded' && a.booking_id === 'b2'))
})

test('move: the guest picks a night (or writes a preference) → owner approves → rescheduled', async () => {
  await call(vans.POST, 'POST', { action: 'send_options', reason: 'van2_short' })
  const t = tok('b3')
  assert.equal((await call(mine.POST, 'POST', { choice: 'move' }, { params: { token: t } })).status, 400, 'needs a date or a preference')
  assert.equal((await call(mine.POST, 'POST', { choice: 'move', note: 'any Saturday in January' }, { params: { token: t } })).status, 200)
  assert.equal((await call(mine.POST, 'POST', { choice: 'move', preferredDate: '2020-01-03' }, { params: { token: t } })).status, 400, 'only offered dates')
  assert.equal((await call(mine.POST, 'POST', { choice: 'move', preferredDate: other.event_date }, { params: { token: t } })).status, 200, 'can change the choice')
  const opt = db.tables.booking_options.find((o) => o.token === t)
  const r = await call(vans.POST, 'POST', { action: 'resolve', optionId: opt.id, resolution: 'moved' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const b = db.tables.bookings.find((x) => x.id === 'b3')
  assert.deepEqual([b.event_date, b.night_slug, b.booking_status, b.booked_for_date], [other.event_date, 'saturday-signature', 'rescheduled', night.event_date])
})

test('move to a weekend with no night yet: approval creates the night OFF and moves the guest', async () => {
  await call(vans.POST, 'POST', { action: 'send_options', reason: 'van2_short' })
  const t = tok('b2')
  const page = await call(mine.GET, 'GET', undefined, { params: { token: t } })
  const sat = page.json.dates.find((x: any) => x.kind === 'weekend' && new Date(x.date + 'T00:00:00Z').getUTCDay() === 6)
  assert.equal((await call(mine.POST, 'POST', { choice: 'move', preferredDate: sat.date }, { params: { token: t } })).status, 200)
  const opt = db.tables.booking_options.find((o) => o.token === t)
  assert.deepEqual([opt.preferred_event_id, opt.preferred_date], [null, sat.date])
  const r = await call(vans.POST, 'POST', { action: 'resolve', optionId: opt.id, resolution: 'moved' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const created = db.tables.event_dates.find((e) => e.event_date === sat.date)
  assert.deepEqual([created.night_slug, created.night_name, created.is_open], ['saturday-signature', 'Signature Night', false])
  assert.equal(db.tables.bookings.find((x) => x.id === 'b2').event_date, sat.date)
})

test('no reply: reminder after 24 h, credit after 48 h (booking cancelled without refund, credit valid 12 months)', async () => {
  await call(vans.POST, 'POST', { action: 'send_options', reason: 'night_short' })
  assert.equal(db.tables.booking_options.length, 3, 'whole night: all website guests')
  const now = Date.now()
  assert.equal((await call(timers.POST, 'POST', {}, undefined, { authorization: 'Bearer wrong' })).status, 401)
  let r = await runOptionTimers(db as any, new Date(now + 25 * 3600_000))
  assert.deepEqual(r, { reminded: 3, credited: 0, expired: 0 })
  r = await runOptionTimers(db as any, new Date(now + 26 * 3600_000))
  assert.deepEqual(r, { reminded: 0, credited: 0, expired: 0 }, 'reminded once')
  const mail = (globalThis as any).__mail.sent
  assert.ok(mail.some((m: any) => /Reminder: choose a refund or a new date/.test(m.subject)))

  r = await runOptionTimers(db as any, new Date(now + 49 * 3600_000))
  assert.deepEqual(r, { reminded: 0, credited: 3, expired: 0 })
  const c = db.tables.guest_credits.find((x) => x.source_booking_id === 'b2')
  assert.deepEqual([c.amount, c.status], [2400, 'active'])
  const months = (Date.parse(c.expires_at) - now) / (30.4 * 864e5)
  assert.ok(months > 11.5 && months < 12.5, String(months))
  const b = db.tables.bookings.find((x) => x.id === 'b2')
  assert.deepEqual([b.status, b.booking_status ?? null], ['cancelled', null], 'cancelled, not refunded')
  assert.equal((globalThis as any).__stripe.refunds.length, 0)
  assert.ok(mail.some((m: any) => /Your credit for TGIF Bangkok is ready/.test(m.subject) && m.html.includes('refund is still available')))
  const page = await call(mine.GET, 'GET', undefined, { params: { token: tok('b2') } })
  assert.deepEqual([page.json.status, page.json.resolution, page.json.credit], ['resolved', 'credited', 2400])
})

test('a new paid booking creates or reuses the guest record and logs it', async () => {
  db.insertRow('guests', { email: 'sam@example.test', name: 'Sam' })
  const evt = { type: 'checkout.session.completed', data: { object: { id: 'cs_g1', payment_status: 'paid', amount_total: 120000, payment_intent: 'pi_g1', customer_details: { name: 'Sam G', email: 'Sam@Example.test', phone: '+66800000000' }, metadata: { night_slug: 'tgif', night_name: 'TGIF Bangkok', event_date: night.event_date, quantity: '1', formatted_date: 'x' }, total_details: {} } } }
  const res: Response = await webhook.POST(new NextRequest('http://x/api/webhook', { method: 'POST', body: JSON.stringify(evt) }))
  assert.equal(res.status, 200)
  const b = db.tables.bookings.find((x) => x.stripe_session_id === 'cs_g1')
  assert.equal(b.guest_id, db.tables.guests.find((g) => g.email === 'sam@example.test').id)
  assert.equal(db.tables.guests.length, 1, 'reused, not duplicated')
  assert.ok(db.tables.guest_activity.some((a) => a.kind === 'booked' && a.booking_id === b.id))
})
