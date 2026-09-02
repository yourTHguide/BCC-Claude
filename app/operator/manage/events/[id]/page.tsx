import { notFound } from 'next/navigation'
import { CalendarDays, Users, CheckCircle2, MapPin, Wallet } from 'lucide-react'
import { getEventInstance, getEventOpsData } from '@/lib/operator/eventOps'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import OverviewControls from './OverviewControls'

export const dynamic = 'force-dynamic'

// Overview: the "important instance truth" per the approved plan — real
// numbers only (guests/checked-in/revenue/profit), no invented metrics
// (no WhatsApp member count, no live map, no Hermes insight — none of
// those exist). Quick operational controls (status/host/open) live in
// OverviewControls; logistics editing (meeting point, WhatsApp link,
// venue route, van/taxi, notes) lives on the Brief tab.
export default async function EventOverviewPage({ params }: { params: { id: string } }) {
  const instance = await getEventInstance(params.id)
  if (!instance) notFound()

  const ops = await getEventOpsData(instance.eventDate, instance.nightSlug)
  const checkedInPct = ops.totalGuests > 0 ? Math.round((ops.checkedInGuests / ops.totalGuests) * 100) : 0

  return (
    <div style={{ padding: '10px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>{instance.eventDate}</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 2px' }}>{instance.nightName}</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 16px' }}>
        {[instance.startTime, instance.meetUpLocation].filter(Boolean).join(' · ') || 'No meeting point set yet'}
      </p>

      <OverviewControls id={instance.id} isOpen={instance.isOpen} hostAssigned={instance.hostAssigned} operationVerdict={instance.operationVerdict} />

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>At a Glance</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px', marginBottom: '18px' }}>
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px' }}>
          <Users size={16} color={T.statusBlue} style={{ marginBottom: '7px' }} />
          <p style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px' }}>{ops.totalGuests}</p>
          <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>Guests booked</p>
        </div>
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px' }}>
          <CheckCircle2 size={16} color={T.statusGreen} style={{ marginBottom: '7px' }} />
          <p style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px' }}>{ops.checkedInGuests}</p>
          <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>Checked in · {checkedInPct}%</p>
        </div>
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px' }}>
          <Wallet size={16} color={T.statusAmber} style={{ marginBottom: '7px' }} />
          <p style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px' }}>฿{ops.totalRevenue.toLocaleString()}</p>
          <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>Revenue</p>
        </div>
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px' }}>
          <CalendarDays size={16} color={ops.profit >= 0 ? T.statusGreen : T.statusRed} style={{ marginBottom: '7px' }} />
          <p style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px', color: ops.profit >= 0 ? T.statusGreen : T.statusRed }}>฿{ops.profit.toLocaleString()}</p>
          <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>Profit (rev − expenses)</p>
        </div>
      </div>

      {instance.meetUpLocation && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '13px 14px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
          <MapPin size={16} color={T.textMuted} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{instance.meetUpLocation}</p>
            {instance.specialNotes && <p style={{ fontSize: '12px', color: T.textMuted, margin: 0 }}>{instance.specialNotes}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
