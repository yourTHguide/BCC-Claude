// Route-level regression for the waitlist send path (Phase 3B review fix).
// Runs the REAL route handlers (admin waitlist-announcements POST and the
// public unsubscribe POST) against an in-memory database and a recording mail
// stub. No network: global fetch throws. See tests/helpers/loader.mjs.
//
// Run: npm test   (node --import ./tests/helpers/register.mjs --test ...)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

process.env.RESEND_API_KEY = 're_test_stub_only'
process.env.RESEND_FROM = 'Test Sender <sender@example.test>'
delete process.env.VERCEL_ENV
globalThis.fetch = (async () => {
  throw new Error('network is blocked in this test')
}) as typeof fetch

const announcements = await import('../app/api/admin/waitlist-announcements/route.ts')
const unsubscribe = await import('../app/api/waitlist/unsubscribe/route.ts')

// ── fixture ────────────────────────────────────────────────────────────────
const P_BCC = 'p-bcc', P_NIB = 'p-nib'
const E_BCC = 'e-bcc-fri', E_BCC_OTHER = 'e-bcc-sat', E_NIB = 'e-nib-wed'
const TOKEN = { A: '11111111-1111-4111-8111-111111111111', NA: '22222222-2222-4222-8222-222222222222' }
let db: FakeDb
let mail: { sent: any[]; next: any[] }
const ids: Record<string, string> = {}

function seed() {
  db = new FakeDb()
  mail = { sent: [], next: [] }
  ;(globalThis as any).__db = db
  ;(globalThis as any).__mail = mail
  db.insertRow('products', { id: P_BCC, slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false })
  db.insertRow('products', { id: P_NIB, slug: 'new-in-bkk', name: 'New in Bangkok', status: 'active', default_price: 490, default_start_time: '20:30:00', visible_bcc: true, visible_bnt: true })
  const ev = (id: string, product_id: string, event_date: string, night_slug: string, night_name: string, capacity: number | null) =>
    db.insertRow('event_dates', { id, product_id, event_date, night_slug, night_name, capacity, is_open: true, operation_verdict: 'Pending', price_override: null, start_time_override: null })
  ev(E_BCC, P_BCC, '2027-02-05', 'tgif', 'TGIF Bangkok', 4) // 2 taken -> 2 seats reopened
  ev(E_BCC_OTHER, P_BCC, '2027-02-06', 'saturday-signature', 'Signature Night', 2) // still full
  ev(E_NIB, P_NIB, '2027-02-03', 'new-in-bkk', 'New in Bangkok', null)
  const book = (event_date: string, night_slug: string, quantity: number, guest_email: string) =>
    db.insertRow('bookings', { event_date, night_slug, quantity, guest_email, status: 'confirmed', is_test: true })
  book('2027-02-05', 'tgif', 2, 'someone-else@example.test')
  book('2027-02-06', 'saturday-signature', 2, 'another@example.test')

  const soldOut = (key: string, email: string, event_date_id: string, event_date: string, party_size: number, extra: object = {}) =>
    (ids[key] = db.insertRow('bnt_waitlist', {
      product_slug: 'bangkok-club-crawl', email, name: key, consent_scope: 'sold_out_date', consent_text: 'dated consent', consented_at: '2026-11-20T00:00:00Z',
      event_date_id, event_date, night_slug: 'tgif', party_size, unsubscribe_token: (TOKEN as any)[key] ?? crypto.randomUUID(), ...extra,
    }).id)
  const nib = (key: string, email: string) =>
    (ids[key] = db.insertRow('bnt_waitlist', {
      product_slug: 'new-in-bkk', email, name: key, consent_scope: 'event_dates', consent_text: 'NIB consent', consented_at: '2026-11-01T00:00:00Z',
      unsubscribe_token: (TOKEN as any)[key] ?? crypto.randomUUID(),
    }).id)
  soldOut('A', 'alex@example.test', E_BCC, '2027-02-05', 2) // eligible
  soldOut('B', 'bea@example.test', E_BCC, '2027-02-05', 3) // party bigger than the 2 seats
  soldOut('C', 'cal@example.test', E_BCC, '2027-02-05', 1, { unsubscribed_at: '2026-11-21T00:00:00Z' })
  soldOut('E', 'eve@example.test', E_BCC_OTHER, '2027-02-06', 1) // different date
  nib('N', 'sam@example.test') // New in Bangkok only
  nib('NA', 'alex@example.test') // same address as A, separate NIB consent
}

async function post(handler: (req: NextRequest) => Promise<Response>, url: string, body?: object) {
  const res = await handler(new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }))
  return { status: res.status, json: await res.json() }
}
const ANN = 'http://localhost/api/admin/waitlist-announcements'
const annPost = (body: object) => post(announcements.POST as any, ANN, body)

async function createReopen() {
  const r = await annPost({ action: 'create-reopen', eventDateId: E_BCC, maxPartySize: 2, subject: 'Seats just opened' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  return r.json.id as string
}
async function createNib() {
  const r = await annPost({ action: 'create', productSlug: 'new-in-bkk', eventDateIds: [E_NIB], subject: 'New dates' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  return r.json.id as string
}
async function sendAll(id: string) {
  const totals = { sent: 0, failed: 0, uncertain: 0, skipped: 0, calls: 0 }
  for (let i = 0; i < 10; i++) {
    const r = await annPost({ action: 'send', id, confirmChecked: true })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    totals.calls++
    for (const k of ['sent', 'failed', 'uncertain', 'skipped'] as const) totals[k] += r.json[k] ?? 0
    if (r.json.remaining === 0) break
  }
  return totals
}
const deliveriesFor = (annId: string) => db.tables.bnt_waitlist_deliveries.filter((d) => d.announcement_id === annId)
const row = (key: string) => db.tables.bnt_waitlist.find((r) => r.id === ids[key])!

beforeEach(seed)

// ── 1. the release blocker ───────────────────────────────────────────────────
test('BCC reopen notice: the eligible sold_out_date recipient is SENT (was marked failed)', async () => {
  const id = await createReopen()
  const t = await sendAll(id)

  assert.deepEqual({ sent: t.sent, failed: t.failed, uncertain: t.uncertain, skipped: t.skipped }, { sent: 1, failed: 0, uncertain: 0, skipped: 0 })
  assert.equal(mail.sent.length, 1)
  const m = mail.sent[0]
  assert.equal(m.to, 'alex@example.test')
  assert.match(m.from, /Bangkok Club Crawl/)
  assert.match(m.headers['List-Unsubscribe'], new RegExp(`/api/waitlist/unsubscribe\\?token=${TOKEN.A}`))
  assert.match(m.html, /qty=2/)
  assert.deepEqual(m.tags, [{ name: 'delivery_id', value: deliveriesFor(id)[0].id.replace(/-/g, '_') }])

  const d = deliveriesFor(id)
  assert.equal(d.length, 1, 'only the eligible subscriber is claimed')
  assert.equal(d[0].waitlist_id, ids.A)
  assert.equal(d[0].status, 'sent')
  assert.ok(row('A').notified_at, 'notified_at recorded')
  for (const k of ['B', 'C', 'E', 'N', 'NA']) assert.equal(row(k).notified_at ?? null, null, `${k} untouched`)
  assert.equal(db.tables.bnt_waitlist_announcements.find((a) => a.id === id)!.status, 'sent')

  // A finished notice can't be sent again: refused, nothing more goes out.
  const again = await annPost({ action: 'send', id, confirmChecked: true })
  assert.equal(again.status, 400)
  assert.equal(mail.sent.length, 1)
})

// ── 2. NIB isolation ─────────────────────────────────────────────────────────
test('New in Bangkok notice reaches only event_dates subscribers of new-in-bkk; BCC rows never touched', async () => {
  const id = await createNib()
  const t = await sendAll(id)

  assert.equal(t.sent, 2)
  assert.equal(t.failed + t.skipped + t.uncertain, 0)
  assert.deepEqual(mail.sent.map((m) => m.to).sort(), ['alex@example.test', 'sam@example.test'])
  for (const m of mail.sent) assert.match(m.from, /BEST Nightlife Thailand/)
  assert.deepEqual(deliveriesFor(id).map((d) => d.waitlist_id).sort(), [ids.N, ids.NA].sort())
  for (const k of ['A', 'B', 'C', 'E']) assert.equal(row(k).notified_at ?? null, null, `BCC row ${k} untouched`)

  // And the reverse: a reopen notice never pulls in NIB rows.
  mail.sent.length = 0
  const reopen = await createReopen()
  await sendAll(reopen)
  assert.deepEqual(mail.sent.map((m) => m.to), ['alex@example.test'])
  assert.deepEqual(deliveriesFor(reopen).map((d) => d.waitlist_id), [ids.A])
})

// ── 3. scoped unsubscribe ────────────────────────────────────────────────────
test('unsubscribing from the BCC date list suppresses that list only', async () => {
  const u = await post(unsubscribe.POST as any, `http://localhost/api/waitlist/unsubscribe?token=${TOKEN.A}`)
  assert.equal(u.status, 200)
  assert.ok(row('A').unsubscribed_at, 'BCC row unsubscribed')
  assert.equal(row('NA').unsubscribed_at ?? null, null, 'same address on the NIB list is NOT unsubscribed')

  const reopen = await createReopen()
  const t = await sendAll(reopen)
  assert.equal(t.sent, 0)
  assert.equal(mail.sent.length, 0, 'no reopen email after unsubscribe')
  assert.equal(deliveriesFor(reopen).length, 0)

  const nib = await createNib()
  await sendAll(nib)
  assert.deepEqual(mail.sent.map((m) => m.to).sort(), ['alex@example.test', 'sam@example.test'], 'NIB list still delivers to the same address')
})

test('unsubscribe AFTER the delivery was claimed: re-checked at send time and skipped, never sent', async () => {
  const reopen = await createReopen()
  db.insertRow('bnt_waitlist_deliveries', { announcement_id: reopen, waitlist_id: ids.A, status: 'pending', attempted_at: null, attempts: 0 })
  const u = await post(unsubscribe.POST as any, `http://localhost/api/waitlist/unsubscribe?token=${TOKEN.A}`)
  assert.equal(u.status, 200)

  const t = await sendAll(reopen)
  assert.equal(mail.sent.length, 0)
  assert.equal(t.skipped, 1)
  const d = deliveriesFor(reopen)[0]
  assert.equal(d.status, 'skipped')
  assert.equal(d.error, 'unsubscribed')
})

// ── 4. lookup errors are retryable, before any delivery ──────────────────────
test('recipient lookup error: 503, claim released, nothing sent; the retry then delivers once', async () => {
  const reopen = await createReopen()
  db.failRules.push({ table: 'bnt_waitlist', op: 'select', when: (b) => b.filterDesc.includes(`id=${ids.A}`) })

  const first = await annPost({ action: 'send', id: reopen, confirmChecked: true })
  assert.equal(first.status, 503)
  assert.equal(mail.sent.length, 0, 'nothing sent on a failed lookup')
  const d = deliveriesFor(reopen)[0]
  assert.equal(d.status, 'pending')
  assert.equal(d.attempted_at, null, 'claim released, so it is retryable (not "uncertain")')

  const t = await sendAll(reopen)
  assert.equal(t.sent, 1)
  assert.equal(mail.sent.length, 1)
  assert.equal(deliveriesFor(reopen)[0].status, 'sent')
})

test('eligibility-check error (booking lookup): same retryable handling', async () => {
  const reopen = await createReopen()
  db.failRules.push({ table: 'bookings', op: 'select', when: (b) => b.filterDesc.some((f) => f.startsWith('guest_email ilike')) })

  const first = await annPost({ action: 'send', id: reopen, confirmChecked: true })
  assert.equal(first.status, 503)
  assert.equal(mail.sent.length, 0)
  assert.equal(deliveriesFor(reopen)[0].attempted_at, null)

  await sendAll(reopen)
  assert.equal(mail.sent.length, 1)
})

test('NIB lookup error is also retryable', async () => {
  const nib = await createNib()
  db.failRules.push({ table: 'bnt_waitlist', op: 'select', when: (b) => b.filterDesc.includes(`id=${ids.N}`) })
  const first = await annPost({ action: 'send', id: nib, confirmChecked: true })
  assert.equal(first.status, 503)
  const dN = deliveriesFor(nib).find((d) => d.waitlist_id === ids.N)!
  assert.equal(dN.status, 'pending')
  assert.equal(dN.attempted_at, null)
  assert.ok(!mail.sent.some((m) => m.to === 'sam@example.test'), 'nothing sent to the recipient whose lookup failed')
  await sendAll(nib)
  assert.deepEqual(mail.sent.map((m) => m.to).sort(), ['alex@example.test', 'sam@example.test'], 'each NIB subscriber exactly once')
  assert.ok(deliveriesFor(nib).every((d) => d.status === 'sent'))
})
