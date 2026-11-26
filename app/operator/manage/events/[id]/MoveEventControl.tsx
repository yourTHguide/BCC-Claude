'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import GuestMessage, { EmailPreview, rememberMessage, type GuestMessageValue } from '@/components/operator/GuestMessage'

// Owner-only: move the whole event (and every confirmed guest) to another
// date, emailing each website guest the owner's own message. OTA guests
// follow the night here; their platform booking is changed on the platform.
export default function MoveEventControl({ id, eventDate, nightName, guests }: { id: string; eventDate: string; nightName: string; guests: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [msg, setMsg] = useState<GuestMessageValue>({ message: '', notify: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const field = {
    width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }

  async function post(url: string, body: object) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok, json: await res.json().catch(() => ({})) }
  }

  async function showPreview() {
    if (!newDate) return setError('Pick the new date first.')
    setPreviewing(true)
    setError(null)
    const r = await post('/api/booking-email-preview', { action: 'move_event', eventId: id, newDate, message: msg.message })
    setPreviewing(false)
    if (r.ok) setPreview(r.json)
    else setError(r.json.error ?? 'Preview failed')
  }

  async function submit() {
    setError(null)
    if (!newDate) return setError('Pick the new date first.')
    if (!confirm(`Move ${nightName} from ${eventDate} to ${newDate}?\nAll ${guests} booked guest${guests === 1 ? '' : 's'} move with it${msg.notify ? ' and website guests are emailed' : ''}.`)) return
    setBusy(true)
    const r = await post(`/api/operator/events/${id}/move`, { newDate, message: msg.message, notify: msg.notify })
    setBusy(false)
    if (!r.ok) return setError(r.json.error ?? 'Move failed')
    rememberMessage('move_event', msg.message)
    const j = r.json
    const parts = [`Moved to ${j.newDate}: ${j.moved} website booking${j.moved === 1 ? '' : 's'}`]
    if (msg.notify) parts.push(`${j.emailed} emailed`)
    if (j.noEmail?.length) parts.push(`no email for ${j.noEmail.join(', ')}`)
    if (j.emailFailed?.length) parts.push(`email FAILED for ${j.emailFailed.join(', ')} — contact them directly`)
    if (j.otaMoved) parts.push(`${j.otaMoved} OTA booking${j.otaMoved === 1 ? '' : 's'} moved here — change ${j.otaMoved === 1 ? 'it' : 'them'} on the platform too`)
    setResult(parts.join(' · '))
    setOpen(false)
    router.refresh()
  }

  return (
    <div style={{ marginBottom: '18px' }}>
      {result && <p style={{ fontSize: '12.5px', color: T.statusGreen, margin: '0 0 10px', lineHeight: 1.5 }}>{result}</p>}
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setResult(null) }} style={{ ...field, cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}>
          Move this event to another date
        </button>
      ) : (
        <div style={{ display: 'grid', gap: '10px', padding: '14px', border: `1px solid ${T.border}`, borderRadius: T.radiusSm, background: T.bgElevated }}>
          <p style={eyebrow(T.textFaint)}>Move event · {guests} guest{guests === 1 ? '' : 's'} booked</p>
          <input type="date" aria-label="New date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ ...field, background: T.bg }} />
          <GuestMessage kind="move_event" value={msg} onChange={setMsg} onPreview={showPreview} previewing={previewing} />
          {error && <p style={{ fontSize: '12.5px', color: T.statusRed, margin: 0 }}>{error}</p>}
          <button type="button" disabled={busy || !newDate} onClick={submit} style={{ ...field, background: T.accent, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', textAlign: 'center', opacity: busy || !newDate ? 0.5 : 1 }}>
            {busy ? 'Moving and emailing…' : 'Move event'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(null) }} style={{ ...field, cursor: 'pointer', textAlign: 'center' }}>Cancel</button>
        </div>
      )}
      {preview && <EmailPreview {...preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
