// SMC booking terms shown before payment. The version string is stored on
// every registration with the time it was accepted; change it whenever the
// wording below changes.
export const SMC_TERMS_VERSION = 'smc-terms-2026-10-v1'

export const SMC_MIN_AGE = 20
export const SMC_MAX_TICKETS_PER_BOOKING = 4

export const SMC_TERMS: string[] = [
  'All ticket purchases are final and non-refundable.',
  'No refunds for guest-initiated cancellations, no-shows, late arrivals or changes of personal plans.',
  'You may ask to transfer a ticket to another eligible guest up to 24 hours before the event. Transfers are subject to organiser approval.',
  'If Single Meet Club cancels the event, you will be offered a full refund or a transfer to another edition.',
  `Every guest must be ${SMC_MIN_AGE} or older. ID may be requested at the door.`,
  'Nothing in these terms limits any refund you are entitled to by law, or a refund for a payment error.',
]
