import { redirect } from 'next/navigation'

// The calendar now opens the one event page (Overview · Guests · Settings ·
// Expenses · Brief · Closeout). Kept as a redirect for old links.
export default function CalendarInstanceRedirect({ params }: { params: { id: string } }) {
  redirect(`/operator/manage/events/${params.id}`)
}
