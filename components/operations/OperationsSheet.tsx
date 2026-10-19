'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OperationsRow } from '@/lib/operations/report'

// Shared Operations Sheet UI. Rendered by the BCC /dashboard "Operations"
// tab and the BNT /operator/manage/operations page (same codebase, both
// domains), reading /api/admin/dashboard/operations. Each host page passes
// its own palette so it matches the surrounding shell.

export interface OperationsPalette {
  text: string
  muted: string
  faint: string
  card: string
  border: string
  inputBg: string
  accent: string
  accentText: string
  green: string
  amber: string
  red: string
}

const VERDICTS = ['Pending', 'Pre-confirmation', 'Operation Confirmed', 'Cancelled / Rescheduled', 'Completed', 'Reviewed']
const CATEGORY_LABEL: Record<string, string> = { van: 'Van', host_pay: 'Host pay', drinks: 'Drinks', cover_charge: 'Cover charge', extra: 'Extra' }
const ATTENDANCE_LABEL: Record<string, string> = { expected: 'Expected', checked_in: 'Checked in', no_show: 'No-show' }

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const baht = (n: number) => `฿${Math.round(n).toLocaleString()}`

type Preset = 'this_month' | 'last_month' | 'last_30' | 'next_30' | 'custom'
function presetRange(p: Exclude<Preset, 'custom'>): [string, string] {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  if (p === 'this_month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))]
  if (p === 'last_month') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]
  if (p === 'last_30') return [iso(new Date(y, m, now.getDate() - 30)), iso(now)]
  return [iso(now), iso(new Date(y, m, now.getDate() + 30))]
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function OperationsSheet({ palette: P, eventHref }: { palette: OperationsPalette; eventHref?: (row: OperationsRow) => string }) {
  const [preset, setPreset] = useState<Preset>('this_month')
  const [[start, end], setRange] = useState<[string, string]>(() => presetRange('this_month'))
  const [rows, setRows] = useState<OperationsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [host, setHost] = useState('')
  const [night, setNight] = useState('')
  const [verdict, setVerdict] = useState('')
  const [hostPaid, setHostPaid] = useState<'' | 'paid' | 'unpaid'>('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/dashboard/operations?start=${start}&end=${end}`)
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(data.error || res.statusText)
      setRows(data.rows || [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => { load() }, [load])

  const hosts = useMemo(() => Array.from(new Set(rows.map((r) => r.host).filter(Boolean) as string[])).sort(), [rows])
  const nights = useMemo(() => Array.from(new Set(rows.map((r) => r.nightName))).sort(), [rows])

  const filtered = useMemo(() => rows.filter((r) =>
    (!host || (host === '__none' ? !r.host : r.host === host)) &&
    (!night || r.nightName === night) &&
    (!verdict || r.verdict === verdict) &&
    (!hostPaid || (hostPaid === 'paid' ? r.hostPaymentStatus === 'Paid' : r.hostPaymentStatus !== 'Paid'))
  ), [rows, host, night, verdict, hostPaid])

  const totals = useMemo(() => filtered.reduce((t, r) => ({
    events: t.events + 1,
    guests: t.guests + r.guestsCheckedIn,
    booked: t.booked + r.guestsBooked,
    revenue: t.revenue + r.revenueTotal,
    expenses: t.expenses + r.otherExpenses,
    hostCost: t.hostCost + r.hostCost,
    hostOwed: t.hostOwed + (r.hostPaymentStatus === 'Paid' ? 0 : r.hostCost),
    profit: t.profit + r.profit,
  }), { events: 0, guests: 0, booked: 0, revenue: 0, expenses: 0, hostCost: 0, hostOwed: 0, profit: 0 }), [filtered])

  function choosePreset(p: Preset) {
    setPreset(p)
    if (p !== 'custom') setRange(presetRange(p))
  }

  function exportCsv() {
    const header = ['Date', 'Night', 'Status', 'Host', 'Host fee', 'Host paid', 'Meet-up', 'Route', 'Booked', 'Checked in', 'No-show', 'Website revenue', 'OTA/direct revenue', 'Total revenue', 'Expenses (excl. host)', 'Profit', 'Guests']
    const lines = filtered.map((r) => [
      r.eventDate, r.nightName, r.verdict, r.host ?? '', r.hostCost, r.hostPaymentStatus, r.meetUpLocation ?? '', r.route.join(' > '),
      r.guestsBooked, r.guestsCheckedIn, r.guestsNoShow, r.revenueWebsite, r.revenueOta, r.revenueTotal, r.otherExpenses, r.profit,
      r.guests.map((g) => `${g.name} x${g.quantity} (${g.source}, ${ATTENDANCE_LABEL[g.attendance] ?? g.attendance})`).join('; '),
    ].map(csvCell).join(','))
    const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `operations-${start}-to-${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const input: React.CSSProperties = { height: '36px', borderRadius: '8px', padding: '0 10px', background: P.inputBg, border: `1px solid ${P.border}`, color: P.text, fontFamily: 'inherit', fontSize: '13px', outline: 'none', minWidth: 0, width: '100%' }
  const label: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: P.faint, marginBottom: '5px' }
  const card: React.CSSProperties = { background: P.card, border: `1px solid ${P.border}`, borderRadius: '12px' }
  const chip = (color: string): React.CSSProperties => ({ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color, border: `1px solid ${P.border}`, whiteSpace: 'nowrap' })
  const verdictColor = (v: string) => v === 'Operation Confirmed' || v === 'Completed' || v === 'Reviewed' ? P.green : v === 'Pre-confirmation' ? P.amber : v.startsWith('Cancelled') ? P.red : P.muted

  return (
    <div style={{ color: P.text }}>
      {/* Filters */}
      <div style={{ ...card, padding: '14px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {([['this_month', 'This month'], ['last_month', 'Last month'], ['last_30', 'Last 30 days'], ['next_30', 'Next 30 days'], ['custom', 'Custom']] as [Preset, string][]).map(([p, l]) => (
            <button key={p} onClick={() => choosePreset(p)} style={{ height: '30px', padding: '0 12px', borderRadius: '999px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${preset === p ? P.accent : P.border}`, background: preset === p ? P.accent : 'transparent', color: preset === p ? P.accentText : P.muted }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div><label style={label}>From</label><input type="date" value={start} onChange={(e) => { setPreset('custom'); setRange([e.target.value, end]) }} style={input} /></div>
          <div><label style={label}>To</label><input type="date" value={end} onChange={(e) => { setPreset('custom'); setRange([start, e.target.value]) }} style={input} /></div>
          <div><label style={label}>Host</label>
            <select value={host} onChange={(e) => setHost(e.target.value)} style={input}>
              <option value="">All hosts</option>
              {hosts.map((h) => <option key={h} value={h}>{h}</option>)}
              <option value="__none">Unassigned</option>
            </select>
          </div>
          <div><label style={label}>Night</label>
            <select value={night} onChange={(e) => setNight(e.target.value)} style={input}>
              <option value="">All nights</option>
              {nights.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div><label style={label}>Status</label>
            <select value={verdict} onChange={(e) => setVerdict(e.target.value)} style={input}>
              <option value="">All statuses</option>
              {VERDICTS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div><label style={label}>Host pay</label>
            <select value={hostPaid} onChange={(e) => setHostPaid(e.target.value as any)} style={input}>
              <option value="">Any</option>
              <option value="unpaid">Not paid yet</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {[
          ['Events', String(totals.events), `${totals.booked} booked`],
          ['Guests', String(totals.guests), 'checked in'],
          ['Revenue', baht(totals.revenue), 'website + OTA/direct'],
          ['Expenses', baht(totals.expenses), 'excl. host pay'],
          ['Host pay', baht(totals.hostCost), totals.hostOwed ? `${baht(totals.hostOwed)} still owed` : 'all paid'],
          ['Profit', baht(totals.profit), 'after host pay'],
        ].map(([l, v, sub]) => (
          <div key={l} style={{ ...card, padding: '12px' }}>
            <p style={{ ...label, marginBottom: '4px' }}>{l}</p>
            <p style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: l === 'Profit' ? (totals.profit < 0 ? P.red : P.green) : P.text }}>{v}</p>
            <p style={{ fontSize: '11px', color: l === 'Host pay' && totals.hostOwed ? P.amber : P.faint, margin: '2px 0 0' }}>{sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
        <p style={{ fontSize: '12px', color: P.muted, margin: 0 }}>{loading ? 'Loading…' : `${filtered.length} event${filtered.length === 1 ? '' : 's'} · tap a row for guests, route and expenses`}</p>
        <button onClick={exportCsv} disabled={filtered.length === 0} style={{ height: '32px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${P.border}`, background: 'transparent', color: P.text, fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: filtered.length ? 'pointer' : 'default', opacity: filtered.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>Export CSV</button>
      </div>

      {error && <p style={{ fontSize: '13px', color: P.red }}>Couldn't load operations: {error}</p>}
      {!loading && !error && filtered.length === 0 && <p style={{ fontSize: '13px', color: P.faint }}>No events match these filters.</p>}

      {/* Rows */}
      {filtered.map((r) => {
        const open = !!expanded[r.id]
        const dateLabel = new Date(r.eventDate + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
        return (
          <div key={r.id} style={{ ...card, marginBottom: '8px', overflow: 'hidden' }}>
            <button onClick={() => setExpanded((x) => ({ ...x, [r.id]: !open }))} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'transparent', border: 'none', color: P.text, fontFamily: 'inherit', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '11.5px', color: P.muted, margin: 0 }}>{dateLabel}</p>
                  <p style={{ fontSize: '14px', fontWeight: 600, margin: '1px 0 0' }}>{r.nightName}</p>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={chip(verdictColor(r.verdict))}>{r.verdict}</span>
                  <span style={chip(r.host ? P.text : P.faint)}>{r.host ? `Host: ${r.host}` : 'No host'}</span>
                  <span style={{ fontSize: '12px', color: P.faint }}>{open ? '▴' : '▾'}</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: '8px', marginTop: '10px' }}>
                {[
                  ['Guests', `${r.guestsCheckedIn}/${r.guestsBooked}`, P.text],
                  ['Revenue', baht(r.revenueTotal), P.text],
                  ['Expenses', baht(r.otherExpenses), P.text],
                  ['Host pay', r.hostCost ? `${baht(r.hostCost)}${r.hostPaymentStatus === 'Paid' ? ' ✓' : ''}` : '—', r.hostCost && r.hostPaymentStatus !== 'Paid' ? P.amber : P.text],
                  ['Profit', baht(r.profit), r.profit < 0 ? P.red : P.green],
                ].map(([l, v, c]) => (
                  <div key={l}>
                    <p style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: P.faint, margin: 0 }}>{l}</p>
                    <p style={{ fontSize: '13px', fontWeight: 600, margin: '2px 0 0', color: c }}>{v}</p>
                  </div>
                ))}
              </div>
            </button>

            {open && (
              <div style={{ borderTop: `1px solid ${P.border}`, padding: '12px 14px', fontSize: '12.5px' }}>
                <p style={label}>Where we went</p>
                <p style={{ margin: '0 0 4px', color: P.text }}>{r.route.length ? r.route.join(' → ') : <span style={{ color: P.faint }}>No route recorded</span>}</p>
                {r.meetUpLocation && <p style={{ margin: '0 0 4px', color: P.muted }}>Meet-up: {r.meetUpLocation}</p>}
                {r.routeNotes && <p style={{ margin: '0 0 4px', color: P.muted }}>Notes: {r.routeNotes}</p>}

                <p style={{ ...label, marginTop: '12px' }}>Who joined ({r.guestsCheckedIn} checked in · {r.guestsNoShow} no-show)</p>
                {r.guests.length === 0 && <p style={{ margin: 0, color: P.faint }}>No bookings.</p>}
                {r.guests.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '4px 0', borderBottom: `1px solid ${P.border}` }}>
                    <span style={{ minWidth: 0 }}>{g.name} <span style={{ color: P.faint }}>×{g.quantity} · {g.source}</span></span>
                    <span style={{ whiteSpace: 'nowrap', color: g.attendance === 'checked_in' ? P.green : g.attendance === 'no_show' ? P.red : P.muted }}>{ATTENDANCE_LABEL[g.attendance] ?? g.attendance} · {baht(g.paid)}</span>
                  </div>
                ))}

                <p style={{ ...label, marginTop: '12px' }}>Money</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: P.muted }}>Website revenue</span><span>{baht(r.revenueWebsite)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: P.muted }}>OTA / direct revenue</span><span>{baht(r.revenueOta)}</span></div>
                {r.expenses.filter((x) => x.category !== 'host_pay').map((x, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: P.muted }}>{CATEGORY_LABEL[x.category] ?? x.category}{x.description ? ` · ${x.description}` : ''}</span><span style={{ color: P.red }}>−{baht(x.amount)}</span></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: P.muted }}>Host pay{r.host ? ` (${r.host})` : ''} · {r.hostPaymentStatus}</span><span style={{ color: P.red }}>−{baht(r.hostCost)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', fontWeight: 700, borderTop: `1px solid ${P.border}`, marginTop: '4px' }}><span>Profit</span><span style={{ color: r.profit < 0 ? P.red : P.green }}>{baht(r.profit)}</span></div>
                {r.hostPayDuplicate && <p style={{ margin: '8px 0 0', color: P.amber, fontSize: '11.5px' }}>This date has both a host fee and a “host pay” expense. Only the host fee is counted; consider deleting the expense.</p>}
                {eventHref && <a href={eventHref(r)} style={{ display: 'inline-block', marginTop: '10px', color: P.accent, fontWeight: 600, textDecoration: 'none' }}>Open event →</a>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
