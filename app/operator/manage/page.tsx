import Link from 'next/link'
import { CalendarDays, Package, ClipboardCheck, QrCode, Ticket, Handshake, ChevronRight } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Phase 2A/2B/2C/2D: Event Operations, Calendar/Instances, Products /
// Experiences, and Check-in all graduated from /dashboard link-outs to real
// in-shell surfaces (SNX_PHASE2A_EVENT_OPS_PLAN.md,
// SNX_PHASE2B_CALENDAR_INSTANCES_PLAN.md, SNX_PHASE2C plan, SNX_PHASE2D
// plan). Same tables/routes the dashboard already uses — no second
// product/event engine, no second scheduling system, no new attendance
// mutation path. Phase 3D adds Partners — a genuinely new, SNX-level
// surface (no /dashboard precedent to reuse) backed by the Phase 3C-1
// production tables. Read-only in this phase; write actions are 3E+.
const IN_SHELL_OPERATIONS = [
  { href: '/operator/manage/products', label: 'Products / Experiences', detail: 'Catalog — content, media, pricing context', Icon: Package },
  { href: '/operator/manage/calendar', label: 'Calendar / Instances', detail: 'Month view, scheduling, capacity, pricing', Icon: CalendarDays },
  { href: '/operator/manage/events', label: 'Event Operations', detail: 'Overview, guests, expenses, brief, closeout', Icon: ClipboardCheck },
  { href: '/operator/manage/checkin', label: 'Check-in', detail: 'QR scanner + confirmation', Icon: QrCode },
  { href: '/operator/manage/partners', label: 'Partners', detail: 'Directory, deals, proposal history', Icon: Handshake },
]

// Already built and in-shell — no link-out needed, these stay on /operator.
const IN_SHELL_RECORDS = [
  { href: '/operator/more/records/bookings', label: 'Bookings', detail: 'Website + OTA, read-only', Icon: Ticket },
  { href: '/operator/more/records/events', label: 'Events', detail: 'event_dates, read-only', Icon: CalendarDays },
]

export default function OperatorManagePage() {
  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>Manage</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Control What Exists</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>
        Everything you're already running, in one place.
      </p>

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '10px' }}>Operations</p>
      {IN_SHELL_OPERATIONS.map(({ href, label, detail, Icon }) => (
        <Link
          key={href}
          href={href}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '10px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          <Icon size={17} color={T.textMuted} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{detail}</p>
          </div>
          <ChevronRight size={16} color={T.textFaint} />
        </Link>
      ))}

      <p style={{ ...eyebrow(T.textFaint), margin: '18px 0 10px' }}>Records</p>
      {IN_SHELL_RECORDS.map(({ href, label, detail, Icon }) => (
        <Link
          key={href}
          href={href}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '10px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          <Icon size={17} color={T.textMuted} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{detail}</p>
          </div>
          <ChevronRight size={16} color={T.textFaint} />
        </Link>
      ))}
    </div>
  )
}
