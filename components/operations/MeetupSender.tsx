'use client'

import { useState } from 'react'

// Confirmed-meetup email controls, shared by the BCC /dashboard day panel
// and the BNT /operator event Brief. Every send goes through
// POST /api/send-confirmed-meetup, which records meetup_sent_at per guest:
//   • main button   → mode 'unsent': only guests who haven't had it yet
//   • per-guest     → mode 'guests': Send / Resend one guest
//   • "resend all"  → mode 'all': explicit, behind its own confirm
// Native confirm() is deliberate (no nested modal to get stuck behind).

export interface MeetupGuest {
  table: 'bookings' | 'ota_bookings'
  id: string
  name: string
  quantity: number
  email: string | null
  sentAt: string | null
  attendance: string // expected | checked_in | no_show
}

export interface MeetupPalette {
  text: string
  muted: string
  faint: string
  border: string
  rowBg: string
  accent: string
  green: string
  amber: string
  red: string
}

function fmt(ts: string): string {
  return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
}

export default function MeetupSender({ eventId, nightName, eventDate, guests, blockers, palette: P, onSent }: {
  eventId: string
  nightName: string
  eventDate: string
  guests: MeetupGuest[]
  /** Reasons the email can't go out yet (verdict, meet-up, WhatsApp link…). */
  blockers: string[]
  palette: MeetupPalette
  onSent: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null) // 'main' | 'all' | `${table}:${id}`
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const active = guests.filter((g) => g.attendance !== 'no_show')
  const unsent = active.filter((g) => !g.sentAt && g.email)
  const unsentNoEmail = active.filter((g) => !g.sentAt && !g.email)
  const anySent = active.some((g) => g.sentAt)
  const blocked = blockers.length > 0

  async function send(mode: 'unsent' | 'all' | 'guests', key: string, picked?: MeetupGuest[]) {
    setBusy(key)
    setResult(null)
    try {
      const res = await fetch('/api/send-confirmed-meetup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, mode, guests: picked?.map((g) => ({ table: g.table, id: g.id })) }),
      })
      const data = await res.json().catch(() => ({} as any))
      if (res.ok && data.success) {
        const skipped = data.skippedNoEmail ? ` · ${data.skippedNoEmail} without email skipped` : ''
        setResult({ ok: true, text: `Sent to ${data.sent} guest${data.sent === 1 ? '' : 's'}${skipped}.` })
        onSent()
      } else {
        setResult({ ok: false, text: (data.missing || [data.error || 'Send failed']).join('; ') })
      }
    } catch {
      setResult({ ok: false, text: 'Could not reach the server — try again.' })
    } finally {
      setBusy(null)
    }
  }

  function sendMain() {
    if (unsent.length === 0) return
    const who = anySent ? `the ${unsent.length} guest${unsent.length === 1 ? '' : 's'} who haven't had it yet` : `all ${unsent.length} guest${unsent.length === 1 ? '' : 's'}`
    if (!confirm(`Email the confirmed meetup for ${nightName} (${eventDate}) to ${who}?\n\n${unsent.map((g) => `• ${g.name}`).join('\n')}`)) return
    send('unsent', 'main')
  }

  function sendAll() {
    const withEmail = active.filter((g) => g.email)
    if (!confirm(`Resend the meetup email to EVERYONE (${withEmail.length} guest${withEmail.length === 1 ? '' : 's'}), including people who already got it?`)) return
    send('all', 'all')
  }

  function sendOne(g: MeetupGuest) {
    if (!confirm(`${g.sentAt ? 'Resend' : 'Send'} the confirmed meetup email to ${g.name} (${g.email})?`)) return
    send('guests', `${g.table}:${g.id}`, [g])
  }

  const btn: React.CSSProperties = { height: '28px', padding: '0 10px', borderRadius: '7px', border: `1px solid ${P.border}`, background: 'transparent', color: P.text, fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
  const mainLabel = busy === 'main' ? 'Sending…'
    : unsent.length === 0 ? (anySent ? '✓ Everyone has been sent the meetup' : 'Send Confirmed Meetup')
    : anySent ? `Send to ${unsent.length} new guest${unsent.length === 1 ? '' : 's'}`
    : `Send Confirmed Meetup (${unsent.length})`

  return (
    <div style={{ color: P.text }}>
      <button
        onClick={sendMain}
        disabled={blocked || unsent.length === 0 || busy !== null}
        style={{ width: '100%', height: '40px', borderRadius: '8px', border: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: '13px', color: '#fff', background: unsent.length === 0 && anySent ? P.green : P.accent, opacity: blocked || busy !== null || unsent.length === 0 ? 0.6 : 1, cursor: blocked || unsent.length === 0 ? 'default' : 'pointer' }}
      >
        {mainLabel}
      </button>

      {blocked && (
        <p style={{ fontSize: '12px', color: P.amber, margin: '8px 0 0' }}>Can't send yet: {blockers.join('; ')}</p>
      )}
      {result && <p style={{ fontSize: '12px', color: result.ok ? P.green : P.red, margin: '8px 0 0' }}>{result.text}</p>}
      {unsentNoEmail.length > 0 && (
        <p style={{ fontSize: '12px', color: P.amber, margin: '8px 0 0' }}>
          No email on file for {unsentNoEmail.map((g) => g.name).join(', ')} — send them the details on WhatsApp.
        </p>
      )}

      {active.length > 0 && (
        <div style={{ marginTop: '10px', border: `1px solid ${P.border}`, borderRadius: '8px', overflow: 'hidden' }}>
          {active.map((g) => {
            const key = `${g.table}:${g.id}`
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', background: P.rowBg, borderBottom: `1px solid ${P.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name} <span style={{ color: P.faint, fontWeight: 400 }}>×{g.quantity}</span></p>
                  <p style={{ fontSize: '11.5px', margin: '1px 0 0', color: !g.email ? P.faint : g.sentAt ? P.green : P.amber }}>
                    {!g.email ? 'No email' : g.sentAt ? `✓ Sent ${fmt(g.sentAt)}` : 'Not sent yet'}
                  </p>
                </div>
                {g.email && (
                  <button onClick={() => sendOne(g)} disabled={blocked || busy !== null} style={{ ...btn, opacity: blocked || busy !== null ? 0.5 : 1, ...(g.sentAt ? {} : { borderColor: P.accent, color: P.accent }) }}>
                    {busy === key ? 'Sending…' : g.sentAt ? 'Resend' : 'Send'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {anySent && (
        <button onClick={sendAll} disabled={blocked || busy !== null} style={{ marginTop: '8px', padding: 0, background: 'none', border: 'none', color: P.muted, fontFamily: 'inherit', fontSize: '11.5px', textDecoration: 'underline', cursor: 'pointer' }}>
          {busy === 'all' ? 'Resending to everyone…' : 'Resend to everyone'}
        </button>
      )}
    </div>
  )
}
