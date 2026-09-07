import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday, addDaysISO } from '@/lib/dates'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Read-only, event-level attendance rollup for events in a -7/+14 day
// window, aggregated from bookings + ota_bookings' existing
// attendance_status column. Attendance is booking-level, not per-guest, per
// the audit — this view doesn't change that, just displays it.
export default async function OperatorRecordsAttendancePage() {
  const supabase = getServiceSupabase()
  const start = addDaysISO(bangkokToday(), -7)
  const end = addDaysISO(bangkokToday(), 14)

  const { data: events, error: eErr } = await supabase
    .from('event_dates')
    .select('id, event_date, night_name, night_slug')
    .gte('event_date', start)
    .lte('event_date', end)
    .order('event_date', { ascending: true })

  const eventList = eErr ? [] : events ?? []
  const nightSlugs = Array.from(new Set(eventList.map((e: any) => e.night_slug)))

  const [{ data: bookings, error: bErr }, { data: ota, error: oErr }] = await Promise.all([
    nightSlugs.length
      ? supabase.from('bookings').select('event_date, night_slug, quantity, attendance_status').eq('status', 'confirmed').gte('event_date', start).lte('event_date', end)
      : Promise.resolve({ data: [], error: null }),
    nightSlugs.length
      ? supabase.from('ota_bookings').select('event_date, night_slug, quantity, attendance_status').gte('event_date', start).lte('event_date', end)
      : Promise.resolve({ data: [], error: null }),
  ])

  const error = eErr || bErr || oErr
  const allGuests = [...(bookings ?? []), ...(ota ?? [])]

  const rollup = eventList.map((e: any) => {
    const guests = allGuests.filter((g: any) => g.event_date === e.event_date && g.night_slug === e.night_slug)
    const sum = (status: string) => guests.filter((g: any) => g.attendance_status === status).reduce((s: number, g: any) => s + (g.quantity ?? 0), 0)
    return {
      ...e,
      expected: sum('expected'),
      checkedIn: sum('checked_in'),
      noShow: sum('no_show'),
    }
  })

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/more/records" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Records
      </Link>
      <p style={eyebrow(T.statusPurple)}>Attendance</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Check-In Status</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>{start} to {end} · booking-level, read-only</p>

      {error && <p style={{ fontSize: '13px', color: T.statusRed }}>Failed to load attendance.</p>}
      {!error && rollup.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>No events in this window.</p>}

      {rollup.map((e: any) => (
        <div key={e.id} style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px 14px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: 0 }}>{e.night_name}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{e.event_date}</p>
          </div>
          <div style={{ display: 'flex', gap: '14px' }}>
            <div>
              <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: T.statusGreen }}>{e.checkedIn}</p>
              <p style={{ fontSize: '10.5px', color: T.textMuted, margin: 0 }}>checked in</p>
            </div>
            <div>
              <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: T.statusBlue }}>{e.expected}</p>
              <p style={{ fontSize: '10.5px', color: T.textMuted, margin: 0 }}>expected</p>
            </div>
            <div>
              <p style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: T.statusRed }}>{e.noShow}</p>
              <p style={{ fontSize: '10.5px', color: T.textMuted, margin: 0 }}>no-show</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
