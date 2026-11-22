// Phase 3B unit tests (pure logic, no network, no database).
// Run: node --test --experimental-strip-types tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyInstance,
  isFriOrSat,
  isWaitlistEligible,
  isPastBookingCutoff,
  isCancelledEvent,
  BCC_PRODUCT_SLUG,
  type InstanceFacts,
} from '../lib/bookingAvailability.ts'
import {
  checkReopenRecipient,
  pickNextBookable,
  seatCap,
  soldOutConsentText,
  SOLD_OUT_SCOPE,
  type SoldOutSubscriber,
} from '../lib/waitlist/soldOut.ts'

// 2027-01-08 is a Friday, -09 Saturday, -07 Thursday.
// "now" = Wed 2027-01-06 12:00 Bangkok (05:00 UTC).
const NOW = new Date('2027-01-06T05:00:00Z')

const base: InstanceFacts = {
  eventDate: '2027-01-08',
  isOpen: true,
  operationVerdict: 'Pending',
  capacity: 12,
  taken: 12,
  productSlug: BCC_PRODUCT_SLUG,
  productStatus: 'active',
  visible: true,
  startTime: '21:30:00',
  price: 1200,
}
const f = (o: Partial<InstanceFacts>): InstanceFacts => ({ ...base, ...o })

test('Friday/Saturday detection uses the calendar date, no timezone shift', () => {
  assert.equal(isFriOrSat('2027-01-08'), true)
  assert.equal(isFriOrSat('2027-01-09'), true)
  assert.equal(isFriOrSat('2027-01-07'), false)
  assert.equal(isFriOrSat('2027-01-10'), false)
})

test('a genuinely full Fri/Sat Club Crawl night is sold_out and waitlist-eligible', () => {
  assert.deepEqual(classifyInstance(base, NOW), { state: 'sold_out', remaining: 0 })
  assert.equal(isWaitlistEligible(base, NOW), true)
  assert.equal(isWaitlistEligible(f({ taken: 15 }), NOW), true) // over-booked by OTA still sold out
})

test('every non-full reason is distinguished and never waitlist-eligible', () => {
  const cases: [Partial<InstanceFacts>, string][] = [
    [{ taken: 11 }, 'bookable'],
    [{ capacity: null, taken: 50 }, 'bookable'],
    [{ operationVerdict: 'Cancelled / Rescheduled' }, 'cancelled'],
    [{ isOpen: false }, 'closed'],
    [{ capacity: 0, taken: 0 }, 'closed'], // closed by the team, not sold out
    [{ productStatus: 'draft' }, 'unpublished'],
    [{ visible: false }, 'unpublished'],
    [{ price: null }, 'no_price'],
    [{ price: 0 }, 'no_price'],
    [{ eventDate: '2027-01-01' }, 'past'],
  ]
  for (const [o, state] of cases) {
    assert.equal(classifyInstance(f(o), NOW).state, state, JSON.stringify(o))
    assert.equal(isWaitlistEligible(f(o), NOW), false, JSON.stringify(o))
  }
})

test('cancelled wins over closed; past wins over everything', () => {
  assert.equal(classifyInstance(f({ isOpen: false, operationVerdict: 'Cancelled / Rescheduled' }), NOW).state, 'cancelled')
  assert.equal(classifyInstance(f({ eventDate: '2027-01-01', productStatus: 'draft' }), NOW).state, 'past')
})

test('cutoff: on the night after 21:30 Bangkok the date is "cutoff", not sold out', () => {
  const fridayNight = new Date('2027-01-08T15:00:00Z') // 22:00 Bangkok
  const fridayEvening = new Date('2027-01-08T13:00:00Z') // 20:00 Bangkok
  assert.equal(classifyInstance(base, fridayNight).state, 'cutoff')
  assert.equal(isWaitlistEligible(base, fridayNight), false)
  assert.equal(classifyInstance(base, fridayEvening).state, 'sold_out')
})

test('only Bangkok Club Crawl and only Fri/Sat may offer the waitlist', () => {
  assert.equal(isWaitlistEligible(f({ productSlug: 'new-in-bkk' }), NOW), false)
  assert.equal(isWaitlistEligible(f({ productSlug: 'smc' }), NOW), false)
  assert.equal(classifyInstance(f({ eventDate: '2027-01-07' }), NOW).state, 'sold_out')
  assert.equal(isWaitlistEligible(f({ eventDate: '2027-01-07' }), NOW), false)
})

test('classifyInstance mirrors the existing /api/events + checkout gates', () => {
  // Same building blocks checkout uses — sanity that nothing drifted.
  assert.equal(isCancelledEvent({ operation_verdict: 'Cancelled / Rescheduled' }), true)
  assert.equal(isPastBookingCutoff('2027-01-08', '21:30:00', BCC_PRODUCT_SLUG, new Date('2027-01-08T14:30:00Z')), true)
  // a bookable instance is exactly one that passes every gate with seats left
  assert.equal(classifyInstance(f({ taken: 0 }), NOW).state, 'bookable')
  assert.equal(classifyInstance(f({ taken: 0 }), NOW).remaining, 12)
})

test('consent text is dated, names the night, and says no reservation', () => {
  const t = soldOutConsentText('TGIF', '2027-01-08')
  assert.match(t, /TGIF on Friday 8 January 2027/)
  assert.match(t, /does not reserve a seat or guarantee entry/)
  assert.match(t, /this date only/)
  assert.match(t, /unsubscribe/i)
})

const ev = (eventId: string, eventDate: string, remaining: number | null, productSlug = BCC_PRODUCT_SLUG) => ({ eventId, eventDate, remaining, productSlug })

test('next bookable night: first after the sold-out date that fits the party', () => {
  const events = [ev('a', '2027-01-02', 10), ev('b', '2027-01-09', 1), ev('c', '2027-01-15', 6), ev('d', '2027-01-16', null)]
  assert.equal(pickNextBookable(events, '2027-01-08', 1, BCC_PRODUCT_SLUG)?.eventId, 'b')
  assert.equal(pickNextBookable(events, '2027-01-08', 2, BCC_PRODUCT_SLUG)?.eventId, 'c')
  assert.equal(pickNextBookable(events, '2027-01-08', 7, BCC_PRODUCT_SLUG)?.eventId, 'd') // no limit fits any party
  assert.equal(pickNextBookable(events, '2027-01-08', null, BCC_PRODUCT_SLUG)?.eventId, 'b') // unknown party: any seat
})

test('next bookable night: falls back to the nearest earlier night, never invents one', () => {
  const events = [ev('a', '2027-01-02', 10), ev('a2', '2027-01-03', 10)]
  assert.equal(pickNextBookable(events, '2027-01-08', 2, BCC_PRODUCT_SLUG)?.eventId, 'a2')
  assert.equal(pickNextBookable([], '2027-01-08', 2, BCC_PRODUCT_SLUG), null)
  assert.equal(pickNextBookable([ev('x', '2027-01-09', 1)], '2027-01-08', 2, BCC_PRODUCT_SLUG), null)
  // other products are never offered as the Club Crawl alternative
  assert.equal(pickNextBookable([ev('n', '2027-01-09', 9, 'new-in-bkk')], '2027-01-08', 2, BCC_PRODUCT_SLUG), null)
})

test('seat cap never exceeds seats left or the order limit', () => {
  assert.equal(seatCap(4, 2), 2)
  assert.equal(seatCap(4, 10), 4)
  assert.equal(seatCap(30, null), 24)
  assert.equal(seatCap(4, 0), 0)
})

const sub = (o: Partial<SoldOutSubscriber> = {}): SoldOutSubscriber => ({
  email: 'guest@example.test',
  product_slug: BCC_PRODUCT_SLUG,
  consent_scope: SOLD_OUT_SCOPE,
  consented_at: '2027-01-05T10:00:00Z',
  consent_text: 'x',
  event_date_id: 'E1',
  party_size: 2,
  unsubscribed_at: null,
  notified_at: null,
  ...o,
})
const target = { productSlug: BCC_PRODUCT_SLUG, eventDateId: 'E1', seatCap: 2 }
const ok = { alreadyNotified: false, alreadyBooked: false, emailValid: true }

test('send-time recipient re-check', () => {
  assert.deepEqual(checkReopenRecipient(sub(), target, ok), { ok: true })
  const skipped = (s: SoldOutSubscriber | null, t = target, c = ok) => {
    const r = checkReopenRecipient(s, t, c)
    assert.equal(r.ok, false)
    return (r as { reason: string }).reason
  }
  assert.match(skipped(null), /removed/)
  assert.match(skipped(sub({ unsubscribed_at: '2027-01-06T00:00:00Z' })), /unsubscribed/)
  assert.match(skipped(sub({ consent_scope: 'event_dates' })), /consent/) // NIB audience never crosses over
  assert.match(skipped(sub({ consented_at: null })), /consent/)
  assert.match(skipped(sub({ event_date_id: 'E2' })), /different date/)
  assert.match(skipped(sub({ product_slug: 'new-in-bkk' })), /different date/)
  assert.match(skipped(sub({ notified_at: '2027-01-06T00:00:00Z' })), /already sent/)
  assert.match(skipped(sub(), target, { ...ok, alreadyNotified: true }), /already sent/)
  assert.match(skipped(sub(), target, { ...ok, alreadyBooked: true }), /already booked/)
  assert.match(skipped(sub(), target, { ...ok, emailValid: false }), /invalid email/)
  assert.match(skipped(sub({ party_size: 3 })), /more than the 2 seat/)
})

test('date wording is deterministic (no locale dependence)', async () => {
  const { longEventDate } = await import('../lib/waitlist/soldOut.ts')
  assert.equal(longEventDate('2026-11-28'), 'Saturday 28 November 2026')
  assert.equal(longEventDate('2027-01-08'), 'Friday 8 January 2027')
})
