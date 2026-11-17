// Bangkok Club Crawl — founder-confirmed operating terms (Phase 2, 17 Nov 2026).
//
// The ONE place guest-facing BCC terms live, so the homepage FAQ, /weekends,
// the night pages, the booking calendar's pre-payment summary, the
// booking-success page and the "tonight is confirmed" email can't drift apart
// again. BCC only — BEST Nightlife Thailand, New in Bangkok and Single Meet
// Club have their own terms and must not import this.
//
// Copy only. Prices, event times and availability still come from the
// database / checkout (lib/pricing.ts, /api/events, /api/create-checkout);
// nothing here is used to compute a charge or gate a booking.
//
// Deliberately NOT stated anywhere (not approved yet): an end time, a
// venue-substitution policy, no-show or removal penalties, rescheduling fees,
// tax/fee treatment, and the currency the guest's card is charged in.

export const BCC_TERMS = {
  days: 'Every Friday and Saturday',
  startTime: '9:30 PM',
  meetingArea: 'Sukhumvit Soi 11, Bangkok',
  meetingNote:
    'The exact meeting venue depends on the night’s route — it’s confirmed in your booking instructions and the event WhatsApp group.',

  priceLabel: '฿1,200',
  priceNote:
    '฿1,200 per person is our special price when you book directly with Bangkok Club Crawl. Third-party booking platforms may charge a different price.',

  shots: '3–4 complimentary shots during the night',
  noFullDrinks: 'No complimentary full-sized drinks are included.',
  drinkRule:
    'Each guest is required to purchase at least one drink at every venue. Drinks purchased at the venues are not included in your ticket.',

  lateArrival: [
    'Please arrive on time — the night starts at 9:30 PM.',
    'Running late? Let your host know in the event WhatsApp group chat.',
    'After 10:20 PM, you must contact your host directly through the WhatsApp group.',
    'Late joining can’t be guaranteed once the night is underway, because your host stays with the group. We aren’t able to offer individual pickups or transfers.',
  ],
  lateArrivalShort:
    'Running late? Message your host in the event WhatsApp group. After 10:20 PM you must contact your host there directly — late joining can’t be guaranteed once the group has moved on.',

  minimumGroup:
    'Each night needs a minimum of 5 guests. If fewer than 5 are booked, we decide at 7:00 PM on the night whether it goes ahead.',
  organizerCancellation:
    'If we cancel a night, you’ll be offered a full refund or a move to another available date.',
  guestCancellation:
    'Direct bookings are non-refundable once the night goes ahead, subject to applicable consumer protection law.',
  rescheduling:
    'You can ask to reschedule to another date. Rescheduling depends on availability on the new date and isn’t guaranteed.',
  thirdParty:
    'Booked through a third-party platform? That platform’s cancellation and amendment terms apply.',

  age: 'Minimum age 20. Please bring valid photo ID — venues may check it at the door.',
  dressCode: 'Smart casual, suited to upscale nightlife venues.',
  dressCodeNotPermitted: 'Please skip tank tops, sportswear, flip-flops, sandals and elephant pants.',
} as const

// What's Included — founder-confirmed items, plus existing inclusions that
// the live product configuration (product_content.whats_included for
// bangkok-club-crawl: VIP entry at all stops, transport between venues,
// drink deals) already supports. "All cover charges" was removed: the same
// configuration lists a cover charge on DJ nights as NOT included.
export const BCC_INCLUDED = [
  'Four curated nightlife venues',
  'Local hosts who run the night for your group',
  '3–4 complimentary shots during the night',
  'Priority entry at every venue',
  'Private Party Van between venues (if needed)',
  'Special drink deals',
  'International group',
] as const

export const BCC_NOT_INCLUDED = [
  'At least one drink purchased at every venue (required)',
  'Any other drinks beyond the complimentary shots',
  'Transport to or from the meeting point',
  'Food and personal spending',
] as const
