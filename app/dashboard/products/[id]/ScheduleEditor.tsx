'use client'

// Stage A correction: mobile-first Schedule + Event Dates.
//
// Replaces the pre-correction InstancesPanel.tsx. Same data, same routes,
// same action semantics — restructured presentation only:
//   - Desktop (>=769px): unchanged — the exact schedules block + add-date
//     control + full sortable table this file always had.
//   - Mobile (<=768px): the top-level tab is now labeled "Schedule" (was
//     "Schedule / Instances" — naming only, no architecture change). Inside
//     it, three screens:
//       1. Summary — read-only recurrence info (Type/Day/Start Date/Start
//          Time/Generate Through) + Extend Schedule, then an Event Dates
//          count card ("80 dates generated, Open 28, Closed 52") with a
//          "Manage Event Dates" button.
//       2. Event Dates list — one compact card per date (no horizontal
//          scroll), each showing date/status/time/price/bookings/capacity
//          at a glance. Tapping a card opens screen 3.
//       3. Edit Event Date — a focused editor for that one event_dates row:
//          Start Time / Price Override / Capacity (bundled into one Save,
//          calling the same PATCH the desktop "Edit" button already used)
//          plus a separate immediate Close/Reopen action and a separate
//          Delete action — identical action boundaries to the desktop table,
//          just not squeezed into table cells.
//
// No new routes. `PATCH /api/admin/events/[id]` already only touches the
// keys present in its request body (see that route's own comment), so
// bundling Start Time + Price + Capacity into one mobile Save is exactly as
// safe as the desktop table's existing "Edit" row — there is no whole-row
// upsert risk here the way there was for product_content in the Content
// editor.

import { useCallback, useEffect, useState } from 'react'
import { WEEKDAY_LABELS } from '@/lib/recurrence'
import { FocusedEditorChrome } from './sections/MobileSectionShell'
import { M } from './sections/styles'

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
  th: { textAlign: 'left' as const, fontWeight: 600, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.42)', padding: '11px 10px 9px', whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0, zIndex: 1, background: '#160A13', borderBottom: '1px solid rgba(255,255,255,0.10)' },
  td: { padding: '10px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '13px', whiteSpace: 'nowrap' as const, verticalAlign: 'middle' as const },
}

const fmt = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtLong = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)
const weeksBetween = (fromIso: string, toIso: string): number | null => {
  const from = new Date(fromIso + 'T00:00:00Z').getTime()
  const to = new Date(toIso + 'T00:00:00Z').getTime()
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null
  return Math.round((to - from) / (7 * 86_400_000))
}

export default function ScheduleEditor({ productId }: { productId: string }) {
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

  // Mobile-only navigation: which of the 3 screens is showing.
  const [mobileScreen, setMobileScreen] = useState<'summary' | 'list' | 'edit'>('summary')
  const [mobileEditId, setMobileEditId] = useState<string | null>(null)
  const [mobileFilter, setMobileFilter] = useState<'all' | 'open' | 'closed'>('all')
  const [showAddDate, setShowAddDate] = useState(false)

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
    if (busy) return false
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
    }, `Updated ${ev.event_date}`)

  async function del(ev: EventRow) {
    if (!confirm(`Permanently delete ${ev.event_date}? This can't be undone.`)) return
    const ok = await call(`/api/admin/events/${ev.id}`, { method: 'DELETE' }, `Deleted ${ev.event_date}`)
    if (ok && mobileEditId === ev.id) { setMobileScreen('list'); setMobileEditId(null) }
  }

  const add = () => {
    if (!addDate) return
    call(`/api/admin/products/${productId}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: addDate }) }, `Added ${addDate}`)
      .then((ok) => { if (ok) { setAddDate(''); setShowAddDate(false) } })
  }
  const extend = (sc: Schedule) =>
    call(`/api/admin/schedules/${sc.id}/extend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extendUntil[sc.id] ? { untilDate: extendUntil[sc.id] } : {}) }, 'Schedule extended')

  if (state === 'loading') return <div style={S.card}><p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading schedule…</p></div>
  if (state === 'error') return <div style={S.card}><p style={{ color: '#EA003A' }}>Could not load schedule.</p></div>

  const priceCell = (ev: EventRow) => ev.price_override != null
    ? <span style={{ color: '#FFC400' }}>฿{ev.price_override.toLocaleString()} <span style={{ fontSize: '10px' }}>override</span></span>
    : <span style={{ color: 'rgba(255,255,255,0.5)' }}>{product?.default_price != null ? `฿${product.default_price.toLocaleString()}` : '—'}</span>
  const timeCell = (ev: EventRow) => ev.start_time_override
    ? <span style={{ color: '#FFC400' }}>{hhmm(ev.start_time_override)} <span style={{ fontSize: '10px' }}>override</span></span>
    : <span style={{ color: 'rgba(255,255,255,0.5)' }}>{hhmm(product?.default_start_time ?? null) ?? '—'}</span>

  const openCount = events.filter((e) => e.is_open).length
  const closedCount = events.length - openCount
  const mobileEditEv = mobileEditId ? events.find((e) => e.id === mobileEditId) ?? null : null
  const filteredEvents = events.filter((e) => (mobileFilter === 'all' ? true : mobileFilter === 'open' ? e.is_open : !e.is_open))

  return (
    <div>
      {msg && (
        <div style={{ margin: '0 0 12px', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', background: msg.ok ? 'rgba(52,199,89,0.10)' : 'rgba(234,0,58,0.10)', border: `1px solid ${msg.ok ? 'rgba(52,199,89,0.3)' : 'rgba(234,0,58,0.3)'}`, color: msg.ok ? '#8ff0a6' : '#ff6b8a' }}>
          {msg.text}
        </div>
      )}

      {/* ── Desktop: unchanged from before this correction ── */}
      <div className="pe-desktop-only">
        <div style={S.card}>
          <p style={S.title}>Event instances · {events.length}</p>

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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
            <input style={{ ...S.input }} type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
            <button style={{ ...S.btn }} disabled={busy || !addDate} onClick={add}>+ Add date</button>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '560px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <table style={{ width: 'auto', minWidth: '760px', borderCollapse: 'collapse' }}>
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
                          <button style={{ ...S.btn, ...S.btnRed, marginRight: '6px' }} disabled={busy} onClick={() => saveEdit(ev).then((ok) => { if (ok) setEditId(null) })}>Save</button>
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
      </div>

      {/* ── Mobile: Summary → Event Dates list → Edit Event Date ── */}
      <div className="pe-mobile-only">
        {mobileScreen === 'summary' && (
          <>
            <p style={M.groupHeading}>Schedule</p>
            <div style={M.quickFactsCard}>
              {schedules.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>No schedule configured yet.</p>}
              {schedules.map((sc) => {
                const weeks = sc.freq === 'weekly' ? weeksBetween(sc.start_date, sc.generated_through ?? sc.start_date) : null
                return (
                  <div key={sc.id} style={{ marginBottom: '14px' }}>
                    <div style={M.quickFactsGrid}>
                      <div>
                        <p style={M.quickFactItemLabel}>Type</p>
                        <p style={M.quickFactItemValue}>{sc.freq === 'weekly' ? 'Weekly (Recurring)' : 'One-time'}</p>
                      </div>
                      {sc.freq === 'weekly' && (
                        <div>
                          <p style={M.quickFactItemLabel}>Day</p>
                          <p style={M.quickFactItemValue}>Every {WEEKDAY_LABELS[sc.weekday ?? 0]}</p>
                        </div>
                      )}
                      <div>
                        <p style={M.quickFactItemLabel}>Start Date</p>
                        <p style={M.quickFactItemValue}>{fmtLong(sc.start_date)}</p>
                      </div>
                      {product?.default_start_time && (
                        <div>
                          <p style={M.quickFactItemLabel}>Start Time</p>
                          <p style={M.quickFactItemValue}>{hhmm(product.default_start_time)}</p>
                        </div>
                      )}
                      <div>
                        <p style={M.quickFactItemLabel}>Generate Through</p>
                        <p style={M.quickFactItemValue}>
                          {sc.generated_through ? `${weeks != null ? `${weeks} weeks (` : ''}until ${fmtLong(sc.generated_through)}${weeks != null ? ')' : ''}` : '—'}
                        </p>
                      </div>
                    </div>
                    {sc.freq === 'weekly' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
                        <input style={{ ...S.input, flex: '1 1 140px' }} type="date" value={extendUntil[sc.id] ?? ''} min={sc.generated_through ?? undefined} onChange={(e) => setExtendUntil((m) => ({ ...m, [sc.id]: e.target.value }))} />
                        <button style={{ ...M.saveBtn(busy), flex: '0 0 auto' }} disabled={busy} onClick={() => extend(sc)}>Extend Schedule</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p style={M.groupHeading}>Event Dates</p>
            <button type="button" style={{ ...M.listCard, ...M.row(), width: '100%', display: 'block' }} onClick={() => setMobileScreen('list')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={M.rowLabel}>{events.length} date{events.length === 1 ? '' : 's'} generated</span>
                <span style={M.chevron}>›</span>
              </div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#34C759' }}>● Open {openCount}</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>● Closed {closedCount}</span>
              </div>
            </button>
          </>
        )}

        {mobileScreen === 'list' && (
          <FocusedEditorChrome title="Event Dates" onBack={() => setMobileScreen('summary')} showSave={true} saveLabel="+" onSave={() => setShowAddDate((v) => !v)}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {(['all', 'open', 'closed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  style={{ ...S.btn, ...(mobileFilter === f ? S.btnRed : {}) }}
                  onClick={() => setMobileFilter(f)}
                >
                  {f === 'all' ? `All ${events.length}` : f === 'open' ? `Open ${openCount}` : `Closed ${closedCount}`}
                </button>
              ))}
            </div>

            {showAddDate && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input style={{ ...S.input, flex: 1 }} type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
                <button style={{ ...S.btn, ...S.btnRed }} disabled={busy || !addDate} onClick={add}>Add</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  style={{ ...S.card, marginBottom: 0, textAlign: 'left', width: '100%', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  onClick={() => { setMobileEditId(ev.id); setMobileScreen('edit') }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>{fmt(ev.event_date)} {ev.event_date.slice(0, 4)}</p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
                        🕐 {timeCell(ev)} · 💰 {priceCell(ev)}
                      </p>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '4px 0 0' }}>
                        {ev.booking_count} booking{ev.booking_count === 1 ? '' : 's'}{ev.capacity != null ? ` · capacity ${ev.capacity}` : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', background: ev.is_open ? 'rgba(52,199,89,0.14)' : 'rgba(255,255,255,0.08)', color: ev.is_open ? '#34C759' : 'rgba(255,255,255,0.5)' }}>{ev.is_open ? 'Open' : 'Closed'}</span>
                      <span style={M.chevron}>›</span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredEvents.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No dates in this filter.</p>}
            </div>
          </FocusedEditorChrome>
        )}

        {mobileScreen === 'edit' && mobileEditEv && (
          <FocusedEditorChrome
            title="Edit Event Date"
            backLabel="Cancel"
            onBack={() => { setMobileScreen('list'); setMobileEditId(null) }}
            showSave={false}
          >
            <div style={S.card}>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>{fmtLong(mobileEditEv.event_date)}</p>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '5px', background: mobileEditEv.is_open ? 'rgba(52,199,89,0.14)' : 'rgba(255,255,255,0.08)', color: mobileEditEv.is_open ? '#34C759' : 'rgba(255,255,255,0.5)' }}>
                {mobileEditEv.is_open ? 'Open' : 'Closed'}
              </span>

              <div style={{ marginTop: '18px' }}>
                <p style={{ ...M.quickFactItemLabel, marginBottom: '6px' }}>Start Time (override)</p>
                <input
                  style={S.input}
                  type="time"
                  value={editId === mobileEditEv.id ? edit.time : hhmm(mobileEditEv.start_time_override) ?? ''}
                  placeholder={hhmm(product?.default_start_time ?? null) ?? undefined}
                  onChange={(e) => { if (editId !== mobileEditEv.id) startEdit(mobileEditEv); setEdit((v) => ({ ...v, time: e.target.value })) }}
                />
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>Leave empty to use the product default ({hhmm(product?.default_start_time ?? null) ?? '—'}).</p>
              </div>

              <div style={{ marginTop: '16px' }}>
                <p style={{ ...M.quickFactItemLabel, marginBottom: '6px' }}>Price Override (THB)</p>
                <input
                  style={S.input}
                  type="number"
                  min={1}
                  value={editId === mobileEditEv.id ? edit.price : mobileEditEv.price_override?.toString() ?? ''}
                  placeholder={product?.default_price != null ? `${product.default_price}` : undefined}
                  onChange={(e) => { if (editId !== mobileEditEv.id) startEdit(mobileEditEv); setEdit((v) => ({ ...v, price: e.target.value })) }}
                />
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>Leave empty to use the default price.</p>
              </div>

              <div style={{ marginTop: '16px' }}>
                <p style={{ ...M.quickFactItemLabel, marginBottom: '6px' }}>Capacity</p>
                <input
                  style={S.input}
                  type="number"
                  min={1}
                  value={editId === mobileEditEv.id ? edit.capacity : mobileEditEv.capacity?.toString() ?? ''}
                  placeholder="Unlimited"
                  onChange={(e) => { if (editId !== mobileEditEv.id) startEdit(mobileEditEv); setEdit((v) => ({ ...v, capacity: e.target.value })) }}
                />
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>Leave empty for unlimited.</p>
              </div>

              <div style={{ marginTop: '16px' }}>
                <p style={{ ...M.quickFactItemLabel, marginBottom: '6px' }}>Bookings</p>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>{mobileEditEv.booking_count} (view only)</p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                <button
                  style={{ ...M.saveBtn(busy), flex: 1 }}
                  disabled={busy}
                  onClick={() => saveEdit(mobileEditEv).then((ok) => { if (ok) setEditId(null) })}
                >
                  {busy ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
              <div style={{ marginTop: '10px' }}>
                <button style={{ ...S.btn, width: '100%' }} disabled={busy} onClick={() => toggleOpen(mobileEditEv)}>
                  {mobileEditEv.is_open ? 'Close' : 'Reopen (Open for Booking)'}
                </button>
              </div>
              <div style={{ marginTop: '10px' }}>
                <button style={{ ...S.btn, ...S.btnDanger, width: '100%' }} disabled={busy} onClick={() => del(mobileEditEv)}>
                  Delete Date
                </button>
              </div>
            </div>
          </FocusedEditorChrome>
        )}
      </div>

      <style>{`
        .pe-mobile-only { display: none; }
        @media (max-width: 768px) {
          .pe-desktop-only { display: none; }
          .pe-mobile-only { display: block; }
        }
      `}</style>
    </div>
  )
}
