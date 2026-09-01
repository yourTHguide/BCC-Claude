import { ListChecks } from 'lucide-react'
import { getOpenOperationalItems } from '@/lib/operator/queue'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

const REASON_COLOR: Record<string, string> = {
  'Missing host assignment': T.statusAmber,
  'Past event still open': T.statusRed,
  'Host fee not finalized': T.statusBlue,
}

// Read-only operational queue — the same data lib/operator/queue.ts feeds
// into Home's "Work In Progress" preview, shown here in full. No proposal/
// approval/partner workflow exists yet (Phase 3/4); this is purely a
// filtered view over event_dates' existing operational fields.
export default async function OperatorWorkPage() {
  const items = await getOpenOperationalItems()

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>Work</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Operational Queue</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>
        Events in the next/last 30 days that need attention — read-only.
      </p>

      {items.length === 0 && (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <ListChecks size={28} color={T.textFaint} style={{ marginBottom: '10px' }} />
          <p style={{ fontSize: '13px', color: T.textFaint, margin: 0 }}>Nothing open right now.</p>
        </div>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          style={{
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            padding: '13px 14px', marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{item.nightName}</p>
            <p style={{ fontSize: '12px', color: T.textMuted, margin: 0 }}>{item.eventDate}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {item.reasons.map((reason) => (
              <span
                key={reason}
                style={{
                  fontSize: '10.5px', fontWeight: 600, padding: '4px 9px', borderRadius: '999px',
                  color: REASON_COLOR[reason] ?? T.textMuted,
                  background: T.chipBg,
                }}
              >
                {reason}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
