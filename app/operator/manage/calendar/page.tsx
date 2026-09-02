import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getMonthInstances, bangkokTodayYearMonth } from '@/lib/operator/calendar'
import { getOpenOperationalItems } from '@/lib/operator/queue'
import { bangkokToday } from '@/lib/dates'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import CalendarClient from './CalendarClient'

export const dynamic = 'force-dynamic'

// Single page, client-side date selection over the already-fetched month —
// same pattern the desktop /dashboard calendar uses (one screen, no extra
// route/fetch per day tap). Month navigation is a real Link with updated
// query params, triggering a fresh server render — same convention every
// other /operator list page already uses.
export default async function OperatorCalendarPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string }
}) {
  const def = bangkokTodayYearMonth()
  const year = Number(searchParams.year) || def.year
  const month = Number(searchParams.month) || def.month

  const [instances, queueItems] = await Promise.all([getMonthInstances(year, month), getOpenOperationalItems()])
  const missingHostIds = new Set(queueItems.filter((q) => q.reasons.includes('Missing host assignment')).map((q) => q.id))

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/manage" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Manage
      </Link>
      <p style={eyebrow(T.textFaint)}>Calendar / Instances</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 16px' }}>Schedule</h1>

      <CalendarClient year={year} month={month} today={bangkokToday()} instances={instances} missingHostIds={missingHostIds} />
    </div>
  )
}
