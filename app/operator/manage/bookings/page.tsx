import { getAdminUser } from '@/lib/admin-auth'
import { loadBookingsPage, parseFilters } from '@/lib/operator/bookings'
import { BOOKING_ACTION_ROLES } from '@/lib/bookingActions'
import BookingsClient from './BookingsClient'

export const dynamic = 'force-dynamic'

// Bookings (Manage): website + OTA bookings for a period, grouped by event,
// filterable by event / product / source / status / search. Tapping a
// booking opens its details; the owner can reschedule, cancel and refund
// website bookings from there (lib/bookingActions.ts via the API routes).
export default async function OperatorBookingsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filters = parseFilters(searchParams)
  const [admin, data] = await Promise.all([getAdminUser(), loadBookingsPage(filters)])
  const isOwner = !!admin && BOOKING_ACTION_ROLES.includes(admin.role)
  return <BookingsClient data={data} filters={filters} isOwner={isOwner} />
}
