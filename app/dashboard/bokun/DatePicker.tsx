'use client'

import { useState } from 'react'

// Small month calendar for choosing the night a guest joins (Bókun screen).
// Every date is selectable. A dot marks a date that already has guests on the
// dashboard (green dot = night ON, white = OFF). The booked date is outlined.

export interface CalNight { date: string; name: string; isOpen: boolean; guests: number }

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export default function DatePicker({ value, booked, nights, onPick }: { value: string; booked: string; nights: CalNight[]; onPick: (date: string) => void }) {
  const [y0, m0] = value.split('-').map(Number)
  const [ym, setYm] = useState({ y: y0, m: m0 - 1 })
  const byDate = new Map(nights.map((n) => [n.date, n]))
  const first = new Date(Date.UTC(ym.y, ym.m, 1))
  const lead = (first.getUTCDay() + 6) % 7 // Monday first
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })
  const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="w-full max-w-[300px] rounded-lg border border-white/15 bg-black/40 p-2 text-xs">
      <div className="mb-1 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="px-2 py-1 text-white/70" aria-label="Previous month">‹</button>
        <span className="font-semibold">{title}</span>
        <button type="button" onClick={() => shift(1)} className="px-2 py-1 text-white/70" aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-white/40">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-0.5 text-center">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const date = iso(ym.y, ym.m, d)
          const n = byDate.get(date)
          const selected = date === value
          return (
            <button key={i} type="button" onClick={() => onPick(date)} title={n ? `${n.name} · ${n.isOpen ? 'ON' : 'OFF'} · ${n.guests} guest(s)` : 'No night yet — created OFF'}
              className={`relative flex h-8 flex-col items-center justify-center rounded ${selected ? 'bg-accent-primary font-semibold text-white' : n ? 'text-white hover:bg-white/10' : 'text-white/40 hover:bg-white/10'} ${date === booked && !selected ? 'ring-1 ring-sky-300' : ''}`}>
              {d}
              {n && n.guests > 0 && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${n.isOpen ? 'bg-emerald-400' : 'bg-white'}`} />}
            </button>
          )
        })}
      </div>
      <p className="mt-1 text-[10px] text-white/40">● has guests (green = on sale) · outlined = booked date · grey = no night yet</p>
    </div>
  )
}
