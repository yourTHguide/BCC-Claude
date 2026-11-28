// My account self-service: move or keep as credit — instant 7+ days before the
// night, a request the owner approves inside 7 days. Real routes, in-memory db.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const { verifyCode, requestCode } = await import('../lib/guestAuth.ts')
const change = await import('../app/api/account/bookings/[id]/route.ts')
const owner = await import('../app/api/admin/change-requests/route.ts')
const accountApi = await import('../app/api/account/route.ts')

const day = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(Date.now() + n * 864e5))
const B_FAR = '11111111-1111-4111-8111-111111111111'
const B_NEAR = '22222222-2222-4222-8222-222222222222'
let db: FakeDb
let target: any
let cookie: string
const mail = () => (globalThis as any).__mail.sent as any[]

function night(id: string, date: string, slug = 'tgif') {
  return db.insertRow('event_dates', { id, product_id: 'p-bcc', event_date: date, night_slug: slug, night_name: 'TGIF Bangkok', is_open: true, capacity: 10, price_override: null, start_time_override: null, operation_verdict: 'Pending' })
}
beforeEach(async () => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __stripe: { sessions: [], refunds: [], coupons: [] }, __admin: { userId: 'o', role: 'owner', email: 'o@example.test', displayName: 'Guide' } })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  const far = night('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', day(20))
  const near = night('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', day(3))
  target = night('cccccccc-cccc-4ccc-8ccc-cccccccccccc', day(27))
  db.insertRow('guests', { id: 'g1', email: 'ann@example.test', name: 'Ann Lee', phone: null })
  for (const [id, ev] of [[B_FAR, far], [B_NEAR, near]] as const) {
    db.insertRow('bookings', { id, event_id: ev.id, event_date: ev.event_date, night_slug: 'tgif', night_name: 'TGIF Bangkok', product_id: 'p-bcc', status: 'confirmed', quantity: 2, total_paid: 2400, credit_used: 0, guest_id: 'g1', guest_email: 'ann@example.test', guest_name: 'Ann Lee', ticket_token: 't' + id.slice(0, 4), is_test: false, created_at: '2026-11-01T00:00:00Z' })
  }
  const r: any = await requestCode(db as any, 'ann@example.test')
  const v: any = await verifyCode(db as any, 'ann@example.test', r.code)
  cookie = v.token
  ;(globalThis as any).__mail.sent.length = 0
})
function req(method: string, body?: object, withCookie = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (withCookie) headers.cookie = `bcc_account=${cookie}`
  return new NextRequest('http://x', { method, headers, body: body ? JSON.stringify(body) : undefined })
}
async function call(handler: any, method: string, id: string, body?: object, withCookie = true) {
  const res: Response = await handler(req(method, body, withCookie), { params: { id } })
  return { status: res.status, json: await res.json().catch(() => null) }
}

test('account shows which bookings can change and how', async () => {
  const res: Response = await accountApi.GET(req('GET'))
  const a = await res.json()
  const byId = new Map(a.upcoming.map((b: any) => [b.id, b.change]))
  assert.equal(byId.get(B_FAR), 'instant')
  assert.equal(byId.get(B_NEAR), 'request')
})

test('7+ days: move is instant (seats follow, ticket email); other guests and signed-out are refused', async () => {
  const opts = await call(change.GET, 'GET', B_FAR)
  assert.equal(opts.json.mode, 'instant')
  assert.ok(opts.json.dates.some((d: any) => d.eventId === target.id))
  assert.equal((await call(change.POST, 'POST', B_FAR, { kind: 'move', targetEventId: target.id }, false)).status, 401)
  const r = await call(change.POST, 'POST', B_FAR, { kind: 'move', targetEventId: target.id })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.done, true)
  const b = db.tables.bookings.find((x) => x.id === B_FAR)!
  assert.deepEqual([b.event_id, b.event_date, b.booking_status], [target.id, target.event_date, 'rescheduled'])
  assert.ok(mail().some((m) => m.to === 'ann@example.test'))
  // Someone else's booking: not found.
  db.insertRow('bookings', { id: '33333333-3333-4333-8333-333333333333', event_date: day(20), status: 'confirmed', quantity: 1, guest_email: 'bob@example.test', guest_id: null })
  assert.equal((await call(change.POST, 'POST', '33333333-3333-4333-8333-333333333333', { kind: 'credit' })).status, 404)
})

test('7+ days: keep as credit is instant (booking cancelled, no refund, 12-month credit)', async () => {
  const r = await call(change.POST, 'POST', B_FAR, { kind: 'credit' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const b = db.tables.bookings.find((x) => x.id === B_FAR)!
  assert.equal(b.status, 'cancelled')
  assert.notEqual(b.booking_status, 'refunded')
  const c = db.tables.guest_credits.find((x) => x.source_booking_id === B_FAR)!
  assert.deepEqual([c.amount, c.guest_id, c.reason], [2400, 'g1', 'guest_cancelled'])
  assert.equal((globalThis as any).__stripe.refunds.length, 0)
})

test('inside 7 days: a request; owner approves → moved; one pending at a time', async () => {
  const r = await call(change.POST, 'POST', B_NEAR, { kind: 'move', targetEventId: target.id, note: 'Flight changed' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.done, false)
  assert.equal(db.tables.bookings.find((x) => x.id === B_NEAR)!.event_id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'not moved yet')
  assert.ok(mail().some((m) => m.to === 'owner@example.test' && /wants to move/.test(m.subject)))
  assert.equal((await call(change.POST, 'POST', B_NEAR, { kind: 'credit' })).status, 409)
  const list: Response = await owner.GET()
  const q = (await list.json()).requests[0]
  assert.deepEqual([q.kind, q.note, q.target.date], ['move', 'Flight changed', target.event_date])
  const ok: Response = await owner.POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ id: q.id, approve: true }) }))
  assert.equal(ok.status, 200)
  assert.equal(db.tables.bookings.find((x) => x.id === B_NEAR)!.event_id, target.id)
  const again: Response = await owner.POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ id: q.id, approve: true }) }))
  assert.equal(again.status, 409)
})

test('inside 7 days: owner declines a credit request → booking stays, guest emailed', async () => {
  await call(change.POST, 'POST', B_NEAR, { kind: 'credit' })
  const q = db.tables.booking_change_requests[0]
  const res: Response = await owner.POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ id: q.id, approve: false, note: 'See you there!' }) }))
  assert.equal(res.status, 200)
  assert.equal(db.tables.bookings.find((x) => x.id === B_NEAR)!.status, 'confirmed')
  assert.equal(db.tables.guest_credits.length, 0)
  assert.ok(mail().some((m) => m.to === 'ann@example.test' && /See you there/.test(m.html)))
})

test('a past night or a full target cannot be used', async () => {
  db.tables.bookings.find((x) => x.id === B_FAR)!.event_date = day(-1)
  assert.equal((await call(change.POST, 'POST', B_FAR, { kind: 'credit' })).status, 409)
  assert.equal((await call(change.POST, 'POST', B_NEAR, { kind: 'move', targetEventId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })).status, 409)
})
