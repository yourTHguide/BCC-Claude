import Link from 'next/link'
import { CalendarDays, Package, QrCode, Ticket, Handshake, ChevronRight, BarChart3 } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// One job per item (Nov 2026 menu cleanup): Calendar is the hub — every
// date opens the single event page (Overview · Guests · Settings · Expenses
// · Brief · Closeout). "Calendar / Instances", "Event Operations" and the
// read-only Records pages were merged into it; their old URLs redirect.
const IN_SHELL_OPERATIONS = [
  { href: '/operator/manage/calendar', label: 'Calendar', detail: 'Pick a date → open the event: guests, settings, expenses, brief, closeout', Icon: CalendarDays },
  { href: '/operator/manage/bookings', label: 'Bookings', detail: 'All bookings by event — reschedule, cancel, refund', Icon: Ticket },
  { href: '/operator/manage/checkin', label: 'Check-in', detail: 'QR scanner for the door', Icon: QrCode },
  { href: '/operator/manage/operations', label: 'Reports', detail: 'Many nights at once — money, routes, host earnings, export', Icon: BarChart3 },
  { href: '/operator/manage/products', label: 'Products', detail: 'Experiences — content, media, pricing', Icon: Package },
  { href: '/operator/manage/partners', label: 'Partners', detail: 'Directory, deals, proposal history', Icon: Handshake },
]

export default function OperatorManagePage() {
  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>Manage</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Control What Exists</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>
        Everything you're already running, in one place.
      </p>

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
    </div>
  )
}
