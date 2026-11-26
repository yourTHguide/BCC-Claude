import { redirect } from 'next/navigation'

// Event Operations merged into Calendar: pick a date, open the event.
export default function OperatorEventsListPage() {
  redirect('/operator/manage/calendar')
}
