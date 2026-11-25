// Phase 3B dashboard simplification: 2-click send, the stuck-send cause,
// the "keep me updated" opt-in, and what the new Waitlists tab reads.
// Real route handlers; in-memory database; recording mail stub; no network.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

process.env.RESEND_FROM = 'Test Sender <sender@example.test>'
delete process.env.VERCEL_ENV
delete process.env.BCC_SOLDOUT_WAITLIST
delete process.env.BCC_UPDATES_OPTIN
globalThis.fetch = (async () => {
  throw new Error('network is blocked in this test')
}) as typeof fetch

const announcements = await import('../app/api/admin/waitlist-announcements/route.ts')
const preview = await import('../app/api/admin/waitlist-announcements/preview/route.ts')
const leads = await import('../app/api/admin/leads/route.ts')
const soldOut = await import('../app/api/waitlist/sold-out/route.ts')
const events = await import('../app/api/events/route.ts')

const P = 'p-bcc'
const DATE = 'cccccccc-0205-4000-8000-000000000001'
let db: FakeDb
let mail: { sent: any[]; next: any[] }

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test_stub_only'
  delete process.env.BCC_UPDATES_OPTIN
  db = new FakeDb()
  mail = { sent: [], next: [] }
  Object.assign(globalThis as any, { __db: db, __mail: mail })
  db.insertRow('products', { id: P, slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  db.insertRow('products', { id: 'p-nib', slug: 'new-in-bkk', name: 'New in Bangkok', status: 'draft', default_price: 490, default_start_time: '20:30:00', visible_bcc: false, visible_bnt: false })
  // Same shape as the staging fixture: capacity 3, 2 taken -> 1 seat open.
  db.insertRow('event_dates', { id: DATE, product_id: P, event_date: '2027-02-05', night_slug: 'tgif', night_name: 'TEST 3B', capacity: 3, is_open: true, operation_verdict: 'Pending', price_override: null, start_time_override: null })
  db.insertRow('bookings', { event_date: '2027-02-05', night_slug: 'tgif', quantity: 2, status: 'confirmed', guest_email: 'filler@example.test', is_test: true })
  db.insertRow('bnt_waitlist', { product_slug: 'bangkok-club-crawl', email: 'solo@example.test', name: 'Solo', consent_scope: 'sold_out_date', consent_text: 'dated', consented_at: '2026-11-23T00:00:00Z', event_date_id: DATE, event_date: '2027-02-05', night_slug: 'tgif', party_size: 1 })
  db.insertRow('bnt_waitlist', { product_slug: 'bangkok-club-crawl', email: 'four@example.test', name: 'Four', consent_scope: 'sold_out_date', consent_text: 'dated', consented_at: '2026-11-23T00:00:00Z', event_date_id: DATE, event_date: '2027-02-05', night_slug: 'tgif', party_size: 4 })
})

const req = (url: string, method: string, body?: object, host = 'www.bkkclubcrawl.com') =>
  new NextRequest(url, { method, headers: { 'content-type': 'application/json', host }, body: body ? JSON.stringify(body) : undefined })
async function call(handler: any, url: string, method = 'POST', body?: object) {
  const res: Response = await handler(req(url, method, body))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text }
}
const ANN = 'http://localhost/api/admin/waitlist-announcements'
const sendNow = (extra: object = {}) => call(announcements.POST, ANN, 'POST', { action: 'create-reopen', sendNow: true, confirmChecked: true, eventDateId: DATE, maxPartySize: 1, ...extra })

test('stuck-send cause: with no email key the send is refused clearly and NOTHING is approved or queued', async () => {
  delete process.env.RESEND_API_KEY
  const r = await sendNow()
  assert.equal(r.status, 503)
  assert.match(r.json.error, /not configured/i)
  const a = db.tables.bnt_waitlist_announcements[0]
  assert.equal(a.status, 'draft', 'still a draft, as seen on staging')
  assert.equal(a.approved_at ?? null, null)
  assert.equal(db.tables.bnt_waitlist_deliveries.length, 0)
  assert.equal(mail.sent.length, 0)
})

test('2 clicks: one request saves the notice and sends to everyone who fits; the party of 4 is not emailed', async () => {
  const noTick = await call(announcements.POST, ANN, 'POST', { action: 'create-reopen', sendNow: true, eventDateId: DATE, maxPartySize: 1 })
  assert.equal(noTick.status, 400, 'the tick box is required')
  assert.equal(db.tables.bnt_waitlist_announcements.length, 0)

  const r = await sendNow()
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual([r.json.sent, r.json.remaining], [1, 0])
  assert.ok(r.json.id)
  assert.deepEqual(mail.sent.map((m) => m.to), ['solo@example.test'])
  assert.match(mail.sent[0].subject, /Seats just opened: TEST 3B, Friday 5 February 2027/, 'default subject when none given')
  const a = db.tables.bnt_waitlist_announcements[0]
  assert.equal(a.status, 'sent')
  assert.ok(a.approved_at && a.approved_by, 'approval still recorded')
})

test('2 clicks reuse a draft left by the old screen instead of refusing (the staging situation)', async () => {
  const draft = await call(announcements.POST, ANN, 'POST', { action: 'create-reopen', eventDateId: DATE, maxPartySize: 1, subject: 'Old draft subject' })
  assert.equal(draft.status, 200)
  const r = await sendNow({ subject: 'ignored' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.id, draft.json.id)
  assert.equal(db.tables.bnt_waitlist_announcements.length, 1)
  assert.equal(mail.sent[0].subject, 'Old draft subject')
})

test('dashboard data: email status (never the key) and per-person results', async () => {
  await sendNow()
  const r = await call(leads.GET, 'http://localhost/api/admin/leads', 'GET')
  assert.deepEqual(r.json.email, { configured: true, previewOnlyTo: null })
  assert.ok(!JSON.stringify(r.json).includes('re_test_stub_only'), 'key value never returned')
  const a = r.json.announcements[0]
  assert.deepEqual(a.results.map((x: any) => x.status), ['sent'])

  process.env.VERCEL_ENV = 'preview'
  try {
    const p = await call(leads.GET, 'http://localhost/api/admin/leads', 'GET')
    assert.equal(p.json.email.previewOnlyTo, 'bangkokclubcrawl@gmail.com')
  } finally {
    delete process.env.VERCEL_ENV
  }
})

test('preview from the card settings, before anything is saved', async () => {
  const r = await call(preview.GET, `${ANN}/preview?eventDateId=${DATE}&maxPartySize=1&subject=Hello%20there`, 'GET')
  assert.equal(r.status, 200)
  assert.match(r.text, /Hello there/)
  assert.match(r.text, /TEST 3B · Friday 5 February 2027 · 9:30 PM · ฿1,200 per person/)
  assert.equal(db.tables.bnt_waitlist_announcements.length, 0, 'preview saves nothing')
  db.tables.bookings.push({ id: 'b2', event_date: '2027-02-05', night_slug: 'tgif', quantity: 1, status: 'confirmed', guest_email: 'x@example.test' })
  const full = await call(preview.GET, `${ANN}/preview?eventDateId=${DATE}`, 'GET')
  assert.match(full.text, /isn&#39;t bookable right now \(sold out\)/)
})

// ── "keep me updated" opt-in ────────────────────────────────────────────────
const signUp = (extra: object = {}) =>
  call(soldOut.POST, 'http://localhost/api/waitlist/sold-out', 'POST', { eventId: DATE, name: 'Guest', email: 'guest@example.test', partySize: 1, consent: true, elapsedMs: 5000, ...extra })

test('optional updates box: separate row and consent only when ticked; one row per email; ignored when switched off', async () => {
  // Make the date sold out again for sign-ups.
  db.tables.bookings.push({ id: 'b3', event_date: '2027-02-05', night_slug: 'tgif', quantity: 1, status: 'confirmed', guest_email: 'y@example.test' })
  const rows = (scope: string) => db.tables.bnt_waitlist.filter((r) => r.consent_scope === scope && r.email === 'guest@example.test')

  assert.equal((await signUp()).status, 200)
  assert.equal(rows('bcc_updates').length, 0, 'not ticked: no updates row')

  await signUp({ updates: true })
  assert.equal(rows('sold_out_date').length, 1)
  assert.equal(rows('bcc_updates').length, 1)
  const u = rows('bcc_updates')[0]
  assert.match(u.consent_text, /new Bangkok Club Crawl nights and events/)
  assert.equal(u.event_date_id ?? null, null)
  assert.ok(u.unsubscribe_token && u.unsubscribe_token !== rows('sold_out_date')[0].unsubscribe_token, 'own unsubscribe token')

  await signUp({ updates: true })
  assert.equal(rows('bcc_updates').length, 1, 'no duplicate')

  process.env.BCC_UPDATES_OPTIN = 'off'
  await signUp({ email: 'other@example.test', updates: true })
  assert.equal(db.tables.bnt_waitlist.filter((r) => r.consent_scope === 'bcc_updates' && r.email === 'other@example.test').length, 0, 'switched off: ignored')

  const ev = await call(events.GET, 'http://localhost/api/events?storefront=bcc', 'GET')
  assert.equal(ev.json.updatesOptIn, false)
  delete process.env.BCC_UPDATES_OPTIN
  assert.equal((await call(events.GET, 'http://localhost/api/events?storefront=bcc', 'GET')).json.updatesOptIn, true)
})
