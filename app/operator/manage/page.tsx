import Link from 'next/link'
import { CalendarDays, Package, ClipboardCheck, QrCode, Ticket, ChevronRight, ArrowUpRight } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Phase 1A (SNX_PHASE1_ALIGNMENT_AUDIT.md §7a): every one of these is a
// TEMPORARY LINK-OUT to a proven, production BCC engine that already has a
// working (if desktop-biased) UI at /dashboard. This is explicitly not
// final architecture — each row is a named candidate for an in-shell
// mobile ADAPT pass later (see the audit's §4 engine-vs-UI table). Do not
// treat these hrefs as settled; they're what lets Manage exist in Phase 1A
// without rebuilding a proven engine's UI from scratch.
const TEMPORARY_LINK_OUTS = [
  { href: '/dashboard/products', label: 'Products / Experiences', detail: 'Product admin — content, media, schedules', Icon: Package },
  { href: '/dashboard/checkin', label: 'Check-in', detail: 'QR scanner — already mobile-ready', Icon: QrCode },
]

// Phase 2A/2B: Event Operations and Calendar/Instances graduated from
// /dashboard link-outs to real in-shell surfaces (SNX_PHASE2A_EVENT_OPS_PLAN.md,
// SNX_PHASE2B_CALENDAR_INSTANCES_PLAN.md). Same tables/routes the dashboard
// already uses — no second event engine, no second scheduling system.
const IN_SHELL_OPERATIONS = [
  { href: '/operator/manage/calendar', label: 'Calendar / Instances', detail: 'Month view, scheduling, capacity, pricing', Icon: CalendarDays },
  { href: '/operator/manage/events', label: 'Event Operations', detail: 'Overview, guests, expenses, brief, closeout', Icon: ClipboardCheck },
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
      {TEMPORARY_LINK_OUTS.map(({ href, label, detail, Icon }, i) => (
        <Link
          key={`${href}-${i}`}
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
          <ArrowUpRight size={15} color={T.textFaint} style={{ flexShrink: 0 }} />
        </Link>
      ))}

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
