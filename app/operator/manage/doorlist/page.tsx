import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getUpcomingInstances } from '@/lib/operator/eventOps'
import { loadDoorGuests } from '@/lib/doorList'
import { getServiceSupabase } from '@/lib/supabase'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Entry point from the scanner: the next night with events (with check-in
// counts; several events can share a date, e.g. Signature Night and the
// Halloween Crawl on Oct 31), then the following nights, so a later night's
// list can be opened early.
export default async function DoorListEntryPage() {
  const instances = await getUpcomingInstances()
  const nextDate = instances[0]?.eventDate
  const tonight = instances.filter((i) => i.eventDate === nextDate)
  const later = instances.filter((i) => i.eventDate !== nextDate).slice(0, 10)

  const supabase = getServiceSupabase()
  const counts = await Promise.all(
    tonight.map(async (i) => {
      const { data: ev } = await supabase.from('event_dates').select('night_slug').eq('id', i.id).maybeSingle()
      const { guests } = await loadDoorGuests(supabase, i.eventDate, ev?.night_slug)
      const total = guests.reduce((s, g) => s + g.quantity, 0)
      const checkedIn = guests.filter((g) => g.status === 'checked_in').reduce((s, g) => s + g.quantity, 0)
      return { id: i.id, name: i.nightName, total, checkedIn }
    })
  )

  return (
    <div style={{ padding: '20px 18px 32px' }}>
      <Link href="/operator/manage/checkin" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Scanner
      </Link>
      <p style={eyebrow(T.textFaint)}>Check-in</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Guest list</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 16px' }}>
        {nextDate ? `${nextDate} · pick the event` : 'No upcoming events.'}
      </p>
      {counts.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint }}>Nothing scheduled.</p>}
      {counts.map((c) => (
        <Link
          key={c.id}
          href={`/operator/manage/events/${c.id}/guests`}
          style={{ display: 'block', padding: '14px 16px', marginBottom: '8px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text }}
        >
          <span style={{ display: 'block', fontSize: '15px', fontWeight: 600 }}>{c.name}</span>
          <span style={{ display: 'block', fontSize: '12.5px', color: T.textMuted, marginTop: '2px' }}>
            {c.checkedIn} / {c.total} checked in
          </span>
        </Link>
      ))}
      {later.length > 0 && (
        <>
          <p style={{ ...eyebrow(T.textFaint), margin: '22px 0 10px' }}>Later nights</p>
          {later.map((i) => (
            <Link
              key={i.id}
              href={`/operator/manage/events/${i.id}/guests`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '12px 16px', marginBottom: '6px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text, fontSize: '14px' }}
            >
              <span style={{ fontWeight: 600 }}>{i.nightName}</span>
              <span style={{ color: T.textMuted }}>{i.eventDate}</span>
            </Link>
          ))}
        </>
      )}
    </div>
  )
}
