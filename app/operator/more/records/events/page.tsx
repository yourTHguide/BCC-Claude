import { redirect } from 'next/navigation'

// Events live in Calendar now. Kept as a redirect for old links.
export default function Page() {
  redirect('/operator/manage/calendar')
}
