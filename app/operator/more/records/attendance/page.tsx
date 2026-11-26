import { redirect } from 'next/navigation'

// Attendance shows on each booking and on the event door list. Kept as a redirect for old links.
export default function Page() {
  redirect('/operator/manage/bookings')
}
