import { redirect } from 'next/navigation'

// Bookings moved to Manage → Bookings (filters + actions). Kept as a
// redirect so old links and bookmarks still land in the right place.
export default function OperatorRecordsBookingsPage() {
  redirect('/operator/manage/bookings')
}
