import { notFound } from 'next/navigation'
import { getEventInstance } from '@/lib/operator/eventOps'
import { loadDoorGuests } from '@/lib/doorList'
import { getServiceSupabase } from '@/lib/supabase'
import { operatorTheme as T } from '@/lib/operator/theme'
import DoorList, { type DoorListTheme } from '@/components/doorlist/DoorList'

export const dynamic = 'force-dynamic'

const theme: DoorListTheme = {
  elevated: T.bgElevated, border: T.border, text: T.text, muted: T.textMuted, faint: T.textFaint,
  accent: T.accent, accentText: T.accentText,
  green: T.statusGreen, greenSoft: T.statusGreenSoft, blue: T.statusBlue, blueSoft: T.statusBlueSoft,
  red: T.statusRed, redSoft: T.statusRedSoft, chipBg: T.chipBg, radius: T.radiusSm,
}

// Door list for one night: direct (QR) bookings and OTA bookings together, one
// row per booking. Check in with one tap, or scan a QR. Attendance is
// booking-level (a group of 4 checks in as one unit) and reuses
// POST /api/update-attendance, the same route the QR check-in flow uses.
export default async function EventGuestsPage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()
  const { guests, error } = await loadDoorGuests(getServiceSupabase(), instance.eventDate, instance.nightSlug)

  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <h1 style={{ fontSize: '17px', fontWeight: 700, margin: '4px 0 14px' }}>Door List</h1>
      {error ? (
        <p style={{ fontSize: '13px', color: T.statusRed }}>Failed to load guests.</p>
      ) : (
        <DoorList guests={guests} theme={theme} scanHref="/operator/manage/checkin" />
      )}
    </div>
  )
}
