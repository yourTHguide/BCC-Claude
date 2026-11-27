'use client'

import { useCallback, useEffect, useState } from 'react'

// Owner van controls inside a night's panel (Phase 3D): van setting, who is in
// which van (groups kept together, booking order), van 1 / van 2 status
// against their minimums (5 / 4), and Run / Close / Reopen van 2.
// "Not enough guests" options: one click emails website guests (whole night
// or van 2) a personal link to choose refund / new date / credit; each choice
// is approved here with one click. OTA guests are listed to handle on the platform.

const pill = (active: boolean) => ({
  height: '34px', padding: '0 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  border: `1px solid ${active ? '#EA003A' : 'rgba(255,255,255,0.15)'}`, background: active ? 'rgba(234,0,58,0.18)' : 'transparent', color: '#fff',
})

export default function VanPanel({ eventId }: { eventId: string }) {
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [ota, setOta] = useState<any[]>([])
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/vans/${eventId}`, { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setD(await res.json())
  }, [eventId])
  useEffect(() => { load() }, [load])

  async function post(body: object, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setBusy(true); setError('')
    const res = await fetch(`/api/admin/vans/${eventId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    setBusy(false)
    if (!res?.ok) setError(json.error || 'Could not save.')
    else if (json.sent) {
      setNote(`Options emailed to ${json.sent.length} guest(s)${json.failed?.length ? `. Not emailed: ${json.failed.join(', ')} — use Copy link / WhatsApp below` : ''}${json.skipped?.length ? `. ${json.skipped.length} already had them` : ''}.`)
      setOta(json.ota ?? [])
    }
    load()
  }

  if (!d) return null
  const s = d.status
  const list = (ps: any[]) => ps.map((p: any) => `${p.name}${p.quantity > 1 ? ` (${p.quantity})` : ''}`).join(', ') || '—'
  return (
    <div style={{ marginBottom: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>VANS</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button disabled={busy} style={pill(d.vanCount == null)} onClick={() => post({ action: 'set_vans', count: null }, 'Turn vans off? This night goes back to 12 seats.')}>No vans (12)</button>
        <button disabled={busy} style={pill(d.vanCount === 1)} onClick={() => post({ action: 'set_vans', count: 1 })}>1 van (10)</button>
        <button disabled={busy} style={pill(d.vanCount === 2)} onClick={() => post({ action: 'set_vans', count: 2 })}>2 vans (20)</button>
      </div>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '6px 0 0' }}>{d.taken} guest(s) booked · {d.capacity ?? '∞'} seats</p>

      {s && (
        <div style={{ marginTop: '10px', fontSize: '13px', display: 'grid', gap: '8px' }}>
          <div>
            <b>🚐 Van 1: {s.van1.guests}/10</b>{' '}
            <span style={{ color: s.van1.ok ? '#6EE7B7' : '#FCD34D' }}>{s.van1.ok ? '✓ runs' : `needs ${s.van1.min} to run`}</span>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{list(d.split.van1)}</div>
          </div>
          {s.van2 && (
            <div>
              <b>🚐 Van 2: {s.van2.guests}/10</b>{' '}
              <span style={{ color: s.van2.state === 'running' ? '#6EE7B7' : s.van2.state === 'closed' ? 'rgba(255,255,255,0.5)' : s.van2.ok ? '#93C5FD' : '#FCD34D' }}>
                {s.van2.state === 'running' ? '✓ running' : s.van2.state === 'closed' ? 'closed (no more sales)' : s.van2.ok ? 'enough guests — confirm it runs' : `needs ${s.van2.min} to run`}
              </span>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>{list(d.split.van2)}</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {s.van2.state !== 'running' && <button disabled={busy} style={pill(false)} onClick={() => post({ action: 'van2', state: 'running' }, 'Run Van 2 tonight?')}>✓ Run van 2</button>}
                {s.van2.state !== 'closed' && <button disabled={busy} style={pill(false)} onClick={() => post({ action: 'van2', state: 'closed' }, 'Close Van 2? Sales stop; guests already in Van 2 stay booked until you send them options.')}>Close van 2</button>}
                {s.van2.state !== 'open' && <button disabled={busy} style={pill(false)} onClick={() => post({ action: 'van2', state: 'open' })}>Reopen sales</button>}
              </div>
            </div>
          )}
          {d.split.over.length > 0 && <div style={{ color: '#FCA5A5' }}>⚠ Over capacity: {list(d.split.over)} — check OTA limits in Bókun.</div>}
          {s.needsDecision && <div style={{ fontSize: '12px', color: '#FCD34D' }}>Decision needed by 7 PM{s.van2 && s.van2.guests > 0 && s.van2.state === 'open' ? ' (final van 2 reminder at 8 PM)' : ''}.</div>}
        </div>
      )}
      {d.taken > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>NOT ENOUGH GUESTS?</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button disabled={busy} style={pill(false)} onClick={() => post({ action: 'send_options', reason: 'night_short' }, 'The night won’t run. Email every website guest a choice of full refund, new date or credit?')}>Night won’t run → send options</button>
            {s?.van2 && s.van2.guests > 0 && <button disabled={busy} style={pill(false)} onClick={() => post({ action: 'send_options', reason: 'van2_short' }, 'Van 2 won’t run. Close van 2 and email its website guests a choice of full refund, new date or credit?')}>Van 2 won’t run → send options</button>}
          </div>
          {note && <p style={{ fontSize: '12px', color: '#6EE7B7', margin: '6px 0 0' }}>{note}</p>}
          {ota.length > 0 && <p style={{ fontSize: '12px', color: '#FCD34D', margin: '4px 0 0' }}>Handle on the platform (OTA): {ota.map((o: any) => `${o.name} (${o.source}, ${o.quantity})`).join(', ')}</p>}
          {(d.options ?? []).length > 0 && (
            <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
              {d.options.map((o: any) => (
                <div key={o.id} style={{ fontSize: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px' }}>
                  <b>{o.guestName}</b> · {o.quantity} · ฿{Math.round(o.totalPaid).toLocaleString()} · <span style={{ color: 'rgba(255,255,255,0.55)' }}>{o.reason === 'van2_short' ? 'van 2' : 'night'}</span>
                  <div style={{ marginTop: '2px', color: o.status === 'resolved' ? '#6EE7B7' : o.choice ? '#93C5FD' : 'rgba(255,255,255,0.55)' }}>
                    {o.status === 'resolved' ? `✓ ${o.resolution}${o.credit ? ` · credit ${o.credit.status === 'active' ? `฿${(o.credit.amount - o.credit.used_amount).toLocaleString()} left` : o.credit.status}` : ''}` : o.choice === 'refund' ? 'Chose: full refund' : o.choice === 'move' ? `Chose: move${o.preferred ? ` → ${o.preferred.event_date} ${o.preferred.night_name}` : o.preferred_date ? ` → ${o.preferred_date} (no night yet — created OFF on approval)` : ''}${o.preference_note ? ` · “${o.preference_note}”` : ''}` : o.choice === 'credit' ? 'Chose: credit' : `Waiting for their choice${o.reminder_sent_at ? ' (reminded)' : ''} · credit after 48 h`}
                  </div>
                  {o.credit?.status === 'active' && o.credit.amount - o.credit.used_amount > 0 && (
                    <button disabled={busy} style={{ ...pill(false), marginTop: '6px' }} onClick={async () => {
                      if (!confirm(`Refund ฿${(o.credit.amount - o.credit.used_amount).toLocaleString()} credit to ${o.guestName}'s card?`)) return
                      setBusy(true)
                      const res = await fetch('/api/admin/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creditId: o.credit.id }) }).catch(() => null)
                      const j = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
                      setBusy(false)
                      if (!res?.ok) setError(j.error || 'Refund failed.')
                      else setNote(`Refunded ฿${j.amount.toLocaleString()} to ${o.guestName}.`)
                      load()
                    }}>Refund credit</button>
                  )}
                  {o.status !== 'resolved' && o.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button type="button" onClick={() => { navigator.clipboard?.writeText(o.link); setNote(`Link for ${o.guestName} copied.`) }} style={{ background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '12px' }}>Copy link</button>
                      {o.phone && <a href={`https://wa.me/${String(o.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${String(o.guestName).split(' ')[0]}, sorry — your Bangkok Club Crawl night can’t run as booked. Please choose a full refund, a new date or credit here: ${o.link}`)}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', fontSize: '12px' }}>WhatsApp</a>}
                    </div>
                  )}
                  {o.status !== 'resolved' && o.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {o.choice === 'refund' && <button disabled={busy} style={pill(true)} onClick={() => post({ action: 'resolve', optionId: o.id, resolution: 'refunded' }, `Refund ฿${Math.round(o.totalPaid).toLocaleString()} to ${o.guestName} via Stripe?`)}>Approve refund</button>}
                      {o.choice === 'move' && (o.preferred || o.preferred_date) && <button disabled={busy} style={pill(true)} onClick={() => post({ action: 'resolve', optionId: o.id, resolution: 'moved' }, `Move ${o.guestName} to ${o.preferred?.event_date ?? o.preferred_date}?`)}>Approve move</button>}
                      {o.choice === 'credit' && <button disabled={busy} style={pill(true)} onClick={() => post({ action: 'resolve', optionId: o.id, resolution: 'credited' }, `Keep ฿${Math.round(o.totalPaid).toLocaleString()} as credit for ${o.guestName}?`)}>Approve credit</button>}
                      {o.choice === 'move' && !o.preferred && !o.preferred_date && <span style={{ color: 'rgba(255,255,255,0.6)' }}>No date picked — move them with Reschedule, or:</span>}
                      {o.choice !== 'refund' && <button disabled={busy} style={pill(false)} onClick={() => post({ action: 'resolve', optionId: o.id, resolution: 'refunded' }, `Refund ${o.guestName} instead?`)}>Refund</button>}
                      {o.choice !== 'credit' && <button disabled={busy} style={pill(false)} onClick={() => post({ action: 'resolve', optionId: o.id, resolution: 'credited' }, `Keep as credit for ${o.guestName} instead?`)}>Credit</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '12px', margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}
