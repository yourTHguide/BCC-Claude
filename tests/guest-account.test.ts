// My account: sign in with an emailed 6-digit code, see bookings and credit,
// update details, book with credit from the account. Real routes, in-memory db.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const codeApi = await import('../app/api/account/code/route.ts')
const verifyApi = await import('../app/api/account/verify/route.ts')
const accountApi = await import('../app/api/account/route.ts')
const logoutApi = await import('../app/api/account/logout/route.ts')
const creditApi = await import('../app/api/credit/[token]/route.ts')
const creditBooking = await import('../app/api/credit-booking/route.ts')

const future = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10)
let db: FakeDb
let night: any
const mail = () => (globalThis as any).__mail.sent as any[]
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [], refunds: [], coupons: [] }, __admin: undefined })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  night = db.insertRow('event_dates', { id: '66666666-6666-4666-8666-666666666666', product_id: 'p-bcc', event_date: future, night_slug: 'tgif', night_name: 'TGIF Bangkok', is_open: true, capacity: 12, price_override: null, start_time_override: null, operation_verdict: 'Pending' })
  const g = db.insertRow('guests', { id: 'g1', email: 'ann@example.test', name: 'Ann Lee', phone: '+66811111111' })
  db.insertRow('bookings', { id: 'b-up', product_id: 'p-bcc', night_name: 'TGIF Bangkok', event_date: future, quantity: 2, status: 'confirmed', ticket_token: 'tkt1', guest_id: g.id, guest_email: 'ann@example.test', created_at: '2026-11-01T00:00:00Z' })
  db.insertRow('bookings', { id: 'b-old', product_id: 'p-bcc', night_name: 'TGIF Bangkok', event_date: '2026-10-02', quantity: 1, status: 'confirmed', booking_status: 'attended', ticket_token: 'tkt0', guest_id: null, guest_email: 'Ann@Example.test', created_at: '2026-09-01T00:00:00Z' })
  db.insertRow('bookings', { id: 'b-other', product_id: 'p-bcc', night_name: 'TGIF Bangkok', event_date: future, quantity: 4, status: 'confirmed', ticket_token: 'tktX', guest_id: null, guest_email: 'bob@example.test', created_at: '2026-11-01T00:00:00Z' })
  db.insertRow('guest_credits', { guest_id: g.id, amount: 2400, used_amount: 0, status: 'active', reason: 'night_short', source_booking_id: null, expires_at: new Date(Date.now() + 300 * 864e5).toISOString(), hold_key: null, hold_amount: null, hold_until: null })
})

function req(method: string, body?: object, cookie?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json', host: 'www.bkkclubcrawl.com' }
  if (cookie) headers.cookie = `bcc_account=${cookie}`
  return new NextRequest('http://x', { method, headers, body: body ? JSON.stringify(body) : undefined })
}
async function call(handler: any, method: string, body?: object, cookie?: string) {
  const res: Response = await handler(req(method, body, cookie))
  return { status: res.status, json: await res.json().catch(() => null), res }
}
const codeFrom = (m: any) => /(\d{6}) is your/.exec(m.subject)![1]

async function signIn(email = 'ann@example.test') {
  await call(codeApi.POST, 'POST', { email })
  const code = codeFrom(mail().at(-1))
  const r = await call(verifyApi.POST, 'POST', { email, code })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const set = r.res.headers.get('set-cookie')!
  assert.match(set, /HttpOnly/i)
  return /bcc_account=([^;]+)/.exec(set)![1]
}

test('code is emailed; only a hash is stored', async () => {
  const r = await call(codeApi.POST, 'POST', { email: ' ANN@example.test ' })
  assert.equal(r.status, 200)
  assert.equal(mail().length, 1)
  assert.equal(mail()[0].to, 'ann@example.test')
  const code = codeFrom(mail()[0])
  assert.ok(!JSON.stringify(db.tables.guest_login_codes).includes(code))
})

test('unknown email gets the same answer and no email', async () => {
  const r = await call(codeApi.POST, 'POST', { email: 'stranger@example.test' })
  assert.deepEqual([r.status, r.json], [200, { ok: true }])
  assert.equal(mail().length, 0)
})

test('a booking-only email (no guest record yet) can sign in', async () => {
  const token = await signIn('bob@example.test')
  const a = await call(accountApi.GET, 'GET', undefined, token)
  assert.deepEqual(a.json.upcoming.map((b: any) => b.id), ['b-other'])
})

test('wrong code: counts tries, then locks; code works once', async () => {
  await call(codeApi.POST, 'POST', { email: 'ann@example.test' })
  const code = codeFrom(mail()[0])
  const wrong = code === '000000' ? '111111' : '000000'
  const r1 = await call(verifyApi.POST, 'POST', { email: 'ann@example.test', code: wrong })
  assert.equal(r1.status, 400); assert.match(r1.json.error, /4 tries left/)
  for (let i = 0; i < 4; i++) await call(verifyApi.POST, 'POST', { email: 'ann@example.test', code: wrong })
  const locked = await call(verifyApi.POST, 'POST', { email: 'ann@example.test', code })
  assert.match(locked.json.error, /Too many tries/)
})

test('code is single use and expires after 15 minutes', async () => {
  const { requestCode, verifyCode } = await import('../lib/guestAuth.ts')
  const t0 = new Date()
  const r: any = await requestCode(db as any, 'ann@example.test', t0)
  assert.equal(r.status, 'sent')
  assert.equal((await verifyCode(db as any, 'ann@example.test', r.code, new Date(t0.getTime() + 16 * 60_000))).ok, false)
  const r2: any = await requestCode(db as any, 'ann@example.test', new Date(t0.getTime() + 17 * 60_000))
  assert.equal((await verifyCode(db as any, 'ann@example.test', r2.code, new Date(t0.getTime() + 18 * 60_000))).ok, true)
  assert.equal((await verifyCode(db as any, 'ann@example.test', r2.code, new Date(t0.getTime() + 18 * 60_000))).ok, false)
})

test('asking again too fast waits; more than 5 an hour is refused', async () => {
  const { requestCode } = await import('../lib/guestAuth.ts')
  const t0 = Date.now()
  assert.equal((await requestCode(db as any, 'ann@example.test', new Date(t0))).status, 'sent')
  assert.equal((await requestCode(db as any, 'ann@example.test', new Date(t0 + 5000))).status, 'wait')
  for (let i = 1; i < 5; i++) assert.equal((await requestCode(db as any, 'ann@example.test', new Date(t0 + i * 60_000))).status, 'sent')
  assert.equal((await requestCode(db as any, 'ann@example.test', new Date(t0 + 6 * 60_000))).status, 'limited')
})

test('account shows own bookings only, ticket for upcoming, credit; old email bookings join the account', async () => {
  const token = await signIn()
  const a = await call(accountApi.GET, 'GET', undefined, token)
  assert.equal(a.status, 200)
  assert.deepEqual(a.json.upcoming.map((b: any) => [b.id, b.ticketUrl, b.statusLabel]), [['b-up', '/ticket/tkt1', 'Confirmed']])
  assert.deepEqual(a.json.past.map((b: any) => [b.id, b.ticketUrl, b.statusLabel]), [['b-old', null, 'Attended']])
  assert.equal(a.json.credit.available, 2400)
  assert.equal(db.tables.bookings.find((b) => b.id === 'b-old')!.guest_id, 'g1')
  assert.equal(db.tables.bookings.find((b) => b.id === 'b-other')!.guest_id, null)
})

test('not signed in or signed out → 401', async () => {
  assert.equal((await call(accountApi.GET, 'GET')).status, 401)
  assert.equal((await call(accountApi.GET, 'GET', undefined, 'x'.repeat(43))).status, 401)
  const token = await signIn()
  await call(logoutApi.POST, 'POST', undefined, token)
  assert.equal((await call(accountApi.GET, 'GET', undefined, token)).status, 401)
})

test('update name and phone', async () => {
  const token = await signIn()
  assert.equal((await call(accountApi.PATCH, 'PATCH', { name: 'Ann B', phone: 'abc' }, token)).status, 400)
  assert.equal((await call(accountApi.PATCH, 'PATCH', { name: 'Ann B', phone: '+66 81 222 3333' }, token)).status, 200)
  const g = db.tables.guests.find((x) => x.id === 'g1')!
  assert.deepEqual([g.name, g.phone, g.email], ['Ann B', '+66 81 222 3333', 'ann@example.test'])
})

test('book with credit from the account (token "account" + cookie)', async () => {
  const token = await signIn()
  const bal: Response = await creditApi.GET(req('GET', undefined, token), { params: { token: 'account' } })
  assert.equal((await bal.json()).available, 2400)
  const noCookie: Response = await creditApi.GET(req('GET'), { params: { token: 'account' } })
  assert.equal((await noCookie.json()).available, 0)
  const r = await call(creditBooking.POST, 'POST', { token: 'account', eventId: night.id, quantity: 2 }, token)
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.ok(db.tables.bookings.some((b) => b.source === 'credit' && b.guest_email === 'ann@example.test'))
})
