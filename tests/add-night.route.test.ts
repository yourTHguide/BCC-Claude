// "Add a night" on the dashboard calendar + waitlist on any day (Nov 2026).
// Real route handlers; in-memory database; no network.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
delete process.env.BCC_SOLDOUT_WAITLIST
process.env.CHECKOUT_DYNAMIC_PRICING = 'true'
globalThis.fetch = (async () => {
  throw new Error('network is blocked in this test')
}) as typeof fetch

const dashEvents = await import('../app/api/admin/dashboard/events/route.ts')
const events = await import('../app/api/events/route.ts')
const soldOut = await import('../app/api/waitlist/sold-out/route.ts')
const checkout = await import('../app/api/create-checkout/route.ts')
const { specialNightSlug } = await import('../lib/bccNights.ts')

const P = 'p-bcc'
let db: FakeDb
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [] } })
  db.insertRow('products', { id: P, slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
})

const req = (url: string, method: string, body?: object) =>
  new NextRequest(url, { method, headers: { 'content-type': 'application/json', host: 'www.bkkclubcrawl.com' }, body: body ? JSON.stringify(body) : undefined })
async function call(handler: any, url: string, method = 'POST', body?: object) {
  const res: Response = await handler(req(url, method, body))
  return { status: res.status, json: await res.json().catch(() => null) }
}
const add = (body: object) => call(dashEvents.POST, 'http://localhost/api/admin/dashboard/events', 'POST', body)
const listed = async () => (await call(events.GET, 'http://localhost/api/events?storefront=bcc', 'GET')).json

// 2027-03-03 is a Wednesday, -05 Friday.
test('add a plain weekday night ON: defaults, stored like a scheduled night, and guests can see and buy it at ฿1,200', async () => {
  const r = await add({ date: '2027-03-03', type: 'club-crawl', isOpen: true })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  const e = r.json.event
  assert.deepEqual(
    [e.night_slug, e.night_name, e.product_id, e.is_open, e.capacity, e.price_override, e.start_time_override],
    ['club-crawl', 'BKK Club Crawl', P, true, 10, null, null]
  )
  const l = await listed()
  assert.deepEqual(l.events.map((x: any) => [x.eventDate, x.nightName, x.effectivePrice, x.remaining]), [['2027-03-03', 'BKK Club Crawl', 1200, 10]])

  const buy = await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: e.id, quantity: 2 })
  assert.equal(buy.status, 200)
  assert.equal((globalThis as any).__stripe.sessions[0].line_items[0].price_data.unit_amount, 120000)
})

test('OFF night is hidden from guests and cannot be bought; it still exists for the team', async () => {
  const r = await add({ date: '2027-03-03', type: 'club-crawl', isOpen: false })
  assert.equal(r.status, 201)
  assert.equal(r.json.event.is_open, false)
  assert.equal((await listed()).events.length, 0)
  const buy = await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: r.json.event.id, quantity: 1 })
  assert.equal(buy.status, 409)
  assert.equal(db.tables.event_dates.length, 1)
})

test('special theme night: own name and code, price/time overrides only when different', async () => {
  const r = await add({ date: '2027-03-03', type: 'special', name: '  Songkran   Splash Crawl ', priceThb: 1500, startTime: '20:00', capacity: 20, isOpen: true })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  const e = r.json.event
  assert.deepEqual([e.night_slug, e.night_name, e.price_override, e.start_time_override, e.capacity], ['songkran-splash-crawl', 'Songkran Splash Crawl', 1500, '20:00:00', 20])
  const l = await listed()
  assert.deepEqual([l.events[0].effectivePrice, l.events[0].effectiveStartTime], [1500, '20:00:00'])
  assert.equal(specialNightSlug('TGIF'), 'tgif-special', 'never collides with the fixed codes')
})

test('one Club Crawl night per date; past dates, bad input and missing names are refused', async () => {
  assert.equal((await add({ date: '2027-03-05', type: 'tgif', isOpen: true })).status, 201)
  const dup = await add({ date: '2027-03-05', type: 'special', name: 'Another', isOpen: true })
  assert.equal(dup.status, 409)
  assert.match(dup.json.error, /already has a Club Crawl night \(TGIF Bangkok, ON\)/)
  assert.ok(dup.json.existingId)
  assert.equal((await add({ date: '2020-01-01', type: 'club-crawl' })).status, 400)
  assert.equal((await add({ date: 'tomorrow', type: 'club-crawl' })).status, 400)
  assert.equal((await add({ date: '2027-03-04', type: 'special', name: ' ' })).status, 400)
  assert.equal((await add({ date: '2027-03-04', type: 'nope' })).status, 400)
  assert.equal((await add({ date: '2027-03-04', type: 'club-crawl', priceThb: -5 })).status, 400)
  assert.equal((await add({ date: '2027-03-04', type: 'club-crawl', startTime: '25:99' })).status, 400)
  assert.equal((await add({ date: '2027-03-04', type: 'club-crawl', capacity: 0 })).status, 400)
  assert.equal(db.tables.event_dates.length, 1)
})

test('waitlist works on any full night, including a weekday special night', async () => {
  const r = await add({ date: '2027-03-03', type: 'special', name: 'Midweek Madness', capacity: 2, isOpen: true })
  db.insertRow('bookings', { event_date: '2027-03-03', night_slug: r.json.event.night_slug, quantity: 2, status: 'confirmed', guest_email: 'x@example.test' })
  const l = await listed()
  assert.deepEqual(l.soldOut.map((n: any) => n.nightName), ['Midweek Madness'])
  const s = await call(soldOut.POST, 'http://localhost/api/waitlist/sold-out', 'POST', { eventId: r.json.event.id, name: 'Guest', email: 'g@example.test', partySize: 1, consent: true, elapsedMs: 5000 })
  assert.equal(s.status, 200, JSON.stringify(s.json))
  assert.match(db.tables.bnt_waitlist[0].consent_text, /Midweek Madness on Wednesday 3 March 2027/)
})
