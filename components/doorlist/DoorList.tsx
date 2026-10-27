'use client'

import { useEffect, useMemo, useState } from 'react'
import { QrCode, ChevronDown, Check, Search } from 'lucide-react'
import type { AttendanceStatus, DoorGuest } from '@/lib/doorList'

// Colors are passed in so the same list renders in the Operator shell (CSS
// variable tokens) and in the dark Host view (plain colors).
export interface DoorListTheme {
  elevated: string
  border: string
  text: string
  muted: string
  faint: string
  accent: string
  accentText: string
  green: string
  greenSoft: string
  blue: string
  blueSoft: string
  red: string
  redSoft: string
  chipBg: string
  radius: string
}

const SOURCE_LABEL: Record<string, string> = {
  website: 'Direct · QR ticket',
  airbnb: 'Airbnb',
  getyourguide: 'GetYourGuide',
  gyg: 'GetYourGuide',
  viator: 'Viator',
  klook: 'Klook',
  eventbrite: 'Eventbrite',
  manual: 'Manual',
}

const sourceLabel = (s: string) => SOURCE_LABEL[s?.toLowerCase()] ?? s

type Filter = 'all' | 'pending' | 'in'

export default function DoorList({
  guests,
  theme: T,
  scanHref,
  onChanged,
}: {
  guests: DoorGuest[]
  theme: DoorListTheme
  scanHref: string
  // Called after a successful save so the page can refresh its own data.
  onChanged?: () => void
}) {
  const [rows, setRows] = useState(guests)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setRows(guests), [guests])

  const key = (g: DoorGuest) => `${g.table}-${g.id}`
  const total = rows.reduce((s, g) => s + g.quantity, 0)
  const checkedIn = rows.filter((g) => g.status === 'checked_in').reduce((s, g) => s + g.quantity, 0)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((g) => {
      if (filter === 'pending' && g.status === 'checked_in') return false
      if (filter === 'in' && g.status !== 'checked_in') return false
      if (!q) return true
      return [g.name, g.email, g.ref, sourceLabel(g.source), ...g.attendeeNames]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [rows, filter, query])

  async function setStatus(g: DoorGuest, status: AttendanceStatus) {
    if (status === g.status) return
    const prev = g.status
    setError(null)
    setSavingKey(key(g))
    setRows((cur) => cur.map((r) => (key(r) === key(g) ? { ...r, status } : r)))
    try {
      const res = await fetch('/api/update-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: g.table, id: g.id, status }),
      })
      if (!res.ok) throw new Error()
      onChanged?.()
    } catch {
      setRows((cur) => cur.map((r) => (key(r) === key(g) ? { ...r, status: prev } : r)))
      setError(`Could not update ${g.name}. Check your connection and try again.`)
    } finally {
      setSavingKey(null)
    }
  }

  const statusStyle = (s: AttendanceStatus) =>
    s === 'checked_in'
      ? { color: T.green, bg: T.greenSoft }
      : s === 'no_show'
        ? { color: T.red, bg: T.redSoft }
        : { color: T.blue, bg: T.blueSoft }

  const detail = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', gap: '10px', fontSize: '12.5px', marginTop: '6px' }}>
      <span style={{ width: '74px', flexShrink: 0, color: T.faint }}>{label}</span>
      <span style={{ color: T.text, minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )

  const filterBtn = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      style={{
        flex: 1, padding: '7px 0', fontSize: '12px', fontWeight: 600, borderRadius: '999px', border: 'none', cursor: 'pointer',
        color: filter === f ? '#fff' : T.muted, background: filter === f ? T.accent : T.chipBg,
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: T.text }}>
          {checkedIn}
          <span style={{ fontSize: '14px', fontWeight: 500, color: T.muted }}> / {total} checked in</span>
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: T.faint }}>{total - checkedIn} to go</p>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: T.chipBg, marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${total ? (checkedIn / total) * 100 : 0}%`, background: T.green, transition: 'width 200ms' }} />
      </div>

      <a
        href={scanHref}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', marginBottom: '12px',
          borderRadius: T.radius, background: T.accent, color: '#fff', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
        }}
      >
        <QrCode size={17} /> Scan QR Code
      </a>

      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: T.faint }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or booking ref"
          style={{
            width: '100%', boxSizing: 'border-box', height: '40px', padding: '0 12px 0 34px', fontSize: '14px',
            borderRadius: T.radius, border: `1px solid ${T.border}`, background: T.elevated, color: T.text, outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {filterBtn('all', `All (${rows.length})`)}
        {filterBtn('pending', 'Not in yet')}
        {filterBtn('in', 'Checked in')}
      </div>

      {error && <p style={{ fontSize: '12.5px', color: T.red, margin: '0 0 10px' }}>{error}</p>}
      {rows.length === 0 && <p style={{ fontSize: '13px', color: T.faint }}>No bookings for this night yet.</p>}
      {rows.length > 0 && visible.length === 0 && <p style={{ fontSize: '13px', color: T.faint }}>No guests match.</p>}

      {visible.map((g) => {
        const k = key(g)
        const open = openKey === k
        const st = statusStyle(g.status)
        return (
          <div key={k} style={{ marginBottom: '8px', background: T.elevated, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 12px 12px 14px' }}>
              <button
                onClick={() => setOpenKey(open ? null : k)}
                aria-expanded={open}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: T.text }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14.5px', fontWeight: 600, overflowWrap: 'anywhere' }}>{g.name}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: T.muted, marginTop: '2px' }}>
                    {g.quantity} guest{g.quantity === 1 ? '' : 's'} · {sourceLabel(g.source)}
                  </span>
                </span>
                <ChevronDown size={16} color={T.faint} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
              </button>

              {g.status === 'checked_in' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, padding: '9px 12px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, color: st.color, background: st.bg }}>
                  <Check size={14} /> In
                </span>
              ) : (
                <button
                  disabled={savingKey === k}
                  onClick={() => setStatus(g, 'checked_in')}
                  style={{
                    flexShrink: 0, padding: '10px 16px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                    color: g.status === 'no_show' ? T.red : '#fff', background: g.status === 'no_show' ? T.redSoft : T.accent, opacity: savingKey === k ? 0.6 : 1,
                  }}
                >
                  {g.status === 'no_show' ? 'No-show · Check in' : 'Check in'}
                </button>
              )}
            </div>

            {open && (
              <div style={{ borderTop: `1px solid ${T.border}`, padding: '8px 14px 14px' }}>
                {detail('Booked via', sourceLabel(g.source))}
                {g.ref && detail('Booking ref', g.ref)}
                {g.quantity > 1 && detail('Group', `${g.quantity} guests, checking in marks all ${g.quantity}`)}
                {g.attendeeNames.length > 1 && detail('Names', g.attendeeNames.map((n, i) => `${i + 1}. ${n}`).join(', '))}
                {g.email && detail('Email', <a href={`mailto:${g.email}`} style={{ color: T.accentText }}>{g.email}</a>)}
                {g.phone &&
                  detail(
                    'Phone',
                    <span>
                      <a href={`tel:${g.phone.replace(/\s/g, '')}`} style={{ color: T.accentText }}>{g.phone}</a>
                      {' · '}
                      <a href={`https://wa.me/${g.phone.replace(/\D/g, '')}`} style={{ color: T.accentText }}>WhatsApp</a>
                    </span>
                  )}
                {g.notes && detail('Notes', g.notes.replace(/\s*\[halloween-confirmation-sent [^\]]+\]/, ''))}
                {!g.email && !g.phone && detail('Contact', <span style={{ color: T.faint }}>No contact details on file</span>)}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {(['expected', 'checked_in', 'no_show'] as AttendanceStatus[]).map((s) => (
                    <button
                      key={s}
                      disabled={savingKey === k}
                      onClick={() => setStatus(g, s)}
                      style={{
                        flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer',
                        border: `1px solid ${g.status === s ? statusStyle(s).color : T.border}`,
                        color: g.status === s ? statusStyle(s).color : T.muted,
                        background: g.status === s ? statusStyle(s).bg : 'transparent',
                      }}
                    >
                      {s === 'expected' ? 'Expected' : s === 'checked_in' ? 'Checked in' : 'No-show'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
