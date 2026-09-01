import Link from 'next/link'
import { CalendarDays, Ticket, Receipt, CheckCircle2, ChevronRight, Users2, FileText } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

const RECORD_TYPES = [
  { href: '/operator/records/events', label: 'Events', detail: 'event_dates', Icon: CalendarDays, color: T.statusAmber },
  { href: '/operator/records/bookings', label: 'Bookings', detail: 'website + OTA', Icon: Ticket, color: T.statusGreen },
  { href: '/operator/records/expenses', label: 'Expenses', detail: 'per-event costs', Icon: Receipt, color: T.statusBlue },
  { href: '/operator/records/attendance', label: 'Attendance', detail: 'check-in status', Icon: CheckCircle2, color: T.statusPurple },
]

// Partners/Proposals don't exist yet (Phase 3/4) — shown as disabled rows
// for layout parity, not fabricated as working links.
const PLACEHOLDER_TYPES = [
  { label: 'Partners', Icon: Users2 },
  { label: 'Proposals', Icon: FileText },
]

export default function OperatorRecordsPage() {
  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>Records</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Canonical Records</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>
        Read-only views over existing BCC operational data.
      </p>

      {RECORD_TYPES.map(({ href, label, detail, Icon, color }) => (
        <Link
          key={href}
          href={href}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '10px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={17} color={color} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{detail}</p>
          </div>
          <ChevronRight size={16} color={T.textFaint} />
        </Link>
      ))}

      <p style={{ ...eyebrow(T.textFaint), margin: '18px 0 10px' }}>Coming later</p>
      {PLACEHOLDER_TYPES.map(({ label, Icon }) => (
        <div
          key={label}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '10px',
            background: T.dashedBg, border: `1px dashed ${T.border}`, borderRadius: T.radiusSm, opacity: 0.45,
          }}
        >
          <Icon size={17} color={T.textFaint} />
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: T.textFaint }}>{label} · not built yet</p>
        </div>
      ))}
    </div>
  )
}
