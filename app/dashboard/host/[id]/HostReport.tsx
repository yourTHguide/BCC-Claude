'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GUEST_TAGS, INCIDENT_TYPES } from '@/lib/hostReports'

// The host's after-event report. Saves as a draft while typing; Submit locks
// it. Guest tags are short service notes the host can ask about on the night
// (e.g. still travelling and where next); they are internal, not for marketing.

const box = { width: '100%', borderRadius: '8px', padding: '10px 12px', boxSizing: 'border-box' as const, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '14px', fontFamily: 'Inter, sans-serif' }
const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }
const head = { fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', margin: '0 0 8px' }

export default function HostReport({ eventId, canStart, onSubmitted }: { eventId: string; canStart: boolean; onSubmitted: () => void }) {
  const [data, setData] = useState<any>(null)
  const [r, setR] = useState<any>(null)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<any>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/host/events/${eventId}/report`, { cache: 'no-store' }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem' }
    if (!res?.ok) return setError(json.error || 'Could not load the report.')
    setData(json); setR(json.report)
  }, [eventId])
  useEffect(() => { load() }, [load])

  // Draft autosave, 1.5 s after the last change.
  function update(next: any) {
    setR(next)
    if (!data?.canEdit) return
    clearTimeout(timer.current)
    setSaved('saving')
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/host/events/${eventId}/report`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => null)
      setSaved(res?.ok ? 'saved' : 'error')
    }, 1500)
  }

  async function submit() {
    if (!confirm('Submit the report? You won’t be able to edit it afterwards.')) return
    clearTimeout(timer.current)
    setBusy(true); setError('')
    const res = await fetch(`/api/admin/host/events/${eventId}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }).catch(() => null)
    const json = res ? await res.json().catch(() => ({})) : { error: 'Connection problem. Your draft is saved — try again.' }
    setBusy(false)
    if (!res?.ok) return setError(json.error || 'Could not submit.')
    await load()
    onSubmitted()
  }

  if (!canStart) return <div style={card}><p style={{ margin: 0, fontSize: '14px' }}>The report opens on the night itself. Fill it in after the crawl.</p></div>
  if (error && !r) return <p style={{ color: '#FCA5A5' }}>{error}</p>
  if (!r) return <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>
  const ro = !data.canEdit
  const setGuest = (i: number, patch: any) => update({ ...r, guests: r.guests.map((g: any, n: number) => (n === i ? { ...g, ...patch } : g)) })

  return (
    <div>
      {data.status === 'submitted' ? (
        <p style={{ ...card, color: '#6EE7B7', fontSize: '14px' }}>✓ Submitted {new Date(data.submittedAt).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Thank you! The owner will review it and your pay.</p>
      ) : (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
          Saved as you type{saved === 'saving' ? ' · saving…' : saved === 'saved' ? ' · saved ✓' : saved === 'error' ? ' · not saved, check your connection' : ''}. Submit when you’re done — your pay is ready after the report is in.
        </p>
      )}

      <div style={card}>
        <p style={head}>Overall vibe</p>
        <textarea rows={4} value={r.vibe} disabled={ro} onChange={(e) => update({ ...r, vibe: e.target.value })} placeholder="How did the night go? Energy, group mix, timing…" style={box} />
      </div>

      <div style={card}>
        <p style={head}>Guests ({r.guests.length})</p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '-4px 0 10px' }}>Tip: ask your guests during the night — are they still travelling, where next, coming back, interested in VIP tables or other events?</p>
        {r.guests.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No guests on this night.</p>}
        {r.guests.map((g: any, i: number) => (
          <div key={g.key} style={{ borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', padding: '10px 0' }}>
            <div style={{ fontSize: '14px', marginBottom: '6px' }}>
              <b>{g.name}</b>{g.quantity > 1 ? ` · ${g.quantity} guests` : ''}{' '}
              <span style={{ fontSize: '12px', color: g.attendance === 'checked_in' ? '#6EE7B7' : g.attendance === 'no_show' ? '#FCA5A5' : 'rgba(255,255,255,0.45)' }}>
                {g.attendance === 'checked_in' ? 'checked in' : g.attendance === 'no_show' ? 'no-show' : 'not checked in'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
              {GUEST_TAGS.map((t) => {
                const on = g.tags.includes(t.key)
                return (
                  <button key={t.key} type="button" disabled={ro} onClick={() => setGuest(i, { tags: on ? g.tags.filter((x: string) => x !== t.key) : [...g.tags, t.key] })}
                    style={{ fontSize: '12px', padding: '5px 9px', borderRadius: '999px', cursor: ro ? 'default' : 'pointer', border: `1px solid ${on ? '#EA003A' : 'rgba(255,255,255,0.15)'}`, background: on ? 'rgba(234,0,58,0.18)' : 'transparent', color: '#fff' }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
            {g.tags.includes('travelling') && (
              <input value={g.nextStop} disabled={ro} onChange={(e) => setGuest(i, { nextStop: e.target.value })} placeholder="Next stop (e.g. Phuket, Vietnam)" maxLength={120} style={{ ...box, marginBottom: '6px' }} />
            )}
            <textarea rows={2} value={g.comment} disabled={ro} onChange={(e) => setGuest(i, { comment: e.target.value })} placeholder="Comment (optional)" maxLength={1000} style={box} />
          </div>
        ))}
      </div>

      <div style={card}>
        <p style={head}>Venues</p>
        {r.venues.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No route was set for this night.</p>}
        {r.venues.map((v: any, i: number) => (
          <div key={v.venue} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{i + 1}. {v.venue}</div>
            <textarea rows={2} value={v.comment} disabled={ro} onChange={(e) => update({ ...r, venues: r.venues.map((x: any, n: number) => (n === i ? { ...x, comment: e.target.value } : x)) })} placeholder="How was the vibe here? Crowd, music, door, service…" maxLength={1000} style={box} />
          </div>
        ))}
      </div>

      <div style={card}>
        <p style={head}>Incidents</p>
        {r.incidents.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>No incidents. Add one only if something happened — the owner is notified.</p>}
        {r.incidents.map((inc: any, i: number) => {
          const set = (patch: any) => update({ ...r, incidents: r.incidents.map((x: any, n: number) => (n === i ? { ...x, ...patch } : x)) })
          return (
            <div key={i} style={{ display: 'grid', gap: '6px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <select value={inc.type} disabled={ro} onChange={(e) => set({ type: e.target.value })} style={{ ...box, height: '42px' }}>
                {INCIDENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <textarea rows={3} value={inc.what} disabled={ro} onChange={(e) => set({ what: e.target.value })} placeholder="What happened?" style={box} />
              <textarea rows={2} value={inc.action} disabled={ro} onChange={(e) => set({ action: e.target.value })} placeholder="What did you do?" style={box} />
              {!ro && <button type="button" onClick={() => update({ ...r, incidents: r.incidents.filter((_: any, n: number) => n !== i) })} style={{ justifySelf: 'start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px', padding: 0 }}>Remove</button>}
            </div>
          )
        })}
        {!ro && <button type="button" onClick={() => update({ ...r, incidents: [...r.incidents, { type: 'other', what: '', action: '' }] })} style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>+ Add incident</button>}
      </div>

      {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '13px' }}>{error}</p>}
      {!ro && (
        <button onClick={submit} disabled={busy} style={{ width: '100%', height: '48px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Submitting…' : 'Submit report'}
        </button>
      )}
    </div>
  )
}
