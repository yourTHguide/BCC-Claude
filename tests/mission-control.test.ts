// BCC Mission Control: to-do items come from the live state and clear by
// themselves once the work is done; tonight, next 7 nights and numbers.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
process.env.OPS_CRON_SECRET = 'm'.repeat(32)
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const { buildMissionControl } = await import('../lib/missionControl.ts')
const digest = await import('../app/api/cron/daily-digest/route.ts')
const mc = await import('../app/api/admin/mission-control/route.ts')

const bkk = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d)
// 8 PM Bangkok today.
const NOW = new Date(`${bkk(new Date())}T13:00:00Z`)
const today = bkk(NOW)
const plus = (n: number) => new Date(Date.parse(today + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
let db: FakeDb
let tonight: any
let past: any
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __admin: undefined })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', status: 'active' })
  tonight = db.insertRow('event_dates', { id: 't1', product_id: 'p-bcc', event_date: today, night_slug: 'tgif', night_name: 'TGIF Bangkok', is_open: true, capacity: 20, van_count: 2, van2_state: 'open', operation_verdict: 'Pending', host_assigned: null, host_payment_status: 'Not calculated', meet_up_location: null, whatsapp_group_link: null, venue_route: {} })
  past = db.insertRow('event_dates', { id: 'p1', product_id: 'p-bcc', event_date: plus(-2), night_slug: 'club-crawl', night_name: 'BKK Club Crawl', is_open: false, capacity: 12, operation_verdict: 'Completed', host_assigned: 'JJ', host_fee_final: null, host_payment_status: 'Not calculated', venue_route: {} })
  db.insertRow('event_dates', { id: 'n1', product_id: 'p-bcc', event_date: plus(1), night_slug: 'saturday-signature', night_name: 'Signature Night', is_open: true, capacity: 12, operation_verdict: 'Pending', host_assigned: 'Ice', meet_up_location: 'DOTF', whatsapp_group_link: null, venue_route: {} })
  db.insertRow('bookings', { id: 'b1', event_date: today, night_slug: 'tgif', status: 'confirmed', quantity: 3, total_paid: 3600, guest_name: 'A', created_at: '2026-11-01T00:00:00Z' })
  db.insertRow('bookings', { id: 'b2', event_date: plus(1), night_slug: 'saturday-signature', status: 'confirmed', quantity: 4, total_paid: 4800, guest_name: 'B', created_at: '2026-11-01T00:00:00Z' })
})

test('to do: tonight short (after 6 PM), host expense, report in, guest choice — each clears once done', async () => {
  db.insertRow('host_expenses', { event_id: 'p1', host_user_id: 'jj', host_name: 'JJ', category: 'taxi', amount: 300, status: 'pending' })
  db.insertRow('host_reports', { event_id: 'p1', host_user_id: 'jj', host_name: 'JJ', status: 'submitted', fee_thb: null, paid_at: null, incidents: [{ type: 'medical', what: 'x' }] })
  db.insertRow('booking_options', { booking_id: 'b1', event_id: 't1', reason: 'night_short', token: 'tk', status: 'chosen', choice: 'refund', sent_at: NOW.toISOString() })

  let d = await buildMissionControl(db as any, NOW)
  const ids = d.todo.map((t) => t.id)
  for (const id of ['go-t1', 'inc-p1', 'opt-t1', 'exp-p1', 'fee-p1-jj']) assert.ok(ids.includes(id), `${id} in ${ids}`)
  assert.deepEqual(d.todo.slice(0, 2).map((t) => t.level), ['red', 'red'], 'urgent first')
  assert.equal(d.todo.find((t) => t.id === 'go-t1')!.href, `/dashboard?night=t1&date=${today}`)

  // Done: expense approved, fee set, option resolved, tonight has 5.
  db.tables.host_expenses[0].status = 'approved'
  past.host_fee_final = 1500; past.host_payment_status = 'Calculated'
  db.tables.booking_options[0].status = 'resolved'
  db.insertRow('bookings', { id: 'b3', event_date: today, night_slug: 'tgif', status: 'confirmed', quantity: 2, total_paid: 2400, created_at: '2026-11-02T00:00:00Z' })
  d = await buildMissionControl(db as any, NOW)
  const after = d.todo.map((t) => t.id)
  for (const id of ['go-t1', 'opt-t1', 'exp-p1', 'fee-p1-jj']) assert.ok(!after.includes(id), `${id} cleared`)
  assert.ok(after.includes('pay-p1-jj'), 'now ready to pay')
  assert.match(d.todo.find((t) => t.id === 'pay-p1-jj')!.title, /Pay JJ ฿1,800/)
  past.host_payment_status = 'Paid'
  d = await buildMissionControl(db as any, NOW)
  assert.ok(!d.todo.some((t) => ['pay-p1-jj', 'inc-p1'].includes(t.id)), 'paid night: payment and incident cleared')
})

test('tonight card, next 7 nights readiness, numbers', async () => {
  const d = await buildMissionControl(db as any, NOW)
  assert.deepEqual([d.tonight[0].nightName, d.tonight[0].guests, d.tonight[0].vans.van1.guests, d.tonight[0].host], ['TGIF Bangkok', 3, 3, null])
  assert.deepEqual(d.next7.map((x: any) => [x.nightName, x.guests, x.host, x.meetUp, x.whatsapp]), [['Signature Night', 4, 'Ice', true, false]])
  assert.equal(d.numbers.next30.sold, 4)
  assert.ok(d.todo.some((t) => t.id === 'weekends'), 'no weekends 6 months ahead → reminder')
})

test('9 AM digest emails the list only when something is waiting; mission control is owner-only', async () => {
  const hit = () => digest.POST(new NextRequest('http://x', { method: 'POST', headers: { authorization: 'Bearer ' + 'm'.repeat(32) } }))
  const r = await (await hit()).json()
  assert.equal(r.sent, true)
  assert.match((globalThis as any).__mail.sent[0].subject, /to do today — BCC Mission Control/)
  ;(globalThis as any).__admin = { userId: 'h', role: 'staff', displayName: 'Ice' }
  assert.equal((await mc.GET()).status, 403)
})
