import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getUpcomingInstances } from '@/lib/operator/eventOps'
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

// Today + next 30 days, same window convention as lib/operator/queue.ts.
// Full calendar browsing stays a link-out to /dashboard per the approved
// Phase 2A plan — this list is deliberately near-term only.
export default async function OperatorEventsListPage() {
  const instances = await getUpcomingInstances()

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/manage" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Manage
      </Link>
      <p style={eyebrow(T.textFaint)}>Event Operations</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Upcoming Instances</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>Next 30 days. Full calendar stays on the BCC Dashboard.</p>

      {instances.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>Nothing scheduled in this window.</p>}

      {instances.map((e) => (
        <Link
          key={e.id}
          href={`/operator/manage/events/${e.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '8px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{e.nightName}</p>
              <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{e.eventDate}</p>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: e.isOpen ? T.statusGreen : T.textMuted, background: e.isOpen ? T.statusGreenSoft : T.chipBg }}>
                {e.isOpen ? 'Open' : 'Closed'}
              </span>
              <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: VERDICT_COLOR[e.operationVerdict] ?? T.textMuted, background: T.chipBg }}>
                {e.operationVerdict}
              </span>
              {e.hostAssigned && (
                <span style={{ fontSize: '10.5px', color: T.textMuted, padding: '3px 2px' }}>Host: {e.hostAssigned}</span>
              )}
            </div>
          </div>
          <ChevronRight size={16} color={T.textFaint} style={{ flexShrink: 0 }} />
        </Link>
      ))}
    </div>
  )
}
