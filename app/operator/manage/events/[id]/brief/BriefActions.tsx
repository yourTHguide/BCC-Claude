'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { operatorTheme as T } from '@/lib/operator/theme'
import MeetupSender from '@/components/operations/MeetupSender'

interface Guest {
  id: string
  kind: 'bookings' | 'ota_bookings'
  guestName: string | null
  quantity: number
  source: string
  attendanceStatus: string
  email: string | null
  meetupSentAt: string | null
}

// "Copy Brief" assembles the same field sources buildHostBriefText() uses
// in app/dashboard/page.tsx:394-445 (name/date/host/meeting point/guest
// list/WhatsApp/venue route/van-taxi/notes) — same content, mobile-formatted
// trigger instead of a plain-text block on screen. The meetup email
// reuses POST /api/send-confirmed-meetup exactly, including its
// server-side precondition checks — this component doesn't re-guess those
// rules, it just displays whatever `missing` the server returns.
export default function BriefActions({
  id,
  operationVerdict,
  nightName,
  eventDate,
  hostAssigned,
  meetUpLocation,
  whatsappGroupLink,
  vanOrTaxiContact,
  specialNotes,
  venueRoute,
  guests,
}: {
  id: string
  operationVerdict: string
  nightName: string
  eventDate: string
  hostAssigned: string | null
  meetUpLocation: string | null
  whatsappGroupLink: string | null
  vanOrTaxiContact: string | null
  specialNotes: string | null
  venueRoute: { venue1?: string; venue2?: string; venue3?: string; venue4?: string; backup?: string; notes?: string }
  guests: Guest[]
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  // Same preconditions the send route enforces; shown up front so the
  // buttons explain themselves instead of failing on press.
  const blockers = [
    operationVerdict !== 'Operation Confirmed' && 'Operation status must be "Operation Confirmed"',
    !meetUpLocation && 'Meet-up location is not set',
    !whatsappGroupLink && 'WhatsApp group link is not set',
  ].filter(Boolean) as string[]

  function buildBriefText(): string {
    const totalGuests = guests.reduce((s, g) => s + g.quantity, 0)
    const guestLines = guests.map((g) => `- ${g.guestName || 'Guest'} · ${g.quantity} · ${g.source} · ${g.attendanceStatus}`)
    const routeLines = (['venue1', 'venue2', 'venue3', 'venue4', 'backup', 'notes'] as const)
      .map((k) => venueRoute[k] && `${k}: ${venueRoute[k]}`)
      .filter(Boolean)
    return [
      `${nightName} — ${eventDate}`,
      `Host: ${hostAssigned || 'Unassigned'}`,
      `Meeting point: ${meetUpLocation || '—'}`,
      `Total guests: ${totalGuests}`,
      '',
      'Guests:',
      ...guestLines,
      '',
      `WhatsApp group: ${whatsappGroupLink || '—'}`,
      ...(routeLines.length ? ['', 'Route:', ...routeLines] : []),
      `Van/taxi: ${vanOrTaxiContact || '—'}`,
      ...(specialNotes ? ['', `Notes: ${specialNotes}`] : []),
    ].join('\n')
  }

  async function copyBrief() {
    await navigator.clipboard.writeText(buildBriefText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnStyle = { flex: 1, padding: '12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.bgElevated, color: T.text, fontWeight: 600, fontSize: '13px', cursor: 'pointer' as const }

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button type="button" onClick={copyBrief} style={btnStyle}>{copied ? 'Copied ✓' : 'Copy Brief'}</button>
      </div>
      <MeetupSender
        eventId={id}
        nightName={nightName}
        eventDate={eventDate}
        guests={guests.map((g) => ({
          table: g.kind, id: g.id, name: g.guestName || 'Guest', quantity: g.quantity,
          email: g.email, sentAt: g.meetupSentAt, attendance: g.attendanceStatus,
        }))}
        blockers={blockers}
        palette={{
          text: T.text, muted: T.textMuted, faint: T.textFaint, border: T.border, rowBg: T.bgElevated,
          accent: T.accent, green: T.statusGreen, amber: T.statusAmber, red: T.statusRed,
        }}
        onSent={() => router.refresh()}
      />
    </div>
  )
}
