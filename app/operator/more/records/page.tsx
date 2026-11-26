import { redirect } from 'next/navigation'

// Records merged into Manage (Calendar, Bookings, Reports). Kept as a redirect for old links.
export default function Page() {
  redirect('/operator/manage')
}
