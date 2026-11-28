'use client'

import { useState } from 'react'

// Month calendar of dates the guest can move to: ● nights already running
// (on sale / confirmed), plain = Fridays and Saturdays we can set up.
export default function MoveCalendar({ dates, value, onPick }: { dates: any[]; value: string; onPick: (d: string) => void }) {
  const byDate = new Map(dates.map((x) => [x.date, x]))
  const first = dates[0]?.date ?? new Date().toISOString().slice(0, 10)
  const [ym, setYm] = useState(() => { const [y, m] = (value || first).split('-').map(Number); return { y, m: m - 1 } })
  const start = new Date(Date.UTC(ym.y, ym.m, 1))
  const lead = (start.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })
  const last = dates[dates.length - 1]?.date ?? first
  const canPrev = `${ym.y}-${pad(ym.m + 1)}` > first.slice(0, 7)
  const canNext = `${ym.y}-${pad(ym.m + 1)}` < last.slice(0, 7)
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '12px', padding: '10px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', opacity: canPrev ? 1 : 0.25, cursor: 'pointer', padding: '4px 10px' }} aria-label="Previous month">‹</button>
        <b style={{ fontSize: '15px' }}>{start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', opacity: canNext ? 1 : 0.25, cursor: 'pointer', padding: '4px 10px' }} aria-label="Next month">›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginTop: '4px' }}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const date = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`
          const x = byDate.get(date)
          const sel = date === value
          return (
            <button key={i} type="button" disabled={!x} onClick={() => x && onPick(date)}
              style={{ position: 'relative', height: '40px', borderRadius: '10px', border: 'none', fontSize: '14px', fontFamily: 'inherit', cursor: x ? 'pointer' : 'default',
                background: sel ? 'linear-gradient(135deg,#EA003A,#820065)' : x ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: x ? '#fff' : 'rgba(255,255,255,0.22)', fontWeight: x ? 600 : 400 }}>
              {d}
              {x?.kind === 'night' && <span style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', background: sel ? '#fff' : '#EA003A' }} />}
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: '8px 2px 0' }}><span style={{ color: '#EA003A' }}>●</span> night already running · other highlighted dates are weekends we can set up for you</p>
    </div>
  )
}
