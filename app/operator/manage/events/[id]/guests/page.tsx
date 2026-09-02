import { notFound } from 'next/navigation'
import { QrCode } from 'lucide-react'
import { getEventInstance, getEventOpsData } from '@/lib/operator/eventOps'
import { operatorTheme as T } from '@/lib/operator/theme'
import AttendanceControl from './AttendanceControl'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website', klook: 'Klook', airbnb: 'Airbnb', gyg: 'GetYourGuide', viator: 'Viator',
  eventbrite: 'Eventbrite', manual: 'Manual',
}

// Reuses bookings/ota_bookings guest data exactly as-is — no VIP flag, no
// table number, no checked-in timestamp (none of those exist, see
// SNX_PHASE2A_EVENT_OPS_PLAN.md §4). QR scanning stays a link-out to the
// existing, already mobile-ready /dashboard/checkin flow rather than
// rebuilding the camera integration.
export default async function EventGuestsPage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()
  const ops = await getEventOpsData(instance.eventDate, instance.nightSlug)

  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '4px 0 4px' }}>Guest List</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 16px' }}>
        {ops.totalGuests} guests · {ops.checkedInGuests} checked in
      </p>

      <a
        href="/dashboard/checkin"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px',
          borderRadius: T.radiusSm, marginBottom: '18px', background: T.accent, color: '#fff',
          fontWeight: 600, fontSize: '14px', textDecoration: 'none',
        }}
      >
        <QrCode size={17} /> Scan QR Code
      </a>

      {ops.guests.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>No bookings for this instance yet.</p>}

      {ops.guests.map((g) => (
        <div key={`${g.kind}-${g.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', marginBottom: '8px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px' }}>{g.guestName || 'Guest'}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>
              {g.quantity} guest{g.quantity === 1 ? '' : 's'} · {SOURCE_LABEL[g.source] ?? g.source}
              {g.totalPaid ? ` · ฿${g.totalPaid.toLocaleString()}` : ''}
            </p>
          </div>
          <AttendanceControl table={g.kind} id={g.id} status={g.attendanceStatus} />
        </div>
      ))}
    </div>
  )
}
