// Bókun client signing and contact classification (pure, no network).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { bokunDate, bokunSignature } from '../lib/bokun/client.ts'
import { classifyEmail, cleanPhone, maskTail } from '../lib/bokun/contact.ts'
import { outline, summariseBooking } from '../lib/bokun/inspect.ts'

test('signature = base64 HmacSHA1(secret, date + accessKey + METHOD + path) — Bókun docs recipe', () => {
  const date = '2026-11-26 10:00:00'
  const expected = createHmac('sha1', 'secret').update(date + 'access' + 'POST' + '/booking.json/booking-search').digest('base64')
  assert.equal(bokunSignature('secret', date, 'access', 'post', '/booking.json/booking-search'), expected)
  assert.equal(bokunDate(new Date('2026-11-26T03:04:05.678Z')), '2026-11-26 03:04:05')
})

test('platform forwarding emails are "masked", guest emails are "real"', () => {
  assert.equal(classifyEmail('x123@reply.getyourguide.com').kind, 'masked')
  assert.equal(classifyEmail('guest-abc@messaging.tripadvisor.com').kind, 'masked')
  assert.equal(classifyEmail('someone@guest.airbnb.com').kind, 'masked')
  assert.equal(classifyEmail('Person@Gmail.com').kind, 'real')
  assert.equal(classifyEmail('Person@Gmail.com').email, 'person@gmail.com')
  assert.equal(classifyEmail('').kind, 'none')
  assert.equal(classifyEmail('not-an-email').kind, 'none')
  assert.equal(classifyEmail('a@notviator.com').kind, 'real', 'look-alike domains are not platforms')
})

test('phones kept only when plausible; masked tail for display', () => {
  assert.equal(cleanPhone('+66 81-234-5678'), '+66812345678')
  assert.equal(cleanPhone('123'), null)
  assert.equal(cleanPhone(undefined), null)
  assert.equal(maskTail('+66812345678'), '•••678')
})

test('summary keeps codes/channel/guests and reduces personal data; outline has no values', () => {
  const raw = {
    id: 99, confirmationCode: 'THE-123', externalBookingReference: 'GYGABC', bookingChannel: { title: 'GetYourGuide' },
    customer: { firstName: 'Alex', lastName: 'Smith', email: 'x@reply.getyourguide.com', phoneNumber: '+66 81 234 5678' },
    productBookings: [{ status: 'CONFIRMED', product: { id: 1070079 }, startDate: '2026-11-28', totalParticipants: 3 }],
  }
  const s = summariseBooking(raw)
  assert.deepEqual(
    [s.bokunCode, s.platformCode, s.channel, s.status, s.productId, s.date, s.guests, s.guestInitials, s.emailKind, s.phone],
    ['THE-123', 'GYGABC', 'GetYourGuide', 'CONFIRMED', 1070079, '2026-11-28', 3, 'AS', 'masked', '•••678']
  )
  const o = JSON.stringify(outline({ items: [raw] }))
  assert.ok(!o.includes('Alex') && !o.includes('reply.getyourguide') && !o.includes('2345678'), 'outline leaks no values')
})
