// Phase 3D vans: splitting guests into vans, the van setting and van 2
// controls, the 7 PM / 8 PM reminders and the booking-page message.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.CHECKOUT_DYNAMIC_PRICING = 'true'
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
process.env.VAN_REMINDER_SECRET = 'v'.repeat(32)
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const { splitVans, vanStatus, capacityFor, vanMessage } = await import('../lib/vans.ts')
const vans = await import('../app/api/admin/vans/[eventId]/route.ts')
const reminders = await import('../app/api/cron/van-reminders/route.ts')
const events = await import('../app/api/events/route.ts')
const checkout = await import('../app/api/create-checkout/route.ts')

const P = (id: string, quantity: number, createdAt: string) => ({ id, table: 'bookings' as const, quantity, createdAt })

test('split: booking order, groups never split, a group that does not fit van 1 goes to van 2', () => {
  const s = splitVans([P('a', 4, '1'), P('b', 5, '2'), P('c', 3, '3'), P('d', 1, '4'), P('e', 2, '5')], 2)
  assert.deepEqual([s.van1.map((p) => p.id), s.van1Guests], [['a', 'b', 'd'], 10])
  assert.deepEqual([s.van2.map((p) => p.id), s.van2Guests], [['c', 'e'], 5])
  const one = splitVans([P('a', 8, '1'), P('b', 4, '2')], 1)
  assert.deepEqual([one.van1Guests, one.over.map((p) => p.id)], [8, ['b']])
  const st = vanStatus(s, 2, 'open')
  assert.deepEqual([st.van1.ok, st.van2!.ok, st.needsDecision], [true, true, true], 'van 2 open with guests needs a decision')
  assert.equal(vanStatus(splitVans([P('a', 4, '1')], 2), 2, 'open').van1.ok, false, 'van 1 needs 5')
})

test('capacity follows the van setting; closing van 2 keeps sold seats and stops sales', () => {
  assert.deepEqual([capacityFor(null, 'open', 3), capacityFor(1, 'open', 3), capacityFor(2, 'open', 3)], [12, 10, 20])
  assert.deepEqual([capacityFor(2, 'closed', 13), capacityFor(2, 'closed', 6)], [13, 10])
})

test('booking page message: seats only when 4 or fewer left; van 2 unlock; never x/10', () => {
  assert.equal(vanMessage(2, 'open', 20, 3), null)
  assert.equal(vanMessage(2, 'open', 20, 7), '🔥 Only 3 spots left in Van 1')
  assert.equal(vanMessage(2, 'open', 20, 11), '🚐 Van 1 is full! Book your spot in Van 2 — just need 3 more and it’s on')
  assert.equal(vanMessage(2, 'open', 20, 13), '🚐 Van 1 is full! Book your spot in Van 2 — just need 1 more and it’s on')
  assert.equal(vanMessage(2, 'running', 20, 14), 'Van 2 is rolling! 🎉')
  assert.equal(vanMessage(2, 'open', 20, 17), 'Van 2 is rolling! 🎉 Only 3 spots left')
  assert.equal(vanMessage(null, 'open', 12, 10), '🔥 Only 2 spots left')
  assert.equal(vanMessage(null, 'open', 12, 2), null)
})

// ── Routes ──────────────────────────────────────────────────────────────
let db: FakeDb
let night: any
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
const future = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10)
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [] }, __admin: undefined })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  night = db.insertRow('event_dates', { id: '33333333-3333-4333-8333-333333333333', product_id: 'p-bcc', event_date: future, night_slug: 'tgif', night_name: 'TGIF Bangkok', is_open: true, capacity: 12, van_count: null, van2_state: 'open', price_override: null, start_time_override: null, operation_verdict: 'Pending', host_assigned: 'Ice' })
})
const ctx = { params: { eventId: '33333333-3333-4333-8333-333333333333' } }
async function call(handler: any, url: string, method = 'GET', body?: object, c?: any, headers: Record<string, string> = {}) {
  const res: Response = await handler(new NextRequest(url, { method, headers: { 'content-type': 'application/json', host: 'www.bkkclubcrawl.com', ...headers }, body: body ? JSON.stringify(body) : undefined }), c)
  return { status: res.status, json: await res.json().catch(() => null) }
}
const book = (qty: number, at: string, name = 'G') => db.insertRow('bookings', { event_date: night.event_date, night_slug: 'tgif', status: 'confirmed', quantity: qty, guest_name: name, created_at: at })

test('owner sets 2 vans → 20 seats; guests can buy past 12; Close van 2 stops sales, Run van 2 confirms', async () => {
  assert.equal((await call(vans.POST, 'http://x', 'POST', { action: 'set_vans', count: 2 }, ctx)).status, 200)
  assert.deepEqual([night.van_count, night.capacity], [2, 20])
  book(10, '2026-11-01T00:00:00Z', 'Ann'); book(2, '2026-11-02T00:00:00Z', 'Bob')
  const g = await call(vans.GET, 'http://x', 'GET', undefined, ctx)
  assert.deepEqual([g.json.status.van1.guests, g.json.status.van2.guests, g.json.status.van2.ok, g.json.split.van2[0].name], [10, 2, false, 'Bob'])

  const ev = await call(events.GET, 'http://localhost/api/events?storefront=bcc')
  assert.deepEqual([ev.json.events[0].remaining, ev.json.events[0].seatsMessage], [8, '🚐 Van 1 is full! Book your spot in Van 2 — just need 2 more and it’s on'])
  assert.equal((await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: night.id, quantity: 3 })).status, 200, 'seat 13–15 can be bought')

  assert.equal((await call(vans.POST, 'http://x', 'POST', { action: 'van2', state: 'closed' }, ctx)).status, 200)
  assert.deepEqual([night.van2_state, night.capacity], ['closed', 12], 'keeps the 12 sold, stops sales')
  assert.equal((await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: night.id, quantity: 1 })).status, 409)
  assert.equal((await call(vans.POST, 'http://x', 'POST', { action: 'van2', state: 'running' }, ctx)).status, 200)
  assert.deepEqual([night.van2_state, night.capacity], ['running', 20])

  assert.equal((await call(vans.POST, 'http://x', 'POST', { action: 'set_vans', count: null }, ctx)).status, 200)
  assert.deepEqual([night.van_count, night.capacity], [null, 12])
})

test('van controls are owner-only and Club Crawl only', async () => {
  ;(globalThis as any).__admin = { userId: 'h', role: 'staff', displayName: 'Ice' }
  assert.equal((await call(vans.POST, 'http://x', 'POST', { action: 'set_vans', count: 2 }, ctx)).status, 403)
  ;(globalThis as any).__admin = undefined
  night.product_id = 'p-other'
  db.insertRow('products', { id: 'p-other', slug: 'smc' })
  assert.equal((await call(vans.POST, 'http://x', 'POST', { action: 'set_vans', count: 2 }, ctx)).status, 409)
})

test('reminders: 7 PM summary for tonight once; 8 PM only when van 2 is open with guests; secret required', async () => {
  night.event_date = today
  night.van_count = 2; night.capacity = 20
  book(6, '2026-11-01T00:00:00Z'); book(5, '2026-11-02T00:00:00Z')
  const hit = (kind: string, auth = 'Bearer ' + 'v'.repeat(32)) => call(reminders.POST, `http://x/api/cron/van-reminders?kind=${kind}`, 'POST', {}, undefined, { authorization: auth })
  assert.equal((await hit('7pm', 'Bearer nope')).status, 401)

  const r7 = await hit('7pm')
  assert.deepEqual([r7.status, r7.json.sent], [200, 1])
  const mail = (globalThis as any).__mail.sent
  assert.match(mail[0].subject, /7 PM go \/ no-go/)
  assert.ok(mail[0].html.includes('Van 1: 6 guest(s) ✓ runs') && mail[0].html.includes('Van 2: 5 guest(s) ✓ enough'), mail[0].html)
  assert.equal((await hit('7pm')).json.sent, 0, 'once per night')

  const r8 = await hit('8pm')
  assert.equal(r8.json.sent, 1)
  assert.match(mail[1].subject, /8 PM reminder: decide Van 2/)
  night.van2_state = 'running'
  db.tables.van_reminders = []
  assert.equal((await hit('8pm')).json.sent, 0, 'no 8 PM reminder once van 2 is decided')
})
