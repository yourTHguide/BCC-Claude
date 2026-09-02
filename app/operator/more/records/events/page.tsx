import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday, addDaysISO } from '@/lib/dates'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

const VERDICT_COLOR: Record<string, string> = {
  Pending: T.textMuted,
  'Pre-confirmation': T.statusAmber,
  'Operation Confirmed': T.statusGreen,
  'Cancelled / Rescheduled': T.statusRed,
  Completed: T.statusBlue,
  Reviewed: T.statusPurple,
}

// Read-only. Same service-role query pattern as
// app/api/admin/dashboard/events/route.ts, run server-side directly rather
// than over a fetch() round trip (see Phase 1 plan note). No direct client
// Supabase reads — this is a Server Component, never shipped to the browser.
export default async function OperatorRecordsEventsPage() {
  const supabase = getServiceSupabase()
  const start = addDaysISO(bangkokToday(), -14)
  const end = addDaysISO(bangkokToday(), 45)

  const { data, error } = await supabase
    .from('event_dates')
    .select('id, event_date, night_name, night_slug, is_open, host_assigned, operation_verdict')
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date', { ascending: true })
    .limit(60)

  const events = error ? [] : data ?? []

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/more/records" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Records
      </Link>
      <p style={eyebrow(T.statusAmber)}>Events</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>event_dates</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>{start} to {end} · read-only</p>

      {error && <p style={{ fontSize: '13px', color: T.statusRed }}>Failed to load events.</p>}
      {!error && events.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>No events in this window.</p>}

      {events.map((e: any) => (
        <div key={e.id} style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px 14px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: 0 }}>{e.night_name}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{e.event_date}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: e.is_open ? T.statusGreen : T.textMuted, background: e.is_open ? T.statusGreenSoft : T.chipBg }}>
              {e.is_open ? 'Open' : 'Closed'}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: VERDICT_COLOR[e.operation_verdict] ?? T.textMuted, background: T.chipBg }}>
              {e.operation_verdict}
            </span>
            {e.host_assigned ? (
              <span style={{ fontSize: '10.5px', color: T.textMuted, padding: '3px 8px' }}>Host: {e.host_assigned}</span>
            ) : (
              <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.statusAmber, background: T.statusAmberSoft }}>No host</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
