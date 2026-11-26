// Phase 3C: host invite links and commission. Real route handlers (host
// invites, checkout, Stripe webhook, owner commission view) against the
// in-memory database; Stripe and email are stubs. No network.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
delete process.env.HOST_COMMISSION_THB
process.env.CHECKOUT_DYNAMIC_PRICING = 'true'
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const invites = await import('../app/api/admin/host/invites/route.ts')
const checkout = await import('../app/api/create-checkout/route.ts')
const webhook = await import('../app/api/webhook/route.ts')
const commissions = await import('../app/api/admin/host-commissions/route.ts')
const publicInvite = await import('../app/api/invite/[code]/route.ts')
const { commissionFor } = await import('../lib/hostInvites.ts')

const ICE = { userId: 'host-ice', role: 'staff', email: 'ice@example.test', displayName: 'Ice' }
const P = 'p-bcc'
const plus = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
let db: FakeDb
let night: any
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [] }, __admin: ICE })
  db.insertRow('products', { id: P, slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  night = db.insertRow('event_dates', { id: '11111111-1111-4111-8111-111111111111', product_id: P, event_date: plus(10), night_slug: 'tgif', night_name: 'TGIF Bangkok', is_open: true, capacity: 12, price_override: null, start_time_override: null, operation_verdict: 'Pending' })
})

const req = (url: string, method: string, body?: object) =>
  new NextRequest(url, { method, headers: { 'content-type': 'application/json', host: 'www.bkkclubcrawl.com' }, body: body ? JSON.stringify(body) : undefined })
async function call(handler: any, url: string, method = 'POST', body?: object, ctx?: any) {
  const res: Response = await handler(req(url, method, body), ctx)
  return { status: res.status, json: await res.json().catch(() => null) }
}
const create = (body: object) => call(invites.POST, 'http://localhost/api/admin/host/invites', 'POST', body)
const guest = { guestName: 'Sam Guest', guestEmail: 'Sam@Example.test', guestPhone: '+66 81 234 5678' }
const codeOf = (link: string) => link.split('/').pop()!

async function pay(code: string, opts: { qty?: number; email?: string; session?: string } = {}) {
  const r = await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: night.id, quantity: opts.qty ?? 2, inviteCode: code })
  if (r.status !== 200) return r
  const params = (globalThis as any).__stripe.sessions.at(-1)
  const evt = { type: 'checkout.session.completed', data: { object: {
    id: opts.session ?? `cs_${Math.random()}`, payment_status: 'paid', amount_total: (opts.qty ?? 2) * 120000, payment_intent: 'pi_1',
    customer_details: { name: 'Sam Guest', email: opts.email ?? 'sam@example.test', phone: '+66812345678' }, metadata: params.metadata, total_details: {},
  } } }
  const w: Response = await webhook.POST(new NextRequest('http://localhost/api/webhook', { method: 'POST', headers: { 'stripe-signature': 't' }, body: JSON.stringify(evt) }))
  return { status: w.status, json: await w.json(), params }
}

test('host creates a link: /with/<host>/<code>, 7 days, ฿150 snapshot; same guest+night gives the same link', async () => {
  const r = await create({ eventId: night.id, ...guest })
  assert.equal(r.status, 201, JSON.stringify(r.json))
  assert.match(r.json.link, /\/with\/ice\/[a-z0-9]{10}$/)
  const inv = db.tables.host_invites[0]
  assert.deepEqual([inv.host_user_id, inv.host_name, inv.guest_email, inv.commission_per_ticket, inv.used_at ?? null], ['host-ice', 'Ice', 'sam@example.test', 150, null])
  const days = (Date.parse(inv.expires_at) - Date.now()) / 864e5
  assert.ok(days > 6.9 && days <= 7, String(days))
  const again = await create({ eventId: night.id, ...guest })
  assert.deepEqual([again.status, again.json.reused, again.json.link], [200, true, r.json.link])
  assert.equal(db.tables.host_invites.length, 1)
})

test('refused: own email, bad input, a night not on sale or full', async () => {
  assert.equal((await create({ eventId: night.id, ...guest, guestEmail: 'ICE@example.test' })).status, 400)
  assert.equal((await create({ eventId: night.id, ...guest, guestEmail: 'nope' })).status, 400)
  assert.equal((await create({ eventId: night.id, ...guest, guestName: 'x' })).status, 400)
  assert.equal((await create({ eventId: night.id, ...guest, guestPhone: '12' })).status, 400)
  night.is_open = false
  assert.match((await create({ eventId: night.id, ...guest })).json.error, /not on sale/)
  night.is_open = true
  db.insertRow('bookings', { event_date: night.event_date, night_slug: 'tgif', quantity: 12, status: 'confirmed' })
  assert.match((await create({ eventId: night.id, ...guest })).json.error, /full/)
  assert.equal(db.tables.host_invites.length, 0)
})

test('guest pays through the link at the normal price → booking credited to the host, link used once', async () => {
  const code = codeOf((await create({ eventId: night.id, ...guest })).json.link)
  const info = await call(publicInvite.GET, `http://localhost/api/invite/${code}`, 'GET', undefined, { params: { code } })
  assert.deepEqual([info.json.valid, info.json.hostName, info.json.eventId, info.json.guestEmail], [true, 'Ice', night.id, undefined], 'no guest details on the public endpoint')

  const p = await pay(code, { qty: 3 })
  assert.equal(p.status, 200, JSON.stringify(p.json))
  assert.equal(p.params.line_items[0].price_data.unit_amount, 120000, 'normal ฿1,200')
  assert.equal(p.params.customer_email, 'sam@example.test', 'email the host entered is pre-filled')
  const booking = db.tables.bookings.find((b) => b.stripe_session_id)!
  const inv = db.tables.host_invites[0]
  assert.equal(booking.host_invite_id, inv.id)
  assert.equal(inv.booking_id, booking.id)
  assert.ok(inv.used_at)

  // The same link can't start a second checkout.
  const second = await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: night.id, quantity: 1, inviteCode: code })
  assert.equal(second.status, 409)
  assert.match(second.json.error, /already been used/)
})

test('webhook retry, second payment on a claimed link, and the host paying themselves are never credited', async () => {
  const code = codeOf((await create({ eventId: night.id, ...guest })).json.link)
  // Host pays with their own email: saved as a normal booking, link stays open.
  const self = await pay(code, { email: 'ice@example.test', session: 'cs_self' })
  assert.equal(self.status, 200)
  assert.equal(db.tables.bookings.find((b) => b.stripe_session_id === 'cs_self').host_invite_id ?? null, null)
  assert.equal(db.tables.host_invites[0].used_at ?? null, null)

  const ok = await pay(code, { session: 'cs_real' })
  assert.equal(ok.status, 200)
  // Stripe sends the same payment again.
  const evt = { type: 'checkout.session.completed', data: { object: { id: 'cs_real', payment_status: 'paid', amount_total: 240000, payment_intent: 'pi_1', customer_details: { email: 'sam@example.test' }, metadata: ok.params.metadata, total_details: {} } } }
  const retry: Response = await webhook.POST(new NextRequest('http://localhost/api/webhook', { method: 'POST', body: JSON.stringify(evt) }))
  assert.equal((await retry.json()).duplicate, true)
  assert.equal(db.tables.bookings.filter((b) => b.host_invite_id).length, 1, 'credited once')
})

test('expired, cancelled and other-night links are refused at checkout; the guest can still book normally', async () => {
  const code = codeOf((await create({ eventId: night.id, ...guest })).json.link)
  const inv = db.tables.host_invites[0]
  const other = db.insertRow('event_dates', { product_id: P, event_date: plus(11), night_slug: 'saturday-signature', night_name: 'Signature Night', is_open: true, capacity: 12, price_override: null, start_time_override: null, operation_verdict: 'Pending' })
  assert.match((await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: other.id, quantity: 1, inviteCode: code })).json.error, /different night/)
  inv.expires_at = new Date(Date.now() - 1000).toISOString()
  assert.match((await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: night.id, quantity: 1, inviteCode: code })).json.error, /expired/)
  assert.equal((await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: night.id, quantity: 1 })).status, 200, 'no invite = normal booking')

  const code2 = codeOf((await create({ eventId: night.id, ...guest, guestEmail: 'b@example.test' })).json.link)
  const id2 = db.tables.host_invites.find((i) => i.code === code2).id
  assert.equal((await call(invites.PATCH, 'http://localhost/api/admin/host/invites', 'PATCH', { id: id2, action: 'cancel' })).status, 200)
  assert.match((await call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId: night.id, quantity: 1, inviteCode: code2 })).json.error, /cancelled/)
})

test('commission: ฿150 × tickets, upcoming until the night, then earned; refunded earns nothing; owner marks paid', async () => {
  const code = codeOf((await create({ eventId: night.id, ...guest })).json.link)
  await pay(code, { qty: 3 })
  let mine = await call(invites.GET, 'http://localhost/api/admin/host/invites', 'GET')
  assert.deepEqual([mine.json.invites[0].state, mine.json.totals.upcoming, mine.json.totals.earned], ['upcoming', 450, 0])
  assert.equal(JSON.stringify(mine.json).includes('1200'), false, 'hosts never see ticket prices')

  // The night happens.
  const booking = db.tables.bookings.find((b) => b.host_invite_id)!
  booking.event_date = plus(-1)
  mine = await call(invites.GET, 'http://localhost/api/admin/host/invites', 'GET')
  assert.deepEqual([mine.json.invites[0].state, mine.json.totals.earned], ['earned', 450])

  // Hosts can't use the owner view.
  assert.equal((await call(commissions.GET, 'http://localhost/api/admin/host-commissions', 'GET')).status, 403)
  ;(globalThis as any).__admin = undefined // owner
  const all = await call(commissions.GET, 'http://localhost/api/admin/host-commissions', 'GET')
  assert.deepEqual(all.json.hosts.map((h: any) => [h.hostName, h.totals.earned]), [['Ice', 450]])
  const paid = await call(commissions.POST, 'http://localhost/api/admin/host-commissions', 'POST', { hostUserId: 'host-ice' })
  assert.deepEqual([paid.status, paid.json.amount], [200, 450])
  assert.ok(booking.host_commission_paid_at)
  assert.equal((await call(commissions.POST, 'http://localhost/api/admin/host-commissions', 'POST', { hostUserId: 'host-ice' })).status, 409, 'nothing left to pay')

  const inv = db.tables.host_invites[0]
  assert.equal(commissionFor(inv, { ...booking, host_commission_paid_at: null, booking_status: 'refunded' }, plus(0)).amount, 0)
  assert.equal(commissionFor(inv, { ...booking, host_commission_paid_at: null, status: 'cancelled' }, plus(0)).state, 'no_commission')
})

test('commission amount is a setting, fixed on each link when it is made', async () => {
  process.env.HOST_COMMISSION_THB = '200'
  await create({ eventId: night.id, ...guest })
  delete process.env.HOST_COMMISSION_THB
  assert.equal(db.tables.host_invites[0].commission_per_ticket, 200)
})
