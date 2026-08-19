'use client'

import { useCallback, useEffect, useState } from 'react'
import { WEEKDAY_LABELS } from '@/lib/recurrence'

interface EventRow {
  id: string
  event_date: string
  is_open: boolean
  price_override: number | null
  start_time_override: string | null
  capacity: number | null
  schedule_id: string | null
  night_slug: string
  booking_count: number
}
interface Schedule {
  id: string; freq: string; weekday: number | null
  start_date: string; until_date: string | null; generated_through: string | null; is_active: boolean
}
interface ProductDefaults {
  slug: string; name: string; status: string
  default_price: number | null; default_start_time: string | null
}

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 22px', marginBottom: '16px' } as React.CSSProperties,
  title: { fontWeight: 600, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#EA003A', margin: '0 0 14px' },
  input: { height: '34px', borderRadius: '7px', padding: '0 9px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const },
  btn: { height: '32px', padding: '0 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  btnRed: { background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', border: 'none' } as React.CSSProperties,
  btnDanger: { background: 'rgba(234,0,58,0.12)', color: '#ff6b8a', border: '1px solid rgba(234,0,58,0.25)' } as React.CSSProperties,
  th: { textAlign: 'left' as const, fontWeight: 600, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.38)', padding: '0 10px 8px', whiteSpace: 'nowrap' as const },
  td: { padding: '10px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '13px', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const },
}

const fmt = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

export default function InstancesPanel({ productId }: { productId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [product, setProduct] = useState<ProductDefaults | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [edit, setEdit] = useState({ price: '', time: '', capacity: '' })
  const [addDate, setAddDate] = useState('')
  const [extendUntil, setExtendUntil] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/products/${productId}/events`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setProduct(d.product); setEvents(d.events); setSchedules(d.schedules); setState('ready')
    } catch { setState('error') }
  }, [productId])
  useEffect(() => { load() }, [load])

  async function call(url: string, opts: RequestInit, okText: string) {
    if (busy) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(url, opts)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ ok: false, text: data.error || 'Action failed.' }); return false }
      setMsg({ ok: true, text: okText }); await load(); return true
    } catch { setMsg({ ok: false, text: 'Server error. Please try again.' }); return false }
    finally { setBusy(false) }
  }

  const toggleOpen = (ev: EventRow) =>
    call(`/api/admin/events/${ev.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isOpen: !ev.is_open }) },
      ev.is_open ? `Closed ${ev.event_date}` : `Reopened ${ev.event_date}`)

  function startEdit(ev: EventRow) {
    setEditId(ev.id)
    setEdit({ price: ev.price_override?.toString() ?? '', time: hhmm(ev.start_time_override) ?? '', capacity: ev.capacity?.toString() ?? '' })
    setMsg(null)
  }
  const saveEdit = (ev: EventRow) =>
    call(`/api/admin/events/${ev.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceOverride: edit.price === '' ? null : Number(edit.price),
        startTimeOverride: edit.time === '' ? null : edit.time,
        capacity: edit.capacity === '' ? null : Number(edit.capacity),
      }),
    }, `Updated ${ev.event_date}`).then((ok) => { if (ok) setEditId(null) })

  async function del(ev: EventRow) {
    if (!confirm(`Permanently delete ${ev.event_date}? This can't be undone.`)) return
    call(`/api/admin/events/${ev.id}`, { method: 'DELETE' }, `Deleted ${ev.event_date}`)
  }

  const add = () => {
    if (!addDate) return
    call(`/api/admin/products/${productId}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: addDate }) }, `Added ${addDate}`).then((ok) => { if (ok) setAddDate('') })
  }
  const extend = (sc: Schedule) =>
    call(`/api/admin/schedules/${sc.id}/extend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extendUntil[sc.id] ? { untilDate: extendUntil[sc.id] } : {}) }, 'Schedule extended')

  if (state === 'loading') return <div style={S.card}><p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading instances…</p></div>
  if (state === 'error') return <div style={S.card}><p style={{ color: '#EA003A' }}>Could not load instances.</p></div>

  const priceCell = (ev: EventRow) => ev.price_override != null
    ? <span style={{ color: '#FFC400' }}>฿{ev.price_override.toLocaleString()} <span style={{ fontSize: '10px' }}>override</span></span>
    : <span style={{ color: 'rgba(255,255,255,0.5)' }}>{product?.default_price != null ? `฿${product.default_price.toLocaleString()}` : '—'}</span>
  const timeCell = (ev: EventRow) => ev.start_time_override
    ? <span style={{ color: '#FFC400' }}>{hhmm(ev.start_time_override)} <span style={{ fontSize: '10px' }}>override</span></span>
    : <span style={{ color: 'rgba(255,255,255,0.5)' }}>{hhmm(product?.default_start_time ?? null) ?? '—'}</span>

  return (
    <div style={S.card}>
      <p style={S.title}>Event instances · {events.length}</p>

      {msg && (
        <div style={{ margin: '0 0 12px', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', background: msg.ok ? 'rgba(52,199,89,0.10)' : 'rgba(234,0,58,0.10)', border: `1px solid ${msg.ok ? 'rgba(52,199,89,0.3)' : 'rgba(234,0,58,0.3)'}`, color: msg.ok ? '#8ff0a6' : '#ff6b8a' }}>
          {msg.text}
        </div>
      )}

      {/* schedules + extend */}
      {schedules.map((sc) => (
        <div key={sc.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', flex: '1 1 220px' }}>
            {sc.freq === 'weekly' ? `Weekly · ${WEEKDAY_LABELS[sc.weekday ?? 0]}` : 'One-time'} · through {sc.generated_through ?? '—'}
          </span>
          {sc.freq === 'weekly' && (
            <>
              <input style={{ ...S.input }} type="date" value={extendUntil[sc.id] ?? ''} min={sc.generated_through ?? undefined} onChange={(e) => setExtendUntil((m) => ({ ...m, [sc.id]: e.target.value }))} />
              <button style={{ ...S.btn }} disabled={busy} onClick={() => extend(sc)}>Extend{extendUntil[sc.id] ? '' : ' +12w'}</button>
            </>
          )}
        </div>
      ))}

      {/* add one-off */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
        <input style={{ ...S.input }} type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
        <button style={{ ...S.btn }} disabled={busy || !addDate} onClick={add}>+ Add date</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={S.th}>Date</th><th style={S.th}>Status</th><th style={S.th}>Price</th>
            <th style={S.th}>Start</th><th style={S.th}>Capacity</th><th style={S.th}>Bkgs</th><th style={S.th}>Actions</th>
          </tr></thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td style={S.td}>{fmt(ev.event_date)} <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>{ev.event_date.slice(0, 4)}</span></td>
                <td style={S.td}>
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', background: ev.is_open ? 'rgba(52,199,89,0.14)' : 'rgba(255,255,255,0.08)', color: ev.is_open ? '#34C759' : 'rgba(255,255,255,0.5)' }}>{ev.is_open ? 'Open' : 'Closed'}</span>
                </td>
                {editId === ev.id ? (
                  <>
                    <td style={S.td}><input style={{ ...S.input, width: '80px' }} type="number" min="1" placeholder="default" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></td>
                    <td style={S.td}><input style={{ ...S.input, width: '90px' }} type="time" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} /></td>
                    <td style={S.td}><input style={{ ...S.input, width: '70px' }} type="number" min="1" placeholder="—" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></td>
                    <td style={S.td}>{ev.booking_count}</td>
                    <td style={S.td}>
                      <button style={{ ...S.btn, ...S.btnRed, marginRight: '6px' }} disabled={busy} onClick={() => saveEdit(ev)}>Save</button>
                      <button style={S.btn} disabled={busy} onClick={() => setEditId(null)}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={S.td}>{priceCell(ev)}</td>
                    <td style={S.td}>{timeCell(ev)}</td>
                    <td style={S.td}>{ev.capacity ?? <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>}</td>
                    <td style={S.td}>{ev.booking_count}</td>
                    <td style={{ ...S.td, display: 'flex', gap: '6px' }}>
                      <button style={S.btn} disabled={busy} onClick={() => toggleOpen(ev)}>{ev.is_open ? 'Close' : 'Reopen'}</button>
                      <button style={S.btn} disabled={busy} onClick={() => startEdit(ev)}>Edit</button>
                      <button style={{ ...S.btn, ...S.btnDanger }} disabled={busy} onClick={() => del(ev)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {events.length === 0 && <tr><td style={S.td} colSpan={7}><span style={{ color: 'rgba(255,255,255,0.5)' }}>No instances yet.</span></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
