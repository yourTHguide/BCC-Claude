'use client'

import { useEffect, useState } from 'react'

// Phase 3C on the host view: "+ Create booking" makes a personal invite link
// for one guest. The host's invites and commission are listed under
// "My earnings" (HostEarnings.tsx). Hosts never see ticket prices or revenue.


const field = {
  width: '100%', height: '42px', borderRadius: '8px', padding: '0 12px', boxSizing: 'border-box' as const,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '15px', fontFamily: 'Inter, sans-serif',
}
const label = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', margin: '10px 0 6px' }

function pretty(date: string | null) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export default function HostInvites({ commissionPerTicket, onCreated }: { commissionPerTicket?: number; onCreated?: () => void }) {
  const [nights, setNights] = useState<any[]>([])
  const [nightsLoaded, setNightsLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ eventId: '', guestName: '', guestEmail: '', guestPhone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open || nightsLoaded) return
    fetch('/api/events?storefront=bcc').then((r) => r.json())
      .then((j) => setNights((j.events ?? []).filter((e: any) => e.remaining == null || e.remaining > 0)))
      .catch(() => setError('Could not load the nights. Close and try again.'))
      .finally(() => setNightsLoaded(true))
  }, [open, nightsLoaded])

  async function create() {
    setBusy(true); setError(''); setLink(''); setCopied(false)
    const res = await fetch('/api/admin/host/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem. Try again.' }
    setBusy(false)
    if (!res?.ok) return setError(json.error || 'Could not create the link.')
    setLink(json.link)
    onCreated?.()
  }

  const night = nights.find((n) => n.eventId === form.eventId)
  const message = link ? `Hi ${form.guestName.split(' ')[0]}! Here's your link to join me at ${night?.nightName ?? 'Bangkok Club Crawl'} on ${pretty(night?.eventDate ?? null)} 🎉 ${link}` : ''

  return (
    <div style={{ margin: '16px 0 8px' }}>
      {!open ? (
        <button onClick={() => { setOpen(true); setLink(''); setError('') }} style={{ width: '100%', height: '46px', borderRadius: '8px', border: '1px solid #EA003A', background: 'rgba(234,0,58,0.12)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
          + Create booking
        </button>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>Invite a guest</b>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer' }} aria-label="Close">✕</button>
          </div>
          {!link ? (
            <>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: '6px 0 0' }}>
                Makes a personal booking link for one guest. They choose how many tickets and pay on the website. You earn ฿{commissionPerTicket ?? 150} per paid ticket after the night. The link works for 7 days.
              </p>
              <span style={label}>Night</span>
              <select value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} style={field} disabled={busy || (nightsLoaded && !nights.length)}>
                <option value="">{!nightsLoaded ? 'Loading nights…' : nights.length ? 'Choose a night…' : 'No nights on sale right now'}</option>
                {nights.map((n) => <option key={n.eventId} value={n.eventId}>{pretty(n.eventDate)} · {n.nightName}</option>)}
              </select>
              <span style={label}>Guest’s full name</span>
              <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} style={field} disabled={busy} autoComplete="off" />
              <span style={label}>Guest’s email</span>
              <input type="email" inputMode="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} style={field} disabled={busy} autoComplete="off" />
              <span style={label}>Guest’s phone (WhatsApp)</span>
              <input type="tel" inputMode="tel" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} style={field} disabled={busy} placeholder="+66…" autoComplete="off" />
              {nightsLoaded && !nights.length && (
                <p style={{ color: '#FCD34D', fontSize: '12px', margin: '6px 0 0' }}>Invites can only be made for nights that are on sale with seats left. Ask the owner to switch a night ON.</p>
              )}
              {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>}
              {(() => {
                const missing = [!form.eventId && 'a night', form.guestName.trim().length < 2 && 'the guest’s full name', !form.guestEmail.includes('@') && 'the guest’s email'].filter(Boolean)
                return missing.length > 0 ? <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '10px 0 0' }}>To create the link, add {missing.join(', ')}.</p> : null
              })()}
              <button onClick={create} disabled={busy || !form.eventId || form.guestName.trim().length < 2 || !form.guestEmail.includes('@')}
                style={{ width: '100%', height: '46px', marginTop: '14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Creating…' : 'Create link'}
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: '13px', margin: '10px 0 6px' }}>Link for <b>{form.guestName}</b> · {pretty(night?.eventDate ?? null)}:</p>
              <p style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', margin: 0 }}>{link}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true) }} style={{ height: '42px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {copied ? 'Copied ✓' : 'Copy link'}
                </button>
                <a href={`https://wa.me/${form.guestPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
                  style={{ height: '42px', borderRadius: '8px', background: '#25D366', color: '#062', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                  Send on WhatsApp
                </a>
              </div>
              <button onClick={() => { setLink(''); setForm({ eventId: form.eventId, guestName: '', guestEmail: '', guestPhone: '' }) }} style={{ marginTop: '10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>
                Invite another guest
              </button>
            </>
          )}
        </div>
      )}

    </div>
  )
}
