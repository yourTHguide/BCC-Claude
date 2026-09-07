'use client'

import { useState } from 'react'
import { operatorTheme as T } from '@/lib/operator/theme'

interface Guest {
  guestName: string | null
  quantity: number
  source: string
  attendanceStatus: string
}

// "Copy Brief" assembles the same field sources buildHostBriefText() uses
// in app/dashboard/page.tsx:394-445 (name/date/host/meeting point/guest
// list/WhatsApp/venue route/van-taxi/notes) — same content, mobile-formatted
// trigger instead of a plain-text block on screen. "Send Announcement"
// reuses POST /api/send-confirmed-meetup exactly, including its
// server-side precondition checks — this component doesn't re-guess those
// rules, it just displays whatever `missing` the server returns.
export default function BriefActions({
  id,
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
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [sendIssues, setSendIssues] = useState<string[] | null>(null)

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

  async function sendAnnouncement() {
    setSending(true)
    setSendResult(null)
    setSendIssues(null)
    try {
      const res = await fetch('/api/send-confirmed-meetup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendIssues(data.missing ?? [data.error ?? 'Could not send.'])
      } else {
        setSendResult(`Sent to ${data.sent} guest${data.sent === 1 ? '' : 's'}${data.skippedNoEmail ? ` (${data.skippedNoEmail} skipped, no email)` : ''}.`)
      }
    } catch {
      setSendIssues(['Could not reach the server.'])
    } finally {
      setSending(false)
    }
  }

  const btnStyle = { flex: 1, padding: '12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.bgElevated, color: T.text, fontWeight: 600, fontSize: '13px', cursor: 'pointer' as const }

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button type="button" onClick={copyBrief} style={btnStyle}>{copied ? 'Copied ✓' : 'Copy Brief'}</button>
        <button type="button" disabled={sending} onClick={sendAnnouncement} style={{ ...btnStyle, background: T.accent, color: '#fff', border: 'none' }}>
          {sending ? 'Sending…' : 'Send Announcement'}
        </button>
      </div>
      {sendResult && <p style={{ fontSize: '12px', color: T.statusGreen, margin: 0 }}>{sendResult}</p>}
      {sendIssues && (
        <div style={{ fontSize: '12px', color: T.statusAmber, margin: 0 }}>
          Can't send yet: {sendIssues.join('; ')}
        </div>
      )}
    </div>
  )
}
