// Booking status (finance reconciliation, Nov 2026). Stored in
// booking_status; when empty it's worked out from check-in, and a past
// booking nobody marked is taken as attended.
export type BookingStatus = 'attended' | 'no_show' | 'late_cancel_paid' | 'rescheduled' | 'didnt_happen_refund_owed' | 'refunded' | 'booked'
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  attended: 'Attended', no_show: 'No-show', late_cancel_paid: 'Late cancel – paid', rescheduled: 'Rescheduled',
  didnt_happen_refund_owed: "Didn't happen – refund owed", refunded: 'Refunded', booked: 'Booked',
}
/** Revenue counts for every status except a night that didn't happen or a refund. */
export const countsRevenue = (s: BookingStatus) => s !== 'didnt_happen_refund_owed' && s !== 'refunded'
/** Counts as a guest who came. */
export const countsAttended = (s: BookingStatus) => s === 'attended' || s === 'rescheduled'

export function bookingStatus(stored: string | null | undefined, attendance: string | null | undefined, eventDate: string, today: string): BookingStatus {
  if (stored) return stored as BookingStatus
  if (attendance === 'checked_in') return 'attended'
  if (attendance === 'no_show') return 'no_show'
  return eventDate < today ? 'attended' : 'booked'
}
