// /night: guests leave name, email, WhatsApp and date; matched to a booking
// before they ever see the group link or meeting point.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
delete process.env.BOKUN_ACCESS_KEY
delete process.env.BOKUN_SECRET_KEY
process.env.OPS_CRON_SECRET = 'n'.repeat(32)
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const nj = await import('../lib/nightJoin.ts')
const api = await import('../app/api/night/route.ts')
const owner = await import('../app/api/admin/night-joins/route.ts')

const today = nj.bangkokToday()
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
// A non-Monday in the future.
let future = addDays(today, 3)
while (new Date(future + 'T00:00:00Z').getUTCDay() === 1) future = addDays(future, 1)
let db: FakeDb
let night: any
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __admin: { userId: 'o', role: 'owner', email: 'o@example.test', displayName: 'Guide' } })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl' })
  night = db.insertRow('event_dates', { id: 'e-fut', product_id: 'p-bcc', event_date: future, night_name: 'TGIF Bangkok', is_open: true, whatsapp_group_link: null, meet_up_location: null })
  db.insertRow('bookings', { id: 'b1', event_id: 'e-fut', event_date: future, guest_name: 'John Smith', guest_email: 'john@example.test', status: 'confirmed', is_test: false })
  db.insertRow('ota_bookings', { id: 'o1', event_date: future, guest_name: 'Maria Garcia Lopez', booking_status: null })
})
async function post(body: object, cookie?: string) {
  const res: Response = await api.POST(new NextRequest('http://x/api/night', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie: `bcc_night=${cookie}` } : {}) }, body: JSON.stringify(body) }))
  const set = res.headers.get('set-cookie') ?? ''
  return { status: res.status, json: await res.json(), cookie: /bcc_night=([^;]+)/.exec(set)?.[1] ?? cookie }
}
async function get(cookie?: string) {
  const res: Response = await api.GET(new NextRequest('http://x/api/night', { headers: cookie ? { cookie: `bcc_night=${cookie}` } : {} }))
  return res.json()
}

test('name matching: typos, order, initials, first name only', () => {
  assert.equal(nj.nameScore('John Smith', 'john smith'), 1)
  assert.ok(nj.nameScore('Smith John', 'John Smith') > 0.95)
  assert.ok(nj.nameScore('Jon Smyth', 'John Smith') >= 0.75)
  assert.ok(nj.nameScore('Ann L', 'Ann Lee') >= 0.85)
  assert.ok(nj.nameScore('José', 'Jose Fernandez') >= 0.75)
  assert.equal(nj.nameScore('Peter Parker', 'John Smith'), 0)
})

test('matched by name: saved; same link shows Join + meeting point only on the night with a group link', async () => {
  const r = await post({ name: 'Jon Smith', email: '', code: '+44', phone: '07700 900123', date: future })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual([r.json.state, r.json.phone], ['saved', '+447700900123'])
  const row = db.tables.night_joins[0]
  assert.deepEqual([row.status, row.match_kind, row.booking_id], ['matched', 'bookings', 'b1'])
  // Group link set, but it's not the night yet → still "saved".
  night.whatsapp_group_link = 'https://chat.whatsapp.com/abc'
  night.meet_up_location = 'Levels Club'
  assert.equal((await get(r.cookie)).state, 'saved')
  // On the night → Join.
  night.event_date = today; row.event_date = today
  db.tables.bookings[0].event_date = today
  const s = await get(r.cookie)
  assert.deepEqual([s.state, s.groupLink, s.meetUp], ['join', 'https://chat.whatsapp.com/abc', 'Levels Club'])
  // Another phone (no cookie) sees only the form.
  assert.equal((await get()).state, 'form')
})

test('matched by email for website bookings; OTA by name', async () => {
  const r = await post({ name: 'Johnny', email: 'JOHN@example.test', code: '+1', phone: '2025550123', date: future })
  assert.equal(db.tables.night_joins[0].booking_id, 'b1')
  const r2 = await post({ name: 'Maria Garcia', code: '+34', phone: '612345678', date: future })
  assert.equal(r2.json.state, 'saved')
  assert.equal(db.tables.night_joins[1].match_kind, 'ota_bookings')
  assert.ok(r.cookie)
})

test('no match → checking; nothing revealed; re-check matches once the booking arrives', async () => {
  const r = await post({ name: 'Peter Parker', code: '+44', phone: '7700900999', date: future })
  assert.equal(r.json.state, 'checking')
  night.whatsapp_group_link = 'https://chat.whatsapp.com/abc'
  night.event_date = today; db.tables.night_joins[0].event_date = today
  assert.equal((await get(r.cookie)).state, 'checking', 'never Join while unmatched')
  db.insertRow('ota_bookings', { id: 'o2', event_date: today, guest_name: 'Peter Parker', booking_status: null })
  const res = await nj.recheckPending(db as any, new Date(Date.now() + 20 * 60_000))
  assert.deepEqual(res, { checked: 1, matched: 1 })
  assert.equal((await get(r.cookie)).state, 'join')
})

test('two similar names on the night → not matched automatically', async () => {
  db.insertRow('bookings', { id: 'b2', event_id: 'e-fut', event_date: future, guest_name: 'John Smyth', status: 'confirmed', is_test: false })
  const r = await post({ name: 'Jon Smith', code: '+44', phone: '7700900123', date: future })
  assert.equal(r.json.state, 'checking')
})

test('validation: phone needed, no Mondays, no past dates', async () => {
  assert.equal((await post({ name: 'John Smith', phone: '', date: future })).status, 400)
  let monday = addDays(today, 1)
  while (new Date(monday + 'T00:00:00Z').getUTCDay() !== 1) monday = addDays(monday, 1)
  assert.match((await post({ name: 'John Smith', code: '+44', phone: '7700900123', date: monday })).json.error, /Mondays/)
  assert.equal((await post({ name: 'John Smith', code: '+44', phone: '7700900123', date: addDays(today, -1) })).status, 400)
})

test('owner: list, match a waiting number, mark sent; WhatsApp link carries the group link', async () => {
  await post({ name: 'John Smith', code: '+44', phone: '7700900123', date: future })
  await post({ name: 'Zed Unknown', code: '+44', phone: '7700900777', date: future })
  night.whatsapp_group_link = 'https://chat.whatsapp.com/xyz'
  const res: Response = await owner.GET(new NextRequest(`http://x/api/admin/night-joins?date=${future}`))
  const l = await res.json()
  assert.equal(l.matched.length, 1)
  assert.match(decodeURIComponent(l.matched[0].waUrl), /wa\.me\/447700900123\?text=Hi John!.*chat\.whatsapp\.com\/xyz/s)
  assert.equal(l.pending.length, 1)
  assert.ok(l.candidates.some((c: any) => c.name === 'John Smith'))
  const id = l.pending[0].id
  const m: Response = await owner.POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ id, action: 'match', kind: 'owner', name: 'Zed (walk-in)' }) }))
  assert.equal(m.status, 200)
  const s: Response = await owner.POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ id: l.matched[0].id, action: 'sent' }) }))
  assert.equal(s.status, 200)
  assert.ok(db.tables.night_joins.find((r) => r.id === l.matched[0].id).sent_at)
  ;(globalThis as any).__admin = { userId: 'h', role: 'staff', email: 'h@example.test', displayName: 'Ice' }
  const denied: Response = await owner.GET(new NextRequest(`http://x/api/admin/night-joins?date=${future}`))
  assert.equal(denied.status, 403)
})
