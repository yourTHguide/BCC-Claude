// Local acceptance checks for both Phase 3B journeys, through the normal
// route handlers (real code) with synthetic data:
//   BCC sold-out journey: /api/events -> next bookable night for the party ->
//     POST /api/waitlist/sold-out -> /api/create-checkout (฿1,200, capacity)
//     -> seats reopen -> /api/admin/leads reporting -> reopen notice ->
//     one-click unsubscribe link -> final "Unsubscribe" button POST.
//   New in Bangkok journey: POST /api/waitlist -> paused while not genuinely
//     bookable -> announcement only once bookable.
// In-memory database; Resend and Stripe are recording stubs; global fetch
// throws, so nothing can leave the process.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

process.env.RESEND_API_KEY = 're_test_stub_only'
process.env.RESEND_FROM = 'Test Sender <sender@example.test>'
process.env.CHECKOUT_DYNAMIC_PRICING = 'true'
delete process.env.VERCEL_ENV
delete process.env.BCC_SOLDOUT_WAITLIST
globalThis.fetch = (async () => {
  throw new Error('network is blocked in this test')
}) as typeof fetch

const events = await import('../app/api/events/route.ts')
const soldOutRoute = await import('../app/api/waitlist/sold-out/route.ts')
const nibRoute = await import('../app/api/waitlist/route.ts')
const checkout = await import('../app/api/create-checkout/route.ts')
const leads = await import('../app/api/admin/leads/route.ts')
const announcements = await import('../app/api/admin/waitlist-announcements/route.ts')
const unsubscribe = await import('../app/api/waitlist/unsubscribe/route.ts')
const { pickNextBookable, soldOutConsentText } = await import('../lib/waitlist/soldOut.ts')

const BCC_HOST = 'www.bkkclubcrawl.com'
const BNT_HOST = 'bestnightlifethailand.com'
const P_BCC = 'p-bcc', P_NIB = 'p-nib'
// event_dates.id is a UUID in the database (the sign-up route checks the format).
const FRI_FULL = 'aaaaaaaa-0205-4000-8000-000000000001'
const SAT_ONE_LEFT = 'aaaaaaaa-0206-4000-8000-000000000002'
const FRI_OPEN = 'aaaaaaaa-0212-4000-8000-000000000003'
const FRI_CANCELLED = 'aaaaaaaa-0219-4000-8000-000000000004'
const NIB_DATE = 'bbbbbbbb-0203-4000-8000-000000000005'

let db: FakeDb
let mail: { sent: any[]; next: any[] }
let stripe: { sessions: any[] }

beforeEach(() => {
  db = new FakeDb()
  mail = { sent: [], next: [] }
  stripe = { sessions: [] }
  Object.assign(globalThis as any, { __db: db, __mail: mail, __stripe: stripe })
  db.insertRow('products', { id: P_BCC, slug: 'bangkok-club-crawl', name: 'Bangkok Club Crawl', status: 'active', default_price: 1200, default_start_time: '21:30:00', visible_bcc: true, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  db.insertRow('products', { id: P_NIB, slug: 'new-in-bkk', name: 'New in Bangkok', status: 'draft', default_price: 490, default_start_time: '20:30:00', visible_bcc: false, visible_bnt: false, early_bird_price: null, early_bird_cutoff_hours: null })
  const ev = (id: string, product_id: string, event_date: string, night_slug: string, night_name: string, capacity: number | null, extra: object = {}) =>
    db.insertRow('event_dates', { id, product_id, event_date, night_slug, night_name, capacity, is_open: true, operation_verdict: 'Pending', price_override: null, start_time_override: null, ...extra })
  ev(FRI_FULL, P_BCC, '2027-02-05', 'tgif', 'TGIF Bangkok', 4)
  ev(SAT_ONE_LEFT, P_BCC, '2027-02-06', 'saturday-signature', 'Signature Night', 6)
  ev(FRI_OPEN, P_BCC, '2027-02-12', 'tgif', 'TGIF Bangkok', 6)
  ev(FRI_CANCELLED, P_BCC, '2027-02-19', 'tgif', 'TGIF Bangkok', 4, { operation_verdict: 'Cancelled / Rescheduled' })
  ev(NIB_DATE, P_NIB, '2027-02-03', 'new-in-bkk', 'New in Bangkok', null)
  const book = (event_date: string, night_slug: string, quantity: number, id?: string) =>
    db.insertRow('bookings', { ...(id ? { id } : {}), event_date, night_slug, quantity, guest_email: `booked-${event_date}@example.test`, status: 'confirmed', is_test: true })
  book('2027-02-05', 'tgif', 2, 'bk-1')
  book('2027-02-05', 'tgif', 2, 'bk-2') // Fri 5 Feb: 4/4 -> sold out
  book('2027-02-06', 'saturday-signature', 5) // Sat 6 Feb: 5/6 -> 1 left
})

function req(url: string, method: string, body?: object, host = BCC_HOST) {
  return new NextRequest(url, { method, headers: { 'content-type': 'application/json', host }, body: body ? JSON.stringify(body) : undefined })
}
async function call(handler: any, url: string, method = 'GET', body?: object, host = BCC_HOST) {
  const res: Response = await handler(req(url, method, body, host))
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, location: res.headers.get('location') }
}
const signUp = (extra: object = {}, host = BCC_HOST) =>
  call(soldOutRoute.POST, 'http://localhost/api/waitlist/sold-out', 'POST', { eventId: FRI_FULL, name: 'Test Guest', email: 'guest@example.test', partySize: 2, consent: true, elapsedMs: 5000, website: '', ...extra }, host)
const buy = (eventId: string, quantity: number) => call(checkout.POST, 'http://localhost/api/create-checkout', 'POST', { eventId, quantity })

// ── BCC journey ──────────────────────────────────────────────────────────────
test('BCC: calendar lists the full Friday as sold out, keeps bookable nights at ฿1,200, hides the cancelled one', async () => {
  const r = await call(events.GET, 'http://localhost/api/events?storefront=bcc')
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.events.map((e: any) => [e.eventDate, e.remaining, e.effectivePrice]), [['2027-02-06', 1, 1200], ['2027-02-12', 6, 1200]])
  assert.deepEqual(r.json.soldOut.map((n: any) => n.eventId), [FRI_FULL])
  assert.equal(r.json.waitlistEnabled, true)
})

test('BCC: next bookable night depends on party size and comes only from the live list', async () => {
  const { json } = await call(events.GET, 'http://localhost/api/events?storefront=bcc')
  assert.equal(pickNextBookable(json.events, '2027-02-05', 1, 'bangkok-club-crawl')?.eventId, SAT_ONE_LEFT)
  assert.equal(pickNextBookable(json.events, '2027-02-05', 2, 'bangkok-club-crawl')?.eventId, FRI_OPEN)
  assert.equal(pickNextBookable(json.events, '2027-02-05', 7, 'bangkok-club-crawl'), null, 'no night fits 7: none offered, none invented')
})

test('BCC: waitlist sign-up stores dated consent; duplicates, other states, spam and the BEST host are handled', async () => {
  const ok = await signUp()
  assert.deepEqual([ok.status, ok.json], [200, { success: true, duplicate: false }])
  const rows = () => db.tables.bnt_waitlist
  assert.equal(rows().length, 1)
  const r = rows()[0]
  assert.equal(r.consent_scope, 'sold_out_date')
  assert.equal(r.event_date_id, FRI_FULL)
  assert.equal(r.party_size, 2)
  assert.equal(r.consent_text, soldOutConsentText('TGIF Bangkok', '2027-02-05'))
  assert.match(r.consent_text, /Friday 5 February 2027.*does not reserve a seat or guarantee entry/)
  assert.ok(r.consented_at)

  const dup = await signUp({ partySize: 3, email: 'GUEST@example.test' })
  assert.deepEqual([dup.status, dup.json.duplicate], [200, true])
  assert.equal(rows().length, 1, 'one row per email per date')
  assert.equal(rows()[0].party_size, 3, 'party size updated in place')

  assert.equal((await signUp({ eventId: FRI_OPEN, email: 'b@example.test' })).json.state, 'bookable')
  const cancelled = await signUp({ eventId: FRI_CANCELLED, email: 'c@example.test' })
  assert.deepEqual([cancelled.status, cancelled.json.state], [409, 'cancelled'])
  assert.equal((await signUp({ consent: false, email: 'd@example.test' })).status, 400)
  assert.equal((await signUp({ website: 'http://spam', email: 'e@example.test' })).status, 200)
  assert.equal((await signUp({ elapsedMs: 300, email: 'f@example.test' })).status, 200)
  assert.equal((await signUp({ email: 'g@example.test' }, BNT_HOST)).status, 404)
  assert.equal(rows().length, 1, 'none of those created a row')
})

test('BCC: normal checkout charges ฿1,200 and still enforces capacity after a waitlist sign-up', async () => {
  await signUp()
  const full = await buy(FRI_FULL, 1)
  assert.deepEqual([full.status, full.json.error], [409, 'This date is full'])
  const over = await buy(SAT_ONE_LEFT, 2)
  assert.deepEqual([over.status, over.json.error], [409, 'Only 1 spot left for this date'])
  assert.equal(stripe.sessions.length, 0, 'no session for rejected orders')

  const good = await buy(FRI_OPEN, 2)
  assert.equal(good.status, 200)
  assert.match(good.json.url, /^https:\/\/checkout\.stripe\.test\//)
  const s = stripe.sessions[0]
  assert.equal(s.line_items[0].quantity, 2)
  assert.equal(s.line_items[0].price_data.currency, 'thb')
  assert.equal(s.line_items[0].price_data.unit_amount, 120000, '฿1,200 in satang')
  assert.equal(s.metadata.event_id, FRI_OPEN)
  assert.equal(s.metadata.price_tier, 'regular')
  assert.equal((await buy(SAT_ONE_LEFT, 1)).status, 200)
})

test('BCC: seats reopen -> reporting -> approved notice -> reporting reflects delivery', async () => {
  await signUp() // party 2
  await signUp({ email: 'big@example.test', partySize: 5 })
  db.tables.bookings = db.tables.bookings.filter((b) => b.id !== 'bk-2') // a cancellation: 2 seats back

  const before = await call(leads.GET, 'http://localhost/api/admin/leads')
  assert.equal(before.status, 200)
  const d = before.json.soldOutDates.find((x: any) => x.eventId === FRI_FULL)
  assert.deepEqual(
    { state: d.state, remaining: d.remaining, waiting: d.waiting, seatsWanted: d.seatsWanted, bySize: d.bySize, notified: d.notified },
    { state: 'bookable', remaining: 2, waiting: 2, seatsWanted: 7, bySize: [{ size: 2, count: 1 }, { size: 5, count: 1 }], notified: 0 }
  )
  const ev = await call(events.GET, 'http://localhost/api/events?storefront=bcc')
  assert.ok(ev.json.events.some((e: any) => e.eventId === FRI_FULL && e.remaining === 2), 'bookable again in the calendar')

  const created = await call(announcements.POST, 'http://localhost/api/admin/waitlist-announcements', 'POST', { action: 'create-reopen', eventDateId: FRI_FULL, maxPartySize: 2, subject: 'Seats just opened' })
  assert.equal(created.status, 200)
  assert.equal(created.json.audience.eligible, 1, 'only the party that fits')
  const sent = await call(announcements.POST, 'http://localhost/api/admin/waitlist-announcements', 'POST', { action: 'send', id: created.json.id, confirmChecked: true })
  assert.deepEqual([sent.status, sent.json.sent], [200, 1])
  assert.deepEqual(mail.sent.map((m) => m.to), ['guest@example.test'])
  assert.match(mail.sent[0].html, /book\?date=2027-02-05&amp;night=tgif&amp;qty=2|book\?date=2027-02-05&night=tgif&qty=2/)

  const after = await call(leads.GET, 'http://localhost/api/admin/leads')
  const a = after.json.announcements.find((x: any) => x.id === created.json.id)
  assert.equal(a.status, 'sent')
  assert.deepEqual(a.deliveries, { sent: 1, failed: 0, queued: 0, uncertain: 0, unconfirmed: 0, skipped: 0 })
  const d2 = after.json.soldOutDates.find((x: any) => x.eventId === FRI_FULL)
  assert.deepEqual({ waiting: d2.waiting, notified: d2.notified }, { waiting: 1, notified: 1 })
})

test('BCC: one-click link -> confirm page; final button POST unsubscribes this list only; reporting shows it', async () => {
  await signUp()
  const bcc = db.tables.bnt_waitlist[0]
  const nibRow = db.insertRow('bnt_waitlist', { product_slug: 'new-in-bkk', email: 'guest@example.test', consent_scope: 'event_dates', consent_text: 'NIB', consented_at: '2026-11-01T00:00:00Z', unsubscribe_token: crypto.randomUUID(), unsubscribed_at: null, notified_at: null })

  // The email's link (GET) never unsubscribes: it redirects to the confirm page.
  const link = await call(unsubscribe.GET, `http://localhost/api/waitlist/unsubscribe?token=${bcc.unsubscribe_token}`)
  assert.equal(link.status, 303)
  assert.match(link.location!, new RegExp(`/waitlist/unsubscribe\\?token=${bcc.unsubscribe_token}$`))
  assert.equal(bcc.unsubscribed_at ?? null, null)

  // The confirm page's final button sends exactly this (see UnsubscribeClient).
  const confirm = await call(unsubscribe.POST, 'http://localhost/api/waitlist/unsubscribe', 'POST', { token: bcc.unsubscribe_token })
  assert.deepEqual([confirm.status, confirm.json], [200, { success: true }])
  assert.ok(bcc.unsubscribed_at, 'BCC date list: unsubscribed')
  assert.equal(nibRow.unsubscribed_at, null, 'NIB list for the same address: retained')

  const again = await call(unsubscribe.POST, 'http://localhost/api/waitlist/unsubscribe', 'POST', { token: bcc.unsubscribe_token })
  assert.equal(again.status, 200, 'idempotent')
  assert.equal((await call(unsubscribe.POST, 'http://localhost/api/waitlist/unsubscribe', 'POST', { token: 'not-a-token' })).status, 400)
  assert.equal((await call(unsubscribe.POST, 'http://localhost/api/waitlist/unsubscribe', 'POST', { token: crypto.randomUUID() })).status, 200, 'unknown token: same answer (no address probing)')

  const rep = await call(leads.GET, 'http://localhost/api/admin/leads')
  const d = rep.json.soldOutDates.find((x: any) => x.eventId === FRI_FULL)
  assert.deepEqual({ unsubscribed: d.unsubscribed, waiting: d.waiting }, { unsubscribed: 1, waiting: 0 })
})

// ── New in Bangkok journey ───────────────────────────────────────────────────
test('NIB: sign-up is product-scoped; BCC cannot be joined through it; announcements stay paused until genuinely bookable', async () => {
  const s = await call(nibRoute.POST, 'http://localhost/api/waitlist', 'POST', { product: 'new-in-bkk', email: 'Nib@Example.test', name: 'Nib' }, BNT_HOST)
  assert.deepEqual([s.status, s.json], [200, { success: true, duplicate: false }])
  const row = db.tables.bnt_waitlist[0]
  assert.deepEqual([row.product_slug, row.email, row.consent_scope, row.event_date_id ?? null], ['new-in-bkk', 'nib@example.test', 'event_dates', null])
  assert.equal(mail.sent.length, 1, 'team alert recorded by the stub (never sent)')
  assert.equal((await call(nibRoute.POST, 'http://localhost/api/waitlist', 'POST', { product: 'new-in-bkk', email: 'nib@example.test' }, BNT_HOST)).json.duplicate, true)
  assert.equal((await call(nibRoute.POST, 'http://localhost/api/waitlist', 'POST', { product: 'bangkok-club-crawl', email: 'x@example.test' }, BNT_HOST)).status, 400)

  const create = () => call(announcements.POST, 'http://localhost/api/admin/waitlist-announcements', 'POST', { action: 'create', productSlug: 'new-in-bkk', eventDateIds: [NIB_DATE], subject: 'New dates' })
  assert.equal((await create()).status, 400, 'Draft product: nothing can be announced (paused)')
  const nib = db.tables.products.find((p) => p.id === P_NIB)!
  Object.assign(nib, { status: 'active', visible_bnt: true })
  assert.equal((await create()).status, 200, 'published and bookable: announcement can be drafted')
})
