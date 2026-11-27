'use client'

import { useEffect, useState } from 'react'

// The guest's own booking page (from the "not enough guests" email). Choose a
// full refund, a move to another date (pick a night or write a preference),
// or credit. The team confirms each choice. Secure personal link, no login.

function pretty(date: string | null) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}
const baht = (n: number) => `฿${Math.round(n ?? 0).toLocaleString()}`
const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px', padding: '16px', marginBottom: '12px' }
const REASON: Record<string, string> = {
  night_short: 'Not enough guests booked this night to run it, so we can’t go ahead. Sorry about that!',
  van2_short: 'Van 2 didn’t reach the 4 guests it needs, so it won’t run — and Van 1 is full. Sorry about that!',
}

// Month calendar of dates the guest can move to: ● nights already running
// (on sale / confirmed), plain = Fridays and Saturdays we can set up.
function MoveCalendar({ dates, value, onPick }: { dates: any[]; value: string; onPick: (d: string) => void }) {
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

export default function MyBookingPage({ params }: { params: { token: string } }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState<'refund' | 'move' | 'credit' | ''>('')
  const [night, setNight] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [booked, setBooked] = useState<string | null>(null)
  useEffect(() => { setBooked(new URLSearchParams(window.location.search).get('booked')) }, [])

  useEffect(() => {
    fetch(`/api/my-booking/${params.token}`, { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return setError(j.error || 'This link is not valid.')
      setD(j)
      if (j.choice) { setChoice(j.choice); setNight(j.preferredDate ?? ''); setNote(j.note ?? '') }
    }).catch(() => setError('Connection problem. Please try again.'))
  }, [params.token])

  async function save() {
    setBusy(true); setError('')
    const res = await fetch(`/api/my-booking/${params.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice, preferredDate: night || null, note }) }).catch(() => null)
    const j = res ? await res.json().catch(() => ({})) : { error: 'Connection problem. Please try again.' }
    setBusy(false)
    if (!res?.ok) return setError(j.error || 'Could not save.')
    setDone(true)
  }

  const opt = (key: 'refund' | 'move' | 'credit', title: string, sub: string) => (
    <button type="button" onClick={() => setChoice(key)} disabled={busy}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
        background: choice === key ? 'rgba(234,0,58,0.16)' : 'transparent', border: `1px solid ${choice === key ? '#EA003A' : 'rgba(255,255,255,0.18)'}` }}>
      <b style={{ fontSize: '15px' }}>{title}</b>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>{sub}</div>
    </button>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#1A0015', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '28px 18px' }}>
      <div style={{ maxWidth: '460px', margin: '0 auto' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', fontWeight: 600, margin: '0 0 6px' }}>Bangkok Club Crawl</p>
        <h1 style={{ fontSize: '22px', margin: '0 0 16px' }}>Your booking</h1>
        {booked && (
          <div style={{ ...card, borderColor: 'rgba(110,231,183,0.5)' }}>
            <b>🎉 You’re booked for {pretty(booked)}!</b>
            <p style={{ fontSize: '14px', margin: '6px 0 0' }}>Paid with your credit. Your ticket is on its way by email — see you on the night.</p>
          </div>
        )}
        {error && !d && <p style={card}>{error}</p>}
        {d && d.booking && (
          <>
            <div style={card}>
              <b style={{ fontSize: '16px' }}>{d.booking.nightName}</b>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>{pretty(d.booking.date)} · {d.booking.quantity} ticket{d.booking.quantity === 1 ? '' : 's'} · {baht(d.booking.totalPaid)}</div>
              <p style={{ fontSize: '14px', margin: '12px 0 0' }}>{REASON[d.reason]}</p>
            </div>

            {d.status === 'resolved' ? (
              <div style={card}>
                <b>✓ All sorted</b>
                <p style={{ fontSize: '14px', margin: '6px 0 0' }}>
                  {d.resolution === 'refunded' ? 'Your full refund is on its way (it can take a few days to show).' : d.resolution === 'moved' ? 'Your booking has been moved — check your email for the new date.' : `Your ${baht(d.booking.totalPaid)} is kept as credit for your next night.`}
                </p>
                {d.credit > 0 && (
                  <>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '8px 0 0' }}>Credit available: <b>{baht(d.credit)}</b>{d.creditExpires ? ` · valid until ${pretty(d.creditExpires.slice(0, 10))}` : ''}. Want it refunded instead? Just reply to our email.</p>
                    <a href={`/book?credit=${params.token}`} style={{ display: 'block', textAlign: 'center', marginTop: '12px', padding: '13px', borderRadius: '12px', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
                      Book with my credit →
                    </a>
                  </>
                )}
              </div>
            ) : done ? (
              <div style={card}>
                <b>Thanks — we’ve got your choice.</b>
                <p style={{ fontSize: '14px', margin: '6px 0 0' }}>We’ll confirm by email shortly. You can change it here until then.</p>
                <button onClick={() => setDone(false)} style={{ marginTop: '10px', background: 'none', border: 'none', color: '#fff', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Change my choice</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', margin: '4px 0 10px' }}>What would you like to do?</p>
                {opt('refund', `Full refund — ${baht(d.booking.totalPaid)}`, 'Back to your card. It can take a few days to show.')}
                {opt('move', 'Move to another date', 'Pick a night below, or tell us what suits you.')}
                {opt('credit', 'Keep it as credit', 'For any future night within 12 months — refundable any time before you use it.')}
                {choice === 'move' && (
                  <div style={{ ...card, marginTop: '4px' }}>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Pick a date</div>
                    <MoveCalendar dates={d.dates} value={night} onPick={setNight} />
                    {night && (() => {
                      const x = d.dates.find((y: any) => y.date === night)
                      return x ? (
                        <p style={{ fontSize: '14px', margin: '10px 0 0' }}>
                          <b>{pretty(night)}</b> · {x.nightName}{' '}
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>{x.kind === 'night' ? '— running, you’re in once we confirm' : '— we’ll set it up and confirm'}</span>
                          <button type="button" onClick={() => setNight('')} style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', cursor: 'pointer', fontSize: '13px' }}>clear</button>
                        </p>
                      ) : null
                    })()}
                    <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '12px' }}>Or tell us what suits you (optional)
                      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. any Friday or Saturday in January" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '6px', borderRadius: '10px', padding: '10px', background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', fontSize: '14px', fontFamily: 'inherit' }} />
                    </label>
                  </div>
                )}
                {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '14px' }}>{error}</p>}
                <button onClick={save} disabled={busy || !choice || (choice === 'move' && !night && note.trim().length < 3)}
                  style={{ width: '100%', height: '50px', marginTop: '6px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: busy || !choice ? 0.5 : 1 }}>
                  {busy ? 'Saving…' : 'Confirm my choice'}
                </button>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '10px' }}>No reply within 48 hours? We’ll keep it as credit for you — still refundable any time before you use it.</p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
