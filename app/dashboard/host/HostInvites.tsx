'use client'

import { useCallback, useEffect, useState } from 'react'

// Phase 3C on the host view: "+ Create booking" makes a personal invite link
// for one guest; "My invites & commission" lists the host's own links and
// what they earn (฿ per paid ticket, earned once the night has happened).
// Hosts never see ticket prices or revenue here.

const STATE: Record<string, [string, string]> = {
  waiting: ['Waiting for the guest to book', 'rgba(255,255,255,0.55)'],
  upcoming: ['Booked — earns after the night', '#93C5FD'],
  earned: ['Earned — to be paid', '#FCD34D'],
  paid: ['Paid', '#6EE7B7'],
  expired: ['Link expired', 'rgba(255,255,255,0.40)'],
  cancelled: ['Cancelled', 'rgba(255,255,255,0.40)'],
  no_commission: ['No commission (refunded or not via link)', 'rgba(255,255,255,0.40)'],
}

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

export default function HostInvites() {
  const [data, setData] = useState<any>(null)
  const [nights, setNights] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ eventId: '', guestName: '', guestEmail: '', guestPhone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/host/invites', { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setData(await res.json())
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!open || nights.length) return
    fetch('/api/events?storefront=bcc').then((r) => r.json()).then((j) => setNights((j.events ?? []).filter((e: any) => e.remaining == null || e.remaining > 0))).catch(() => {})
  }, [open, nights.length])

  async function create() {
    setBusy(true); setError(''); setLink(''); setCopied(false)
    const res = await fetch('/api/admin/host/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem. Try again.' }
    setBusy(false)
    if (!res?.ok) return setError(json.error || 'Could not create the link.')
    setLink(json.link)
    load()
  }

  async function cancel(id: string) {
    if (!confirm('Cancel this link? The guest won’t be able to use it.')) return
    await fetch('/api/admin/host/invites', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel' }) }).catch(() => null)
    load()
  }

  const night = nights.find((n) => n.eventId === form.eventId)
  const message = link ? `Hi ${form.guestName.split(' ')[0]}! Here's your link to join me at ${night?.nightName ?? 'Bangkok Club Crawl'} on ${pretty(night?.eventDate ?? null)} 🎉 ${link}` : ''
  const t = data?.totals

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
                Makes a personal booking link for one guest. They choose how many tickets and pay on the website. You earn ฿{data?.commissionPerTicket ?? 150} per paid ticket after the night. The link works for 7 days.
              </p>
              <span style={label}>Night</span>
              <select value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} style={field} disabled={busy}>
                <option value="">Choose a night…</option>
                {nights.map((n) => <option key={n.eventId} value={n.eventId}>{pretty(n.eventDate)} · {n.nightName}</option>)}
              </select>
              <span style={label}>Guest’s full name</span>
              <input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} style={field} disabled={busy} autoComplete="off" />
              <span style={label}>Guest’s email</span>
              <input type="email" inputMode="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} style={field} disabled={busy} autoComplete="off" />
              <span style={label}>Guest’s phone (WhatsApp)</span>
              <input type="tel" inputMode="tel" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} style={field} disabled={busy} placeholder="+66…" autoComplete="off" />
              {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>}
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

      {data && (
        <div style={{ marginTop: '18px' }}>
          <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', margin: '0 0 8px' }}>My invites & commission</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
            {[['Upcoming', t?.upcoming], ['To be paid', t?.earned], ['Paid', t?.paid]].map(([l, v]) => (
              <div key={l as string} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{l}</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>฿{(v as number ?? 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
          {data.invites.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>No invites yet. Tap “+ Create booking” to invite your first guest.</p>}
          {data.invites.slice(0, 50).map((v: any) => (
            <div key={v.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <span><b>{v.guestName}</b> · {pretty(v.eventDate)}{v.tickets ? ` · ${v.tickets} ticket${v.tickets === 1 ? '' : 's'}` : ''}</span>
                {v.amount > 0 && <b>฿{v.amount.toLocaleString()}</b>}
              </div>
              <div style={{ color: STATE[v.state]?.[1], marginTop: '2px' }}>
                {STATE[v.state]?.[0] ?? v.state}
                {v.state === 'waiting' && (
                  <>
                    {' · '}<button onClick={() => navigator.clipboard?.writeText(v.link)} style={{ background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '13px' }}>copy link</button>
                    {' · '}<button onClick={() => cancel(v.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '13px' }}>cancel</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
