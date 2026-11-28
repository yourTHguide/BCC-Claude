// Review request emails: the day after, checked-in website guests only, once
// per booking, at most once per email every 60 days; private feedback.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
process.env.OPS_CRON_SECRET = 'x'.repeat(32)
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const { runReviewRequests, saveFeedback } = await import('../lib/reviewRequests.ts')
const cron = await import('../app/api/cron/review-requests/route.ts')

// 2 PM Bangkok on 29 Nov 2026 → last night is 28 Nov.
const NOW = new Date('2026-11-29T07:00:00Z')
let db: FakeDb
const mail = () => (globalThis as any).__mail.sent as any[]
function booking(o: Record<string, unknown>) {
  return db.insertRow('bookings', { product_id: 'p-bcc', night_name: 'Signature Night', event_date: '2026-11-28', status: 'confirmed', is_test: false, quantity: 1, attendance_status: 'checked_in', booking_status: null, ...o })
}
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] } })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl' })
  db.insertRow('products', { id: 'p-nib', slug: 'new-in-bangkok' })
})

test('emails checked-in guests from last night once, with both review buttons and a private feedback link', async () => {
  booking({ id: 'b1', guest_name: 'Ann Lee', guest_email: 'ann@example.test' })
  booking({ id: 'b2', guest_name: 'No Show', guest_email: 'ns@example.test', attendance_status: 'no_show' })
  booking({ id: 'b3', guest_name: 'Cancelled', guest_email: 'c@example.test', status: 'cancelled' })
  booking({ id: 'b4', guest_name: 'Test', guest_email: 't@example.test', is_test: true })
  booking({ id: 'b5', guest_name: 'Other product', guest_email: 'o@example.test', product_id: 'p-nib' })
  booking({ id: 'b6', guest_name: 'Too old', guest_email: 'old@example.test', event_date: '2026-11-20' })
  booking({ id: 'b7', guest_name: 'Tonight', guest_email: 'tn@example.test', event_date: '2026-11-29' })
  const r = await runReviewRequests(db as any, NOW)
  assert.deepEqual(r, { sent: 1, skipped: 0, failed: 0 })
  assert.equal(mail().length, 1)
  const m = mail()[0]
  assert.equal(m.to, 'ann@example.test')
  assert.match(m.subject, /Thank you for last night, Ann/)
  assert.match(m.html, /g\.page\/r\/CY0P_hVGfy-AEBM\/review/)
  assert.match(m.html, /tripadvisor\.com\/UserReviewEdit/)
  assert.match(m.html, /\/feedback\/[A-Za-z0-9_-]{20,}/)
  // A second run (or a retry) never sends again.
  assert.deepEqual(await runReviewRequests(db as any, NOW), { sent: 0, skipped: 0, failed: 0 })
  assert.equal(mail().length, 1)
})

test('catches up the night before; repeat guest gets at most one in 60 days; one email for two bookings', async () => {
  booking({ id: 'a1', guest_name: 'Ann', guest_email: 'ann@example.test', event_date: '2026-11-27' })
  booking({ id: 'a2', guest_name: 'Ann', guest_email: 'ANN@example.test' })
  assert.deepEqual(await runReviewRequests(db as any, NOW), { sent: 1, skipped: 1, failed: 0 })
  // She comes again 3 weeks later: no second review email.
  booking({ id: 'a3', guest_name: 'Ann', guest_email: 'ann@example.test', event_date: '2026-12-18' })
  assert.equal((await runReviewRequests(db as any, new Date('2026-12-19T07:00:00Z'))).sent, 0)
  // 70 days later: yes.
  booking({ id: 'a4', guest_name: 'Ann', guest_email: 'ann@example.test', event_date: '2027-02-05' })
  assert.equal((await runReviewRequests(db as any, new Date('2027-02-06T07:00:00Z'))).sent, 1)
})

test('a failed send is recorded and not retried into a duplicate', async () => {
  booking({ id: 'b1', guest_name: 'Ann', guest_email: 'ann@example.test' })
  ;(globalThis as any).__mail.next.push({ error: { message: 'boom' } })
  const r = await runReviewRequests(db as any, NOW)
  assert.equal(r.failed, 1)
  assert.equal(db.tables.review_requests[0].status, 'failed')
})

test('private feedback is saved and emailed to the owner (reply goes to the guest)', async () => {
  booking({ id: 'b1', guest_name: 'Ann Lee', guest_email: 'ann@example.test' })
  await runReviewRequests(db as any, NOW)
  const token = db.tables.review_requests[0].token
  assert.equal((await saveFeedback(db as any, token, ' ')).status, 400)
  assert.equal((await saveFeedback(db as any, 'nope', 'hi')).status, 404)
  assert.equal((await saveFeedback(db as any, token, 'The second venue was too crowded.')).status, 200)
  const m = mail().at(-1)
  assert.deepEqual([m.to, m.reply_to], ['owner@example.test', 'ann@example.test'])
  assert.match(m.html, /too crowded/)
  assert.ok(db.tables.review_requests[0].feedback_at)
})

test('cron route needs the secret', async () => {
  const res: Response = await cron.POST(new NextRequest('http://x', { method: 'POST' }))
  assert.equal(res.status, 401)
})
