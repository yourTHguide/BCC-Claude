import { redirect } from 'next/navigation'

// Expenses: per event on the event page, across nights in Reports. Kept as a redirect for old links.
export default function Page() {
  redirect('/operator/manage/operations')
}
