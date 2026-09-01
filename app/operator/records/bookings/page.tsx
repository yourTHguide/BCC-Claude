import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getServiceSupabase } from '@/lib/supabase'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website',
  klook: 'Klook',
  airbnb: 'Airbnb',
  gyg: 'GetYourGuide',
  viator: 'Viator',
  manual: 'Manual',
}

// Read-only, most-recent-first. Same tables/filters as
// app/api/admin/dashboard/bookings/route.ts (website) and the OTA equivalent,
// merged into one list here. Server Component — service role never leaves
// the server.
export default async function OperatorRecordsBookingsPage() {
  const supabase = getServiceSupabase()

  const [{ data: bookings, error: bErr }, { data: ota, error: oErr }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, event_date, night_name, guest_name, quantity, total_paid, status, attendance_status, created_at')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('ota_bookings')
      .select('id, event_date, night_slug, source, guest_name, quantity, total_paid, attendance_status, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const merged = [
    ...((bookings ?? []).map((b: any) => ({ ...b, kind: 'website' as const, sourceLabel: 'Website' }))),
    ...((ota ?? []).map((o: any) => ({ ...o, night_name: o.night_slug, kind: 'ota' as const, sourceLabel: SOURCE_LABEL[o.source] ?? o.source }))),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 40)

  const error = bErr || oErr

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/records" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Records
      </Link>
      <p style={eyebrow(T.statusGreen)}>Bookings</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Website + OTA</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>Most recent 40 · read-only</p>

      {error && <p style={{ fontSize: '13px', color: T.statusRed }}>Failed to load bookings.</p>}
      {!error && merged.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>No bookings yet.</p>}

      {merged.map((b: any) => (
        <div key={`${b.kind}-${b.id}`} style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px 14px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: 0 }}>{b.guest_name || 'Guest'}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{b.event_date}</p>
          </div>
          <p style={{ fontSize: '12px', color: T.textMuted, margin: '2px 0 8px' }}>
            {b.night_name} · {b.quantity} guest{b.quantity === 1 ? '' : 's'}{b.total_paid ? ` · ฿${Number(b.total_paid).toLocaleString()}` : ''}
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>
              {b.sourceLabel}
            </span>
            <span
              style={{
                fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px',
                color: b.attendance_status === 'checked_in' ? T.statusGreen : b.attendance_status === 'no_show' ? T.statusRed : T.statusBlue,
                background: b.attendance_status === 'checked_in' ? T.statusGreenSoft : b.attendance_status === 'no_show' ? T.statusRedSoft : T.statusBlueSoft,
              }}
            >
              {b.attendance_status.replace('_', ' ')}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
