'use client'

import { useCallback, useEffect, useState } from 'react'

// Owner van controls inside a night's panel (Phase 3D): van setting, who is in
// which van (groups kept together, booking order), van 1 / van 2 status
// against their minimums (5 / 4), and Run / Close / Reopen van 2.
// Short-van options (refund / new date) come next.

const pill = (active: boolean) => ({
  height: '34px', padding: '0 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  border: `1px solid ${active ? '#EA003A' : 'rgba(255,255,255,0.15)'}`, background: active ? 'rgba(234,0,58,0.18)' : 'transparent', color: '#fff',
})

export default function VanPanel({ eventId }: { eventId: string }) {
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
      {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '12px', margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}
