'use client'

import { useState } from 'react'
import { BCC_NIGHT_TYPES, type BccNightType } from '@/lib/bccNights'

// "Add a night" on the dashboard calendar (owner/admin; Nov 2026). Opens when
// an empty day is tapped. Bangkok Club Crawl only for now. Guests only see the
// night when "On sale" is ON; OFF keeps it for the team (e.g. OTA bookings).

export function OnSaleToggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none',
        cursor: disabled ? 'default' : 'pointer', padding: 0, fontFamily: 'Inter, sans-serif', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: '40px', height: '22px', borderRadius: '9999px', position: 'relative', transition: 'background 0.15s',
          background: on ? '#059669' : 'rgba(255,255,255,0.18)', flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute', top: '2px', left: on ? '20px' : '2px', width: '18px', height: '18px',
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
          }}
        />
      </span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: on ? '#6EE7B7' : 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
        {on ? 'ON · on sale' : 'OFF · hidden'}
      </span>
    </button>
  )
}

function defaultType(date: string): BccNightType {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return dow === 5 ? 'tgif' : dow === 6 ? 'saturday-signature' : 'club-crawl'
}

const label = { display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }
const input = {
  width: '100%', height: '42px', borderRadius: '8px', padding: '0 12px', boxSizing: 'border-box' as const,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '15px', fontFamily: 'Inter, sans-serif',
}

export default function AddNightPanel({
  date,
  onClose,
  onCreated,
}: {
  date: string
  onClose: () => void
  onCreated: (event: any) => void
}) {
  const [type, setType] = useState<BccNightType>(defaultType(date))
  const [name, setName] = useState('')
  const [price, setPrice] = useState('1200')
  const [time, setTime] = useState('21:30')
  const [capacity, setCapacity] = useState('12')
  const [onSale, setOnSale] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [y, m, d] = date.split('-').map(Number)
  const pretty = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

  async function save() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/dashboard/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type, name, priceThb: Number(price), startTime: time, capacity: Number(capacity), isOpen: onSale }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Could not add the night (${res.status}).`)
      onCreated(json.event)
    } catch (e: any) {
      setError(e.message || 'Connection problem. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="w-full sm:max-w-[420px]"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, background: '#1A0015', borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 200, overflowY: 'auto', fontFamily: 'Inter, sans-serif', color: '#fff' }}
    >
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', margin: '0 0 4px' }}>{pretty}</p>
          <h2 style={{ fontWeight: 600, fontSize: '18px', margin: 0 }}>Add a Club Crawl night</h2>
        </div>
        <button onClick={onClose} aria-label="Close" style={{ height: '36px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gap: '16px' }}>
        <div>
          <span style={label}>Night type</span>
          <select value={type} onChange={(e) => setType(e.target.value as BccNightType)} style={input} disabled={busy}>
            {BCC_NIGHT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {type === 'club-crawl' && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '6px 0 0' }}>Plain night, same code OTA imports use for weekday bookings.</p>
          )}
        </div>

        {type === 'special' && (
          <div>
            <span style={label}>Name guests will see</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Halloween Crawl" maxLength={60} style={input} disabled={busy} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <span style={label}>Price ฿</span>
            <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} style={input} disabled={busy} />
          </div>
          <div>
            <span style={label}>Starts</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={input} disabled={busy} />
          </div>
          <div>
            <span style={label}>Seats</span>
            <input inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))} style={input} disabled={busy} />
          </div>
        </div>

        <div>
          <span style={label}>On sale</span>
          <OnSaleToggle on={onSale} onChange={setOnSale} disabled={busy} />
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '6px 0 0' }}>
            {onSale ? 'Guests can see and book this night on the website.' : 'Hidden from guests. You can still record OTA bookings on it and switch it ON later.'}
          </p>
        </div>

        {error && <p role="alert" style={{ margin: 0, padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(234,0,58,0.5)', background: 'rgba(234,0,58,0.10)', fontSize: '13px' }}>{error}</p>}

        <button
          onClick={save}
          disabled={busy || (type === 'special' && name.trim().length < 2)}
          style={{ height: '48px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)', color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? 'Adding…' : onSale ? 'Add night (on sale)' : 'Add night (hidden)'}
        </button>
      </div>
    </div>
  )
}
