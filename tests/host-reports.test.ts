// Host after-event report, host-paid expenses with receipts, owner review and
// payout, "My earnings". Real route handlers against the in-memory database;
// email and storage are stand-ins. No network.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { FakeDb } from './helpers/fakeDb.ts'

delete process.env.VERCEL_ENV
process.env.RESEND_FROM = 'test@example.test'
process.env.ADMIN_NOTIFY_EMAIL = 'owner@example.test'
globalThis.fetch = (async () => { throw new Error('network is blocked in this test') }) as typeof fetch

const night = await import('../app/api/admin/host/events/[id]/route.ts')
const expenses = await import('../app/api/admin/host/events/[id]/expenses/route.ts')
const report = await import('../app/api/admin/host/events/[id]/report/route.ts')
const review = await import('../app/api/admin/host-reports/[eventId]/route.ts')
const list = await import('../app/api/admin/host-reports/route.ts')
const earnings = await import('../app/api/admin/host/earnings/route.ts')

const ICE = { userId: 'host-ice', role: 'staff', email: 'ice@example.test', displayName: 'Ice' }
const BOOM = { userId: 'host-boom', role: 'staff', email: 'boom@example.test', displayName: 'Boom' }
const day = (n: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(Date.now() + n * 864e5))
let db: FakeDb
let ev: any
beforeEach(() => {
  db = new FakeDb()
  Object.assign(globalThis as any, { __db: db, __mail: { sent: [], next: [] }, __admin: ICE })
  db.insertRow('products', { id: 'p-bcc', slug: 'bangkok-club-crawl', status: 'active' })
  ev = db.insertRow('event_dates', {
    id: '22222222-2222-4222-8222-222222222222', product_id: 'p-bcc', event_date: day(-1), night_slug: 'tgif', night_name: 'TGIF Bangkok',
    host_assigned: 'Ice', is_open: false, venue_route: { venue1: 'Levels', venue2: 'Sugar Club', venue3: '' }, host_fee_final: null, host_payment_status: 'Not calculated', operation_verdict: 'Completed',
  })
  db.insertRow('bookings', { id: 'b1', event_date: ev.event_date, night_slug: 'tgif', status: 'confirmed', guest_name: 'Ann', quantity: 2, attendance_status: 'checked_in', source: 'website' })
  db.insertRow('ota_bookings', { id: 'o1', event_date: ev.event_date, night_slug: 'tgif', guest_name: 'Ben', quantity: 1, attendance_status: 'no_show', source: 'airbnb' })
})

const ctx = { params: { id: '22222222-2222-4222-8222-222222222222', eventId: '22222222-2222-4222-8222-222222222222' } }
async function call(handler: any, method: string, body?: any, url = 'http://localhost/x') {
  const init: any = { method }
  if (body instanceof FormData) init.body = body
  else if (body) { init.body = JSON.stringify(body); init.headers = { 'content-type': 'application/json' } }
  const res: Response = await handler(new NextRequest(url, init), ctx)
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) }
}
function expenseForm(o: { category?: string; amount?: string; note?: string; file?: { type: string; bytes: number } }) {
  const fd = new FormData()
  fd.set('category', o.category ?? 'taxi'); fd.set('amount', o.amount ?? '250'); if (o.note) fd.set('note', o.note)
  if (o.file) fd.set('receipt', new File([new Uint8Array(o.file.bytes)], 'r', { type: o.file.type }))
  return fd
}

test('host expense with a receipt waits for approval and is not in the expenses ledger yet; other hosts are refused', async () => {
  const r = await call(expenses.POST, 'POST', expenseForm({ note: 'Grab venue 2 → 3', file: { type: 'image/jpeg', bytes: 2000 } }))
  assert.equal(r.status, 201, JSON.stringify(r.json))
  const exp = db.tables.host_expenses[0]
  assert.deepEqual([exp.status, exp.amount, exp.category, exp.host_name], ['pending', 250, 'taxi', 'Ice'])
  assert.ok(db.files[`host-receipts/${exp.receipt_path}`], 'receipt stored in the private bucket')
  assert.equal(db.tables.expenses.length, 0, 'not counted until approved')

  const n = await call(night.GET, 'GET')
  assert.deepEqual([n.json.expenses[0].status, n.json.expenses[0].hasReceipt, n.json.report.canStart], ['pending', true, true])
  assert.equal(JSON.stringify(n.json).includes('host_fee'), false)

  const link = await call(expenses.GET, 'GET', undefined, `http://localhost/x?receipt=${exp.id}`)
  assert.equal(link.status, 307)
  assert.match(link.headers.get('location')!, /storage\.test\/host-receipts\/.*expires=300/)

  assert.equal((await call(expenses.POST, 'POST', expenseForm({ file: { type: 'text/html', bytes: 10 } }))).status, 400, 'only photos/PDF')
  assert.equal((await call(expenses.POST, 'POST', expenseForm({ file: { type: 'image/png', bytes: 5 * 1024 * 1024 } }))).status, 400, 'max 4 MB')
  assert.equal((await call(expenses.POST, 'POST', expenseForm({ amount: '0' }))).status, 400)
  ;(globalThis as any).__admin = BOOM
  assert.equal((await call(expenses.POST, 'POST', expenseForm({}))).status, 403)
  assert.equal((await call(expenses.GET, 'GET', undefined, `http://localhost/x?receipt=${exp.id}`)).status, 403)
})

test('report: pre-filled guests and venues, draft autosave, submit locks it and emails the owner about incidents', async () => {
  const g = await call(report.GET, 'GET')
  assert.equal(g.json.canEdit, true)
  assert.deepEqual(g.json.report.guests.map((x: any) => [x.name, x.attendance]), [['Ann', 'checked_in'], ['Ben', 'no_show']])
  assert.deepEqual(g.json.report.venues.map((v: any) => v.venue), ['Levels', 'Sugar Club'])

  const draft = { ...g.json.report, vibe: '', guests: g.json.report.guests.map((x: any, i: number) => (i === 0 ? { ...x, name: 'HACKED', tags: ['travelling', 'vip', 'bogus'], nextStop: 'Phuket', comment: 'Loved Levels' } : x)) }
  assert.equal((await call(report.PUT, 'PUT', draft)).status, 200)
  const saved = db.tables.host_reports[0]
  assert.deepEqual([saved.status, saved.guests[0].name, saved.guests[0].tags, saved.guests[0].nextStop], ['draft', 'Ann', ['travelling', 'vip'], 'Phuket'], 'names come from the guest list; unknown tags dropped')

  assert.equal((await call(report.POST, 'POST', draft)).status, 400, 'needs a vibe line')
  const final = { ...draft, vibe: 'Great energy, full clubs', venues: [{ venue: 'Levels', comment: 'Packed <b>' }], incidents: [{ type: 'medical', what: 'Guest fainted <script>', action: 'Water, taxi home' }, { type: 'other', what: '' }] }
  const s = await call(report.POST, 'POST', final)
  assert.equal(s.status, 200, JSON.stringify(s.json))
  const rep = db.tables.host_reports[0]
  assert.deepEqual([rep.status, rep.incidents.length, rep.venues.map((v: any) => v.comment)], ['submitted', 1, ['Packed <b>', '']])
  const mail = (globalThis as any).__mail.sent
  assert.equal(mail.length, 1)
  assert.match(mail[0].subject, /Incident reported: TGIF Bangkok/)
  assert.ok(mail[0].html.includes('Guest fainted &lt;script&gt;'), 'host text is escaped in the email')
  assert.ok(rep.incident_alert_sent_at)

  assert.equal((await call(report.PUT, 'PUT', final)).status, 409, 'locked after submit')
  assert.equal((await call(report.GET, 'GET')).json.canEdit, false)
})

test('report opens on the night itself, not before; other hosts cannot read it', async () => {
  ev.event_date = day(2)
  assert.equal((await call(report.GET, 'GET')).json.canEdit, false)
  assert.equal((await call(report.PUT, 'PUT', { vibe: 'x' })).status, 409)
  ev.event_date = day(-1)
  ;(globalThis as any).__admin = BOOM
  assert.equal((await call(report.GET, 'GET')).status, 403)
})

test('owner review: approve copies into expenses; reject never counts; pay only after report + fee + no pending', async () => {
  await call(expenses.POST, 'POST', expenseForm({ category: 'drinks', amount: '600', note: 'shots' }))
  await call(expenses.POST, 'POST', expenseForm({ category: 'taxi', amount: '300' }))
  const [drinks, taxi] = db.tables.host_expenses
  ;(globalThis as any).__admin = { userId: 'test-owner', role: 'staff', displayName: 'Ice' }
  assert.equal((await call(review.GET, 'GET')).status, 403, 'hosts cannot use the owner review')
  ;(globalThis as any).__admin = undefined // owner

  let d = await call(review.GET, 'GET')
  assert.deepEqual([d.json.headcount.checkedIn, d.json.suggestedFee, d.json.waitingFor], [2, 1500, ['Ice']])

  assert.equal((await call(review.POST, 'POST', { action: 'approve_expense', id: drinks.id })).status, 200)
  assert.equal((await call(review.POST, 'POST', { action: 'approve_expense', id: drinks.id })).status, 409, 'approved once')
  assert.deepEqual(db.tables.expenses.map((e) => [e.category, e.amount, e.event_date, e.night_slug]), [['drinks', 600, ev.event_date, 'tgif']])
  assert.equal(drinks.expense_id, db.tables.expenses[0].id)
  assert.equal((await call(review.POST, 'POST', { action: 'reject_expense', id: taxi.id, note: 'No receipt' })).status, 200)
  assert.deepEqual([taxi.status, taxi.review_note, db.tables.expenses.length], ['rejected', 'No receipt', 1])

  // The host starts the report (draft): the fee can be set on it.
  ;(globalThis as any).__admin = ICE
  await call(report.PUT, 'PUT', { vibe: 'Good night' })
  ;(globalThis as any).__admin = undefined
  const repId = db.tables.host_reports[0].id
  assert.equal((await call(review.POST, 'POST', { action: 'set_fee', reportId: repId, amount: 1800 })).status, 200)
  assert.deepEqual([db.tables.host_reports[0].fee_thb, ev.host_fee_final, ev.host_payment_status], [1800, 1800, 'Calculated'], 'night totals follow the host fee')
  const early = await call(review.POST, 'POST', { action: 'mark_paid', reportId: repId })
  assert.equal(early.status, 409)
  assert.match(early.json.error, /hasn’t submitted/)

  ;(globalThis as any).__admin = ICE
  let mine = await call(earnings.GET, 'GET')
  assert.deepEqual([mine.json.nights[0].state, mine.json.totals.reportsDue], ['report_due', 1])
  await call(report.POST, 'POST', { vibe: 'Good night' })
  mine = await call(earnings.GET, 'GET')
  assert.deepEqual([mine.json.nights[0].state, mine.json.nights[0].fee, mine.json.nights[0].expenses, mine.json.nights[0].total, mine.json.totals.readyToPay], ['ready_to_pay', 1800, 600, 2400, 2400])
  assert.equal(JSON.stringify(mine.json).includes('1200'), false, 'no ticket prices')

  ;(globalThis as any).__admin = undefined
  const all = await call(list.GET, 'GET')
  assert.deepEqual(all.json.nights.map((n: any) => [n.host, n.reportStatus, n.payout, n.approvedExpenses]), [['Ice', 'submitted', 'ready_to_pay', 600]])
  assert.equal((await call(review.POST, 'POST', { action: 'mark_paid', reportId: repId })).status, 200)
  assert.equal(ev.host_payment_status, 'Paid')
  assert.equal((await call(review.POST, 'POST', { action: 'set_fee', reportId: repId, amount: 1 })).status, 409, 'fee locked once paid')
})

test('a pending expense blocks Mark paid; the host can remove only their own pending expense', async () => {
  await call(expenses.POST, 'POST', expenseForm({ file: { type: 'application/pdf', bytes: 100 } }))
  const exp = db.tables.host_expenses[0]
  await call(report.POST, 'POST', { vibe: 'Fine' })
  ;(globalThis as any).__admin = undefined
  await call(review.POST, 'POST', { action: 'set_fee', amount: 1500 })
  assert.match((await call(review.POST, 'POST', { action: 'mark_paid' })).json.error, /expenses first/)
  ;(globalThis as any).__admin = BOOM
  assert.equal((await call(expenses.DELETE, 'DELETE', { id: exp.id })).status, 409)
  ;(globalThis as any).__admin = ICE
  assert.equal((await call(expenses.DELETE, 'DELETE', { id: exp.id })).status, 200)
  assert.equal(Object.keys(db.files).length, 0, 'receipt removed too')
})

test('report lists the route venues even when some stops are skipped (venue1, venue3, venue4)', async () => {
  ev.venue_route = { venue1: 'DOTF', venue3: 'Singsing', venue4: 'Cavo' }
  const g = await call(report.GET, 'GET')
  assert.deepEqual(g.json.report.venues.map((v: any) => v.venue), ['DOTF', 'Singsing', 'Cavo'])
  // A draft saved before the route was set still picks the route up later.
  ev.venue_route = {}
  await call(report.PUT, 'PUT', { vibe: 'x' })
  ev.venue_route = { venue1: 'DOTF' }
  assert.deepEqual((await call(report.GET, 'GET')).json.report.venues.map((v: any) => v.venue), ['DOTF'])
})

test('a night stays open to its host for 24 hours (crawls run past midnight)', async () => {
  const { hostWindowStart } = await import('../lib/dates.ts')
  assert.equal(hostWindowStart(new Date('2026-11-26T19:39:00Z')), '2026-11-26', '02:39 on the 27th: the 26th night is still listed')
  assert.equal(hostWindowStart(new Date('2026-11-27T14:30:00Z')), '2026-11-26', '21:30 on the 27th: still listed (24 h)')
  assert.equal(hostWindowStart(new Date('2026-11-27T17:01:00Z')), '2026-11-27', 'after midnight on the 28th: the 26th has left the list')
})

test('two hosts: both see the night, each writes their own report and is paid separately; the night is Paid only when both are', async () => {
  const hostEvents = await import('../app/api/admin/host/events/route.ts')
  ev.host_assigned_2 = 'Boom'
  ;(globalThis as any).__admin = BOOM
  const listed = await call(hostEvents.GET, 'GET', undefined, 'http://localhost/api/admin/host/events')
  assert.ok(listed.json.events.some((e: any) => e.id === ev.id), 'second host sees the night')
  assert.equal((await call(night.GET, 'GET')).status, 200)
  await call(report.POST, 'POST', { vibe: 'Van 2 was wild' })
  ;(globalThis as any).__admin = ICE
  const iceDraft = await call(report.GET, 'GET')
  assert.equal(iceDraft.json.status, 'none', 'Ice has her own (empty) report')
  await call(report.POST, 'POST', { vibe: 'Van 1 smooth' })
  assert.equal(db.tables.host_reports.length, 2)

  ;(globalThis as any).__admin = undefined
  const d = await call(review.GET, 'GET')
  assert.deepEqual(d.json.reports.map((r: any) => r.hostName).sort(), ['Boom', 'Ice'])
  assert.equal(d.json.suggestedFee, 750, 'night suggestion shared between two hosts')
  const boom = d.json.reports.find((r: any) => r.hostName === 'Boom')
  const ice = d.json.reports.find((r: any) => r.hostName === 'Ice')
  await call(review.POST, 'POST', { action: 'set_fee', reportId: boom.id, amount: 1000 })
  await call(review.POST, 'POST', { action: 'set_fee', reportId: ice.id, amount: 1200 })
  assert.deepEqual([ev.host_fee_final, ev.host_payment_status], [2200, 'Calculated'])
  assert.equal((await call(review.POST, 'POST', { action: 'mark_paid' })).status, 400, 'must say which host')
  await call(review.POST, 'POST', { action: 'mark_paid', reportId: boom.id })
  assert.equal(ev.host_payment_status, 'Calculated', 'one of two paid')
  ;(globalThis as any).__admin = BOOM
  const boomEarn = await call(earnings.GET, 'GET')
  assert.deepEqual([boomEarn.json.nights[0].state, boomEarn.json.nights[0].fee], ['paid', 1000])
  ;(globalThis as any).__admin = undefined
  await call(review.POST, 'POST', { action: 'mark_paid', reportId: ice.id })
  assert.equal(ev.host_payment_status, 'Paid')
})

test('nights before reports started: no report due, host taps "I hosted", owner can then set the fee', async () => {
  ev.event_date = '2026-10-23'
  const e1 = await call(earnings.GET, 'GET')
  assert.deepEqual(e1.json.nights.map((n: any) => n.state), ['confirm_hosted'])
  assert.equal(e1.json.totals.reportsDue, 0)
  const r = await call(report.PATCH, 'PATCH', { action: 'confirm_hosted' })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const rep = db.tables.host_reports[0]
  assert.deepEqual([rep.status, rep.confirmed_only, rep.host_name], ['submitted', true, 'Ice'])
  assert.deepEqual((await call(earnings.GET, 'GET')).json.nights.map((n: any) => n.state), ['in_review'])
  // A night from 26 Nov on still needs the real report.
  ev.event_date = '2026-11-26'
  db.tables.host_reports.length = 0
  assert.equal((await call(report.PATCH, 'PATCH', { action: 'confirm_hosted' })).status, 409)
})
