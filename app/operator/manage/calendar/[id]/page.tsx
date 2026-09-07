import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Users, ClipboardList, ArrowUpRight } from 'lucide-react'
import { getEventInstance } from '@/lib/operator/eventOps'
import { isAtCapacity } from '@/lib/operator/calendar'
import { getServiceSupabase } from '@/lib/supabase'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import InstanceEditForm from './InstanceEditForm'

export const dynamic = 'force-dynamic'

const VERDICT_COLOR: Record<string, string> = {
  Pending: T.textMuted,
  'Pre-confirmation': T.statusAmber,
  'Operation Confirmed': T.statusGreen,
  'Cancelled / Rescheduled': T.statusRed,
  Completed: T.statusBlue,
  Reviewed: T.statusPurple,
}

// Calendar owns scheduling fields only (capacity, price override, start
// time, sales open/closed, host assignment) — Guests and Operations are
// explicit link-outs to the existing Phase 2A module, never duplicated
// here (SNX_PHASE2B_CALENDAR_INSTANCES_PLAN.md §2/§6). No hero image/
// tagline — kept text-only to match Phase 2A's Overview style and match
// this pass's "smallest safe" scope.
export default async function CalendarInstancePage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()

  const supabase = getServiceSupabase()
  const [{ data: bookings }, { data: otaBookings }] = await Promise.all([
    supabase.from('bookings').select('quantity').eq('event_date', instance.eventDate).eq('night_slug', instance.nightSlug).eq('status', 'confirmed'),
    supabase.from('ota_bookings').select('quantity').eq('event_date', instance.eventDate).eq('night_slug', instance.nightSlug),
  ])
  const bookingCount = [...(bookings ?? []), ...(otaBookings ?? [])].reduce((s, b: any) => s + (b.quantity ?? 0), 0)
  const atCapacity = isAtCapacity(instance.capacity, bookingCount)

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/manage/calendar" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Calendar
      </Link>
      <p style={eyebrow(T.textFaint)}>{instance.eventDate}</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 10px' }}>{instance.nightName}</h1>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: instance.isOpen ? T.statusGreen : T.textMuted, background: instance.isOpen ? T.statusGreenSoft : T.chipBg }}>
          {instance.isOpen ? 'Sales Open' : 'Sales Closed'}
        </span>
        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: VERDICT_COLOR[instance.operationVerdict] ?? T.textMuted, background: T.chipBg }}>
          {instance.operationVerdict}
        </span>
        {atCapacity && (
          <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.statusAmber, background: T.statusAmberSoft }}>
            At capacity
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '18px' }}>
        <Users size={14} color={T.textMuted} />
        <span style={{ fontSize: '12.5px', color: T.textMuted }}>
          {bookingCount}{instance.capacity != null ? ` / ${instance.capacity}` : ''} booked
          {instance.startTime ? ` · ${instance.startTime}` : ''}
        </span>
      </div>

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>Scheduling</p>
      <InstanceEditForm
        id={instance.id}
        isOpen={instance.isOpen}
        capacity={instance.capacity}
        priceOverride={instance.priceOverride}
        defaultPrice={instance.defaultPrice}
        startTime24={instance.startTime24}
        hostAssigned={instance.hostAssigned}
      />

      <div style={{ display: 'grid', gap: '8px' }}>
        <Link
          href={`/operator/manage/events/${instance.id}/guests`}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text }}
        >
          <Users size={17} color={T.textMuted} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px' }}>Bookings</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>Guest list &amp; check-in</p>
          </div>
          <ArrowUpRight size={15} color={T.textFaint} />
        </Link>
        <Link
          href={`/operator/manage/events/${instance.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text }}
        >
          <ClipboardList size={17} color={T.textMuted} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px' }}>Open Operations</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>Host brief, expenses, closeout</p>
          </div>
          <ArrowUpRight size={15} color={T.textFaint} />
        </Link>
      </div>
    </div>
  )
}
