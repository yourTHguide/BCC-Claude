// Bókun sync, shadow mode (Nov 2026). Real lib + route code, in-memory
// database, Bókun answered by a stub fetch. No network.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

process.env.BOKUN_ACCESS_KEY = 'test-access'
process.env.BOKUN_SECRET_KEY = 'test-secret'
process.env.BOKUN_SYNC_SECRET = 'x'.repeat(32)
delete process.env.BOKUN_AUTO_OPEN_MIN_GUESTS

const { normalizeBooking, bokunDate } = await import('../lib/bokun/normalize.ts')
const { buildSyncPlan } = await import('../lib/bokun/plan.ts')
const { runBokunSync } = await import('../lib/bokun/sync.ts')
const cron = await import('../app/api/cron/bokun-sync/route.ts')

// 2027-03-03 Wed, -05 Fri. "Now" is a week before, Bangkok noon.
const NOW = new Date('2027-02-24T05:00:00Z')
const ms = (d: string) => Date.parse(d + 'T00:00:00Z')

function bk(id: number, o: { date: string; guests?: number; status?: string; channel?: string; code?: string; ref?: string | null; email?: string; phone?: string; name?: string }) {
  return {
    id,
    confirmationCode: o.code ?? `ABNB-${id}`,
    externalBookingReference: o.ref === undefined ? `TA${id}` : o.ref,
    bookingChannel: { title: o.channel ?? 'Airbnb' },
    customer: { firstName: o.name ?? 'Test', lastName: 'Guest', email: o.email, phoneNumber: o.phone },
    productBookings: [{ status: o.status ?? 'CONFIRMED', startDate: ms(o.date), totalParticipants: o.guests ?? 1, product: { id: 1070079 } }],
  }
}

test('normalize: Bókun timestamp → night date, platform names, masked emails kept apart', () => {
  assert.equal(bokunDate(1795910400000), '2026-11-29')
  assert.equal(bokunDate('2026-12-05'), '2026-12-05')
  const gyg = normalizeBooking(bk(1, { date: '2027-03-05', channel: 'GetYourGuide', code: 'GET-1', ref: 'GYGABC123', email: 'x@reply.getyourguide.com', phone: '+66 81 234 5678', guests: 2 }))!
  assert.deepEqual([gyg.source, gyg.event_date, gyg.guests, gyg.email, gyg.email_masked, gyg.phone, gyg.platform_code], ['getyourguide', '2027-03-05', 2, null, 'x@reply.getyourguide.com', '+66812345678', 'GYGABC123'])
  const via = normalizeBooking(bk(2, { date: '2027-03-05', channel: 'Viator.com', code: 'VIA-2', ref: '1466807715', email: 'g@expmessaging.tripadvisor.com' }))!
  assert.deepEqual([via.source, via.email, via.email_masked], ['viator', null, 'g@expmessaging.tripadvisor.com'])
  const real = normalizeBooking(bk(3, { date: '2027-03-05', email: 'Guest@Example.com' }))!
  assert.deepEqual([real.source, real.email, real.email_masked], ['airbnb', 'guest@example.com', null])
  assert.equal(normalizeBooking({ id: 9, productBookings: [{}] }), null, 'no date → skipped')
})

const night = (date: string, slug: string, isOpen: boolean, extra: object = {}) => ({ id: `n-${date}`, event_date: date, night_slug: slug, night_name: null, is_open: isOpen, capacity: 12, ...extra })
const row = (id: number, date: string, guests = 1, status = 'CONFIRMED', ref?: string | null) => normalizeBooking(bk(id, { date, guests, status, ref }))!

test('plan: missing bookings are added; a date without a night gets one created OFF; opens at 4 OTA guests', () => {
  const plan = buildSyncPlan({
    bokun: [row(1, '2027-03-03', 3), row(2, '2027-03-05', 2), row(3, '2027-03-05', 2)],
    nights: [night('2027-03-05', 'tgif', false)],
    ota: [],
    defaultStartTime: '21:30:00',
    now: NOW,
  })
  const wed = plan.find((p) => p.date === '2027-03-03')!
  assert.deepEqual(wed.createNight, { slug: 'club-crawl', name: 'Bangkok Club Crawl' })
  assert.equal(wed.toAdd, 3)
  assert.deepEqual([wed.open.would, wed.open.reason], [false, '3 of 4 OTA guests'])
  const fri = plan.find((p) => p.date === '2027-03-05')!
  assert.equal(fri.createNight, null)
  assert.deepEqual([fri.otaGuestsAfter, fri.open.would], [4, true])
  assert.deepEqual(fri.newBookings.map((b) => [b.code, b.guests, b.source]), [['TA2', 2, 'airbnb'], ['TA3', 2, 'airbnb']])
})

test('plan: matched by platform code even after the team moved the guest; cancellations and strays flagged', () => {
  const plan = buildSyncPlan({
    bokun: [row(1, '2027-03-05', 2), row(2, '2027-03-05', 1, 'CANCELLED'), row(3, '2027-03-05', 1, 'REQUESTED')],
    nights: [night('2027-03-05', 'tgif', false), night('2027-03-06', 'saturday-signature', true)],
    ota: [
      { id: 'o1', event_date: '2027-03-06', night_slug: 'saturday-signature', source: 'airbnb', quantity: 2, booking_ref: 'ta1' },
      { id: 'o2', event_date: '2027-03-05', night_slug: 'tgif', source: 'airbnb', quantity: 1, booking_ref: 'TA2' },
      { id: 'o3', event_date: '2027-03-05', night_slug: 'tgif', source: 'viator', quantity: 2, booking_ref: '999' },
      { id: 'o4', event_date: '2027-03-05', night_slug: 'tgif', source: 'direct', quantity: 4, booking_ref: null },
    ],
    defaultStartTime: '21:30:00',
    now: NOW,
    window: { from: '2027-02-22', to: '2028-02-24' },
  })
  const fri = plan.find((p) => p.date === '2027-03-05')!
  const kinds = fri.issues.map((i) => i.kind).sort()
  assert.deepEqual(kinds, ['cancelled_in_bokun', 'moved', 'not_in_bokun', 'pending_in_bokun'])
  assert.equal(fri.toAdd, 0, 'the moved guest is not added again')
  assert.deepEqual(fri.bokun, { bookings: 1, guests: 2 })
  assert.deepEqual(fri.dashboard, { bookings: 2, guests: 3 }, 'direct/cash rows are not OTA guests')
  const sat = plan.find((p) => p.date === '2027-03-06')!
  assert.equal(sat.issues.length, 0, 'the moved guest sits fine on Saturday')
  assert.equal(sat.open.reason, 'Already ON')
})

test('plan: a past date without a night can still be imported (night created OFF); it is never opened', () => {
  const p = buildSyncPlan({ bokun: [row(1, '2027-02-23', 4)], nights: [], ota: [], defaultStartTime: '21:30:00', now: NOW })[0]
  assert.deepEqual(p.createNight, { slug: 'club-crawl', name: 'Bangkok Club Crawl' })
  assert.deepEqual([p.issues.length, p.newBookings.length, p.open.would], [0, 1, false])
})

test('plan: never opens a cancelled, past or already-started night; threshold is a setting', () => {
  const base = { ota: [], defaultStartTime: '21:30:00' }
  const three = [row(1, '2027-03-05', 4)]
  const cancelled = buildSyncPlan({ ...base, bokun: three, nights: [night('2027-03-05', 'tgif', false, { operation_verdict: 'Cancelled / Rescheduled' })], now: NOW })[0]
  assert.deepEqual([cancelled.open.would, cancelled.open.reason], [false, 'Night cancelled'])
  const started = buildSyncPlan({ ...base, bokun: three, nights: [night('2027-03-05', 'tgif', false)], now: new Date('2027-03-05T15:00:00Z') })[0]
  assert.deepEqual([started.open.would, started.open.reason], [false, 'Started or past'])
  const before = buildSyncPlan({ ...base, bokun: three, nights: [night('2027-03-05', 'tgif', false)], now: new Date('2027-03-05T14:00:00Z') })[0]
  assert.equal(before.open.would, true, '21:00 Bangkok, before the 21:30 start')
  const five = buildSyncPlan({ ...base, bokun: three, nights: [night('2027-03-05', 'tgif', false)], now: NOW, threshold: 5 })[0]
  assert.deepEqual([five.open.would, five.open.reason], [false, '4 of 5 OTA guests'])
})

// ── Full run against the in-memory database ─────────────────────────────
let db: FakeDb
let bokunPages: any[][]
let calls: any[]
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', default_start_time: '21:30:00' })
  db.insertRow('event_dates', { id: 'n-fri', product_id: 'p-bcc', event_date: '2027-03-05', night_slug: 'tgif', night_name: 'TGIF Bangkok', is_open: false, capacity: 12 })
  calls = []
  bokunPages = []
  globalThis.fetch = (async (url: string, init: any) => {
    const body = JSON.parse(init.body)
    calls.push({ url, body, headers: init.headers })
    const items = bokunPages[body.page - 1] ?? []
    return new Response(JSON.stringify({ totalHits: bokunPages.flat().length, items }), { status: 200 })
  }) as any
})

test('run: reads every page, keeps one row per booking, logs once per night, changes nothing live', async () => {
  const fifty = Array.from({ length: 50 }, (_, i) => bk(1000 + i, { date: '2027-03-10' }))
  bokunPages = [fifty, [bk(1, { date: '2027-03-05', guests: 3 }), bk(2, { date: '2027-03-05', guests: 1 })]]
  const before = JSON.stringify([db.tables.event_dates, db.tables.ota_bookings])

  const r1 = await runBokunSync(db as any, 'manual', NOW)
  assert.equal(r1.ok, true, r1.error)
  assert.deepEqual([r1.fetched, r1.added, r1.changed, r1.wouldCreate, r1.wouldOpen], [52, 52, 0, 1, 2])
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].body.productIds, [1070079])
  assert.ok(calls[0].headers['X-Bokun-Signature'])
  assert.equal(db.tables.bokun_bookings.length, 52)
  assert.deepEqual(db.tables.bokun_sync_log.map((l) => [l.kind, l.event_date]).sort(), [['create_night', '2027-03-10'], ['open_night', '2027-03-05'], ['open_night', '2027-03-10']])
  assert.equal(JSON.stringify([db.tables.event_dates, db.tables.ota_bookings]), before, 'shadow mode never touches nights or OTA bookings')

  // Second read: one booking cancelled in Bókun.
  bokunPages[1][1] = bk(2, { date: '2027-03-05', guests: 1, status: 'CANCELLED' })
  const r2 = await runBokunSync(db as any, 'schedule', new Date(NOW.getTime() + 600_000))
  assert.deepEqual([r2.ok, r2.added, r2.changed], [true, 0, 1])
  assert.equal(db.tables.bokun_bookings.length, 52)
  assert.equal(db.tables.bokun_bookings.find((b) => b.bokun_booking_id === '2').status, 'CANCELLED')
  assert.equal(db.tables.bokun_sync_log.length, 3, 'already-logged nights are not logged again')
  assert.deepEqual(db.tables.bokun_sync_runs.map((r) => [r.trigger, r.ok]), [['manual', true], ['schedule', true]])
})

test('run: a Bókun error is recorded and nothing is half-saved; overlapping runs are skipped', async () => {
  globalThis.fetch = (async () => new Response('{"message":"nope"}', { status: 401 })) as any
  const r = await runBokunSync(db as any, 'schedule', NOW)
  assert.equal(r.ok, false)
  assert.match(r.error!, /Bókun API 401/)
  assert.equal(db.tables.bokun_bookings.length, 0)
  assert.equal(db.tables.bokun_sync_runs[0].ok, false)

  db.insertRow('bokun_sync_runs', { trigger: 'schedule', started_at: NOW.toISOString(), finished_at: null })
  const again = await runBokunSync(db as any, 'manual', new Date(NOW.getTime() + 60_000))
  assert.match(again.skipped ?? '', /already running/)
})

test('older database without booking codes: the comparison still loads', async () => {
  db.failRules.push({ table: 'ota_bookings', op: 'select', when: (b) => b.cols.includes('booking_ref'), message: 'column ota_bookings.booking_ref does not exist' })
  bokunPages = [[bk(1, { date: '2027-03-05', guests: 2 })]]
  const r = await runBokunSync(db as any, 'manual', NOW)
  assert.equal(r.ok, true, r.error)
  assert.equal(r.fetched, 1)
})

test('cron endpoint needs the secret', async () => {
  const call = (auth?: string) => cron.POST(new NextRequest('http://localhost/api/cron/bokun-sync', { method: 'POST', headers: auth ? { authorization: auth } : {} }))
  assert.equal((await call()).status, 401)
  assert.equal((await call('Bearer wrong')).status, 401)
  bokunPages = [[bk(1, { date: '2027-03-05' })]]
  const ok = await call('Bearer ' + 'x'.repeat(32))
  assert.equal(ok.status, 200)
  assert.equal(db.tables.bokun_bookings.length, 1)
})

// ── The owner's buttons ─────────────────────────────────────────────────
const imp = await import('../app/api/admin/bokun/import/route.ts')
const { loadPlan } = await import('../lib/bokun/sync.ts')
const press = async (body: object) => {
  const res: Response = await imp.POST(new NextRequest('http://localhost/api/admin/bokun/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
  return { status: res.status, json: await res.json() }
}
// The routes use the real clock; use dates safely in the future.
function nextDow(dow: number, fromDays = 30) {
  const d = new Date(Date.now() + fromDays * 864e5)
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const FUTURE_WED = nextDow(3)
const FUTURE_FRI = nextDow(5)
const FUTURE_SAT = nextDow(6)

async function seed(bookings: any[]) {
  bokunPages = [bookings]
  const r = await runBokunSync(db as any, 'manual')
  assert.equal(r.ok, true, r.error)
}

test('Import: ticked bookings land on the night (created OFF when missing), with code, name and real email only; pressing twice adds nothing', async () => {
  await seed([
    bk(11, { date: FUTURE_WED, guests: 2, name: 'Ann', email: 'ann@example.test' }),
    bk(12, { date: FUTURE_WED, guests: 1, channel: 'GetYourGuide', code: 'GET-12', ref: 'GYGTEST12', email: 'x@reply.getyourguide.com', phone: '+66811111111' }),
    bk(13, { date: FUTURE_WED, guests: 3 }),
  ])
  const r = await press({ action: 'import', date: FUTURE_WED, bokunIds: ['11', '12'] })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual(r.json.imported, ['TA11', 'GYGTEST12'])
  assert.deepEqual([r.json.night.name, r.json.night.isOpen, r.json.night.created], ['Bangkok Club Crawl', false, true])
  const night = db.tables.event_dates.find((e) => e.event_date === FUTURE_WED)
  assert.deepEqual([night.night_slug, night.is_open, night.capacity, night.product_id], ['club-crawl', false, 10, 'p-bcc'])
  const rows = db.tables.ota_bookings
  assert.deepEqual(rows.map((o) => [o.source, o.booking_ref, o.quantity, o.guest_email, o.night_slug]), [
    ['airbnb', 'TA11', 2, 'ann@example.test', 'club-crawl'],
    ['getyourguide', 'GYGTEST12', 1, null, 'club-crawl'],
  ], 'the masked GetYourGuide address is never stored as the guest email')

  const again = await press({ action: 'import', date: FUTURE_WED, bokunIds: ['11', '12', '13'] })
  assert.deepEqual([again.json.imported, again.json.skipped.length], [['TA13'], 2])
  assert.equal(db.tables.ota_bookings.length, 3)
  assert.equal(db.tables.event_dates.filter((e) => e.event_date === FUTURE_WED).length, 1, 'one night only')

  const plan = (await loadPlan(db as any)).find((p) => p.date === FUTURE_WED)!
  assert.deepEqual([plan.newBookings.length, plan.dashboard.guests, plan.bokun.guests], [0, 6, 6], 'now matches Bókun')
})

test('Import refuses cancelled or moved bookings; a past date without a night gets one created OFF', async () => {
  await seed([bk(21, { date: FUTURE_FRI, status: 'CANCELLED' }), bk(22, { date: FUTURE_FRI })])
  const r = await press({ action: 'import', date: FUTURE_FRI, bokunIds: ['21'] })
  assert.equal(r.status, 409)
  assert.match(r.json.error, /cancelled in Bókun/)
  const wrongDate = await press({ action: 'import', date: FUTURE_WED, bokunIds: ['22'] })
  assert.equal(wrongDate.status, 409)
  assert.equal(db.tables.ota_bookings.length, 0)
  // Imported onto the existing Friday night (TGIF in the seed is a different year; a new one is created OFF).
  const ok = await press({ action: 'import', date: FUTURE_FRI, bokunIds: ['21', '22'] })
  assert.deepEqual([ok.status, ok.json.imported, ok.json.night.name], [200, ['TA22'], 'TGIF Bangkok'])

  // A past date without a night: the owner records who came; the night is created OFF.
  db.tables.bokun_bookings.push({ ...db.tables.bokun_bookings[0], bokun_booking_id: '99', event_date: '2020-01-03', status: 'CONFIRMED', platform_code: 'TA99' })
  const past = await press({ action: 'import', date: '2020-01-03', bokunIds: ['99'] })
  assert.deepEqual([past.status, past.json.night.created, past.json.night.isOpen], [200, true, false])
})

test('Use Bókun’s number and Open for website (only on the owner’s tap, never a started or cancelled night)', async () => {
  await seed([bk(31, { date: FUTURE_FRI, guests: 4 })])
  await press({ action: 'import', date: FUTURE_FRI, bokunIds: ['31'] })
  const row = db.tables.ota_bookings[0]
  row.quantity = 2 // typed differently on the dashboard
  let plan = (await loadPlan(db as any)).find((p) => p.date === FUTURE_FRI)!
  const diff = plan.issues.find((i) => i.kind === 'guests_differ')!
  const fix = await press({ action: 'use_bokun_count', otaId: diff.otaId, bokunId: diff.bokunId })
  assert.deepEqual([fix.status, fix.json.from, fix.json.to, row.quantity], [200, 2, 4, 4])

  const night = db.tables.event_dates.find((e) => e.event_date === FUTURE_FRI)
  assert.equal(night.is_open, false, 'importing never opens a night')
  const open = await press({ action: 'open', eventId: night.id })
  assert.deepEqual([open.status, night.is_open], [200, true])
  assert.equal((await press({ action: 'open', eventId: night.id })).json.alreadyOpen, true)

  const cancelled = db.insertRow('event_dates', { product_id: 'p-bcc', event_date: FUTURE_SAT, night_slug: 'saturday-signature', is_open: false, operation_verdict: 'Cancelled / Rescheduled' })
  assert.equal((await press({ action: 'open', eventId: cancelled.id })).status, 409)
  const past = db.insertRow('event_dates', { product_id: 'p-bcc', event_date: '2020-01-04', night_slug: 'saturday-signature', is_open: false })
  assert.equal((await press({ action: 'open', eventId: past.id })).status, 409)
  assert.equal(past.is_open, false)
})

test('Moved guest: import a past booking onto the next night — saved as rescheduled with the booked date; matched on both cards', async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
  const add = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
  const booked = add(today, -3)
  const joined = add(today, -2)
  const joinedNight = db.insertRow('event_dates', { product_id: 'p-bcc', event_date: joined, night_slug: 'club-crawl', night_name: 'Bangkok Club Crawl', is_open: false })
  await seed([bk(41, { date: booked, guests: 1 })])

  assert.ok(joinedNight)
  const r = await press({ action: 'import', date: booked, bokunIds: ['41'], targetDate: joined })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.night.date, joined)
  const row = db.tables.ota_bookings[0]
  assert.deepEqual([row.event_date, row.night_slug, row.booking_status, row.booked_for_date, row.booking_ref], [joined, 'club-crawl', 'rescheduled', booked, 'TA41'])

  const plan = await loadPlan(db as any)
  const bookedCard = plan.find((p) => p.date === booked)!
  assert.deepEqual([bookedCard.newBookings.length, bookedCard.onDashboard[0].onDate], [0, joined])
  assert.ok(!bookedCard.issues.some((i) => i.kind === 'not_in_bokun' || i.kind === 'no_night'), JSON.stringify(bookedCard.issues))
  const joinedCard = plan.find((p) => p.date === joined)!
  assert.ok(!joinedCard.issues.some((i) => i.kind === 'not_in_bokun'), 'counted on the night they joined, not flagged as a stray')
  assert.equal(joinedCard.dashboard.guests, 1)
})

test('Move: to any date within 60 days (night created OFF if missing); moving back clears the reschedule; further is refused', async () => {
  await seed([bk(51, { date: FUTURE_FRI, guests: 2 })])
  await press({ action: 'import', date: FUTURE_FRI, bokunIds: ['51'] })
  const fri = db.tables.event_dates.find((e) => e.event_date === FUTURE_FRI)
  const sat = db.insertRow('event_dates', { product_id: 'p-bcc', event_date: FUTURE_SAT, night_slug: 'saturday-signature', night_name: 'Signature Night', is_open: true })
  const row = db.tables.ota_bookings[0]
  assert.ok(fri && sat)

  const m = await press({ action: 'move', otaId: row.id, targetDate: FUTURE_SAT })
  assert.equal(m.status, 200, JSON.stringify(m.json))
  assert.deepEqual([row.event_date, row.night_slug, row.booking_status, row.booked_for_date], [FUTURE_SAT, 'saturday-signature', 'rescheduled', FUTURE_FRI])
  const plus = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
  assert.equal((await press({ action: 'move', otaId: row.id, targetDate: plus(FUTURE_FRI, 61) })).status, 409, 'more than 60 days from the booked date')
  const tue = plus(FUTURE_FRI, 4)
  const t = await press({ action: 'move', otaId: row.id, targetDate: tue })
  assert.equal(t.status, 200)
  const created = db.tables.event_dates.find((e) => e.event_date === tue)
  assert.deepEqual([created.night_slug, created.is_open, row.event_date, row.booked_for_date], ['club-crawl', false, tue, FUTURE_FRI], 'a date without a night gets one, OFF')
  const back = await press({ action: 'move', otaId: row.id, targetDate: FUTURE_FRI })
  assert.equal(back.status, 200)
  assert.deepEqual([row.event_date, row.booking_status, row.booked_for_date], [FUTURE_FRI, null, null])

  row.booking_status = 'refunded'
  assert.equal((await press({ action: 'move', otaId: row.id, targetDate: FUTURE_SAT })).status, 409, 'refunded bookings are not moved from here')
})

test('period tabs: Monday–Sunday weeks and calendar months around today', async () => {
  const { periods } = await import('../lib/bokun/periods.ts')
  const p = Object.fromEntries(periods('2026-11-26').map((x) => [x.key, [x.from, x.to]]))  // a Thursday
  assert.deepEqual(p['last-month'], ['2026-10-01', '2026-10-31'])
  assert.deepEqual(p['last-week'], ['2026-11-16', '2026-11-22'])
  assert.deepEqual(p['this-week'], ['2026-11-23', '2026-11-29'])
  assert.deepEqual(p['next-week'], ['2026-11-30', '2026-12-06'])
  assert.deepEqual(p['this-month'], ['2026-11-01', '2026-11-30'])
  assert.deepEqual(p['next-month'], ['2026-12-01', '2026-12-31'])
  assert.equal(p['later'][0], '2027-01-01')
  assert.deepEqual(Object.fromEntries(periods('2026-11-30').map((x) => [x.key, x.from]))['this-week'], '2026-11-30', 'a Monday starts its own week')
})
