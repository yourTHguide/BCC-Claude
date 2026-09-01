import Link from 'next/link'
import { Bell, ChevronRight, CalendarDays, ListChecks, Users, CheckCircle2, CalendarPlus, Receipt, UserPlus, StickyNote } from 'lucide-react'
import { getAdminUser } from '@/lib/admin-auth'
import { getTodaysEvents, getOpenOperationalItems } from '@/lib/operator/queue'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Home content density is deliberately capped (2 agenda rows, 2 WIP cards)
// so the lower sections don't feel squeezed on a real phone viewport — see
// SNX_PHASE0_ROUTE_MAP.md's Phase 1 scope and Guide's 2026-09-01 polish
// request. "View all" links to the full, uncapped lists on /operator/work.
const AGENDA_CAP = 2
const WIP_PREVIEW_CAP = 2

function greeting(): string {
  // Bangkok local hour, so the greeting matches the operator's actual day.
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false }).format(new Date())
  )
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function OperatorHomePage() {
  const admin = await getAdminUser()
  const [todaysEvents, queueItems] = await Promise.all([getTodaysEvents(), getOpenOperationalItems()])

  const liveCount = todaysEvents.filter((e) => e.isOpen).length
  const todaysGuests = todaysEvents.reduce((sum, e) => sum + e.confirmedGuests + e.otaGuests, 0)
  const name = admin?.displayName || admin?.email?.split('@')[0] || 'there'

  // Plain-language "what needs attention first" — built from real data only.
  let startHere: string
  if (todaysEvents.length === 0 && queueItems.length === 0) {
    startHere = 'No events today, and nothing needs review. All caught up.'
  } else if (todaysEvents.length === 0) {
    startHere = `No events today. ${queueItems.length} item${queueItems.length === 1 ? '' : 's'} still need${queueItems.length === 1 ? 's' : ''} review.`
  } else {
    const eventPart = `${todaysEvents.map((e) => e.nightName).join(' + ')} ${todaysEvents.length === 1 ? 'is' : 'are'} ${liveCount > 0 ? 'live' : 'today'}.`
    startHere = queueItems.length > 0
      ? `${eventPart} ${queueItems.length} closeout item${queueItems.length === 1 ? '' : 's'} still need${queueItems.length === 1 ? 's' : ''} review.`
      : `${eventPart} Nothing else needs review right now.`
  }

  // Today's Agenda: today's events first, then top open items, capped.
  const agendaItems: { key: string; icon: React.ReactNode; title: string; detail: string; chip?: { label: string; color: string; bg: string } }[] = []
  for (const e of todaysEvents) {
    const guestCount = e.confirmedGuests + e.otaGuests
    agendaItems.push({
      key: `event-${e.id}`,
      icon: <CalendarDays size={17} color={T.statusAmber} />,
      title: e.nightName,
      detail: [`${guestCount} guest${guestCount === 1 ? '' : 's'}`, e.startTime, e.meetUpLocation].filter(Boolean).join(' · '),
      chip: e.isOpen
        ? { label: 'LIVE', color: T.statusGreen, bg: T.statusGreenSoft }
        : { label: 'Closed', color: T.textMuted, bg: T.chipBg },
    })
  }
  for (const item of queueItems.slice(0, Math.max(0, AGENDA_CAP - agendaItems.length))) {
    agendaItems.push({
      key: `queue-${item.id}`,
      icon: <ListChecks size={17} color={T.statusBlue} />,
      title: item.reasons[0],
      detail: `${item.nightName} · ${item.eventDate}`,
    })
  }
  const agenda = agendaItems.slice(0, AGENDA_CAP)
  const agendaQueueCount = agenda.filter((a) => a.key.startsWith('queue')).length

  const glanceTiles = [
    { label: "Today's Events", value: String(todaysEvents.length), sub: liveCount > 0 ? `${liveCount} live` : 'scheduled', icon: CalendarDays, color: T.statusAmber },
    { label: 'Open Items', value: String(queueItems.length), sub: 'needs review', icon: ListChecks, color: T.statusBlue },
    { label: "Today's Bookings", value: String(todaysGuests), sub: 'guests', icon: Users, color: T.statusGreen },
  ]

  const quickActions = [
    { label: 'Event', Icon: CalendarPlus },
    { label: 'Expense', Icon: Receipt },
    { label: 'Partner', Icon: UserPlus },
    { label: 'Note', Icon: StickyNote },
  ]

  return (
    <div style={{ padding: '18px 18px 8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{greeting()}, {name}.</h1>
          <p style={{ fontSize: '13px', color: T.textMuted, margin: 0 }}>Here's what needs your attention.</p>
        </div>
        <div
          style={{
            width: '38px', height: '38px', borderRadius: '11px', background: T.bgElevated,
            border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Bell size={17} color={T.textMuted} />
        </div>
      </div>

      {/* Start Here */}
      <div
        style={{
          background: T.accentSoft, border: `1px solid rgba(245,121,58,0.3)`, borderRadius: T.radius,
          padding: '13px 16px', marginBottom: '18px',
        }}
      >
        <p style={{ ...eyebrow(T.accentText), marginBottom: '5px' }}>Start Here</p>
        <p style={{ fontSize: '14px', lineHeight: 1.4, margin: 0, color: T.text }}>{startHere}</p>
      </div>

      {/* At a Glance */}
      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>At a Glance</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px', marginBottom: '18px' }}>
        {glanceTiles.map((tile) => (
          <div key={tile.label} style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '12px' }}>
            <tile.icon size={16} color={tile.color} style={{ marginBottom: '7px' }} />
            <p style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px' }}>{tile.value}</p>
            <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>{tile.label} · {tile.sub}</p>
          </div>
        ))}
        <div style={{ background: T.dashedBg, border: `1px dashed ${T.border}`, borderRadius: T.radiusSm, padding: '12px', opacity: 0.55 }}>
          <CheckCircle2 size={16} color={T.textFaint} style={{ marginBottom: '7px' }} />
          <p style={{ fontSize: '19px', fontWeight: 700, margin: '0 0 2px', color: T.textFaint }}>—</p>
          <p style={{ fontSize: '11px', color: T.textFaint, margin: 0 }}>Approvals · not available yet</p>
        </div>
      </div>

      {/* Today's Agenda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <p style={{ ...eyebrow(T.textFaint), margin: 0 }}>Today's Agenda</p>
        {(todaysEvents.length + queueItems.length > agenda.length || queueItems.length > agendaQueueCount) && (
          <Link href="/operator/work" style={{ fontSize: '12px', color: T.accent, textDecoration: 'none' }}>View all</Link>
        )}
      </div>
      <div style={{ marginBottom: '18px' }}>
        {agenda.length === 0 && (
          <p style={{ fontSize: '13px', color: T.textFaint, padding: '6px 0' }}>Nothing on the agenda right now.</p>
        )}
        {agenda.map((item) => (
          <div
            key={item.key}
            style={{
              display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 4px',
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            {item.icon}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px' }}>{item.title}</p>
              <p style={{ fontSize: '12px', color: T.textMuted, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.detail}</p>
            </div>
            {item.chip ? (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: item.chip.bg, color: item.chip.color, flexShrink: 0 }}>
                {item.chip.label}
              </span>
            ) : (
              <ChevronRight size={16} color={T.textFaint} style={{ flexShrink: 0 }} />
            )}
          </div>
        ))}
      </div>

      {/* Work In Progress — fixed 2-column grid, not a horizontal scroller:
          with the preview capped to 2 cards they fit the 390px frame without
          needing inner scroll. Full list lives on /operator/work. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <p style={{ ...eyebrow(T.textFaint), margin: 0 }}>Work In Progress</p>
        {queueItems.length > 0 && (
          <Link href="/operator/work" style={{ fontSize: '12px', color: T.accent, textDecoration: 'none' }}>View all</Link>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px', marginBottom: '18px' }}>
        {queueItems.length === 0 && (
          <p style={{ fontSize: '13px', color: T.textFaint, padding: '6px 0', gridColumn: '1 / -1' }}>Nothing open right now.</p>
        )}
        {queueItems.slice(0, WIP_PREVIEW_CAP).map((item) => (
          <div
            key={item.id}
            style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '11px' }}
          >
            <p style={{ fontSize: '10px', fontWeight: 700, color: T.statusAmber, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
              {item.reasons[0]}
            </p>
            <p style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 2px' }}>{item.nightName}</p>
            <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>{item.eventDate}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions — disabled: none of these have a safe, ready flow yet
          at /operator (event/expense creation on /dashboard is scoped to a
          specific product/event, not a free-standing quick-add; Partner and
          Note don't exist). Shown for layout parity with the mockup, inert. */}
      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>Quick Actions</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {quickActions.map(({ label, Icon }) => (
          <div
            key={label}
            title="Not available yet"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '11px 4px',
              background: T.dashedBg, border: `1px dashed ${T.border}`, borderRadius: T.radiusSm,
              opacity: 0.4, cursor: 'not-allowed',
            }}
          >
            <Icon size={17} color={T.textFaint} />
            <span style={{ fontSize: '10.5px', color: T.textFaint }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
