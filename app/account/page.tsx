'use client'

import { useCallback, useEffect, useState } from 'react'

// My account (Nov 2026): a guest signs in with a code sent to their email
// and sees their bookings, tickets and credit, and can update their details.

function pretty(date: string | null) {
  if (!date) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
const baht = (n: number) => `฿${Math.round(n ?? 0).toLocaleString()}`
const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px', padding: '16px', marginBottom: '12px' }
const head = { fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.45)', fontWeight: 600, margin: '22px 0 10px' }
const field = { display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box' as const, height: '48px', borderRadius: '12px', padding: '0 14px', background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', fontSize: '16px', fontFamily: 'inherit' }
const primary = { display: 'block', width: '100%', height: '50px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const, textDecoration: 'none', lineHeight: '50px' }
const linkBtn = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '14px', fontFamily: 'inherit' }

type Booking = { id: string; source: string; reference: string | null; nightName: string; date: string; quantity: number; state: string; statusLabel: string; ticketUrl: string | null; choiceUrl: string | null }
type Account = { guest: { name: string | null; email: string; phone: string | null }; upcoming: Booking[]; past: Booking[]; actionNeeded: number; credit: { available: number; expires: string | null } }

function SignIn({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')

  async function send() {
    setBusy(true); setError(''); setNote('')
    const r = await fetch('/api/account/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null)
    const j = await r?.json().catch(() => ({}))
    setBusy(false)
    if (!r?.ok) { setError(j?.error || 'Something went wrong. Please try again.'); return }
    setStep('code'); setCode('')
  }
  async function verify() {
    setBusy(true); setError('')
    const r = await fetch('/api/account/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) }).catch(() => null)
    const j = await r?.json().catch(() => ({}))
    setBusy(false)
    if (!r?.ok) { setError(j?.error || 'Something went wrong. Please try again.'); return }
    onDone()
  }

  return (
    <div style={card}>
      {step === 'email' ? (
        <form onSubmit={(e) => { e.preventDefault(); send() }}>
          <b style={{ fontSize: '17px' }}>Sign in</b>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: '6px 0 14px' }}>Enter the email you booked with. We’ll send you a 6-digit code — no password needed.</p>
          <input type="email" autoComplete="email" inputMode="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={field} disabled={busy} />
          {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '14px', margin: '10px 0 0' }}>{error}</p>}
          <button type="submit" disabled={busy || !email.includes('@')} style={{ ...primary, marginTop: '12px', opacity: busy || !email.includes('@') ? 0.5 : 1 }}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify() }}>
          <b style={{ fontSize: '17px' }}>Check your email</b>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: '6px 0 14px' }}>If <b style={{ color: '#fff' }}>{email}</b> has a booking with us, a 6-digit code is on its way. It works for 15 minutes.</p>
          <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ ...field, fontSize: '24px', letterSpacing: '0.4em', textAlign: 'center' }} disabled={busy} autoFocus />
          {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '14px', margin: '10px 0 0' }}>{error}</p>}
          {note && <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', margin: '10px 0 0' }}>{note}</p>}
          <button type="submit" disabled={busy || code.length !== 6} style={{ ...primary, marginTop: '12px', opacity: busy || code.length !== 6 ? 0.5 : 1 }}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" style={linkBtn} onClick={() => { setStep('email'); setError('') }}>Use another email</button>
            <button type="button" style={linkBtn} disabled={busy} onClick={async () => { await send(); setNote('New code sent.') }}>Send a new code</button>
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '14px 0 0' }}>No email? Check spam, or message us on WhatsApp.</p>
        </form>
      )}
    </div>
  )
}

function BookingCard({ b }: { b: Booking }) {
  const action = b.statusLabel.startsWith('Action')
  const color = action ? '#FBBF24' : b.state === 'cancelled' ? 'rgba(255,255,255,0.45)' : b.state === 'upcoming' ? '#6EE7B7' : 'rgba(255,255,255,0.6)'
  return (
    <div style={{ ...card, ...(action ? { borderColor: 'rgba(251,191,36,0.5)' } : {}) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
        <b style={{ fontSize: '15px', minWidth: 0 }}>{b.nightName}</b>
        {b.reference && <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{b.reference}</span>}
      </div>
      <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', marginTop: '3px' }}>{pretty(b.date)} · {b.quantity} ticket{b.quantity === 1 ? '' : 's'}</div>
      <div style={{ fontSize: '13px', color, marginTop: '6px', fontWeight: 600 }}>{b.statusLabel}</div>
      {(b.ticketUrl || b.choiceUrl) && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          {b.choiceUrl && <a href={b.choiceUrl} style={{ flex: 1, textAlign: 'center', padding: '11px 14px', borderRadius: '10px', background: action ? '#EA003A' : 'transparent', border: action ? 'none' : '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>{action ? 'Choose refund or new date' : 'See details'}</a>}
          {b.ticketUrl && <a href={b.ticketUrl} style={{ flex: 1, textAlign: 'center', padding: '11px 14px', borderRadius: '10px', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>View ticket & QR</a>}
        </div>
      )}
      {b.source === 'ota' && b.state === 'upcoming' && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '8px 0 0' }}>Your ticket is in the app you booked with.</p>}
    </div>
  )
}

function Details({ a, onSaved }: { a: Account; onSaved: () => void }) {
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(a.guest.name ?? '')
  const [phone, setPhone] = useState(a.guest.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    const r = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone }) }).catch(() => null)
    const j = await r?.json().catch(() => ({}))
    setBusy(false)
    if (!r?.ok) { setError(j?.error || 'Couldn’t save — please try again.'); return }
    setEdit(false); onSaved()
  }
  const row = (label: string, value: string | null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '14px' }}>
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{value || '—'}</span>
    </div>
  )
  return (
    <div style={card}>
      {!edit ? (
        <>
          {row('Name', a.guest.name)}
          {row('Email', a.guest.email)}
          {row('Phone / WhatsApp', a.guest.phone)}
          <button onClick={() => setEdit(true)} style={{ ...linkBtn, marginTop: '8px' }}>Edit my details</button>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save() }} style={{ display: 'grid', gap: '10px' }}>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={{ ...field, marginTop: '6px' }} /></label>
          <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>Phone / WhatsApp<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+66 …" style={{ ...field, marginTop: '6px' }} /></label>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>Your email is how you sign in. To change it, message us.</p>
          {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '14px', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={busy || !name.trim()} style={{ ...primary, flex: 1, height: '46px', lineHeight: '46px', opacity: busy ? 0.6 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEdit(false); setName(a.guest.name ?? ''); setPhone(a.guest.phone ?? '') }} style={{ height: '46px', padding: '0 18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function AccountPage() {
  const [a, setA] = useState<Account | null>(null)
  const [state, setState] = useState<'loading' | 'signin' | 'ready' | 'error'>('loading')
  const [booked, setBooked] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  const load = useCallback(() => {
    fetch('/api/account').then(async (r) => {
      if (r.status === 401) { setState('signin'); return }
      if (!r.ok) { setState('error'); return }
      setA(await r.json()); setState('ready')
    }).catch(() => setState('error'))
  }, [])
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get('booked')
    if (b && /^\d{4}-\d{2}-\d{2}$/.test(b)) setBooked(b)
    load()
  }, [load])

  async function signOut() {
    await fetch('/api/account/logout', { method: 'POST' }).catch(() => {})
    setA(null); setState('signin')
  }

  const first = (a?.guest.name ?? '').trim().split(/\s+/)[0]
  return (
    <main style={{ minHeight: '100vh', background: '#1A0015', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '28px 18px 48px' }}>
      <div style={{ maxWidth: '460px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <a href="/" aria-label="Bangkok Club Crawl home"><img src="/images/bcc-logo.png" alt="Bangkok Club Crawl" style={{ height: '50px', width: 'auto', display: 'block' }} /></a>
          {state === 'ready' && <button onClick={signOut} style={{ ...linkBtn, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>Sign out</button>}
        </div>
        <h1 style={{ fontSize: '24px', margin: '0 0 16px' }}>{state === 'ready' && first ? `Hi ${first}` : 'My account'}</h1>

        {state === 'loading' && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Loading…</p>}
        {state === 'error' && <p style={card}>Something went wrong. Please refresh the page.</p>}
        {state === 'signin' && <SignIn onDone={load} />}

        {state === 'ready' && a && (
          <>
            {booked && (
              <div style={{ ...card, borderColor: 'rgba(110,231,183,0.5)' }}>
                <b>🎉 You’re booked for {pretty(booked)}!</b>
                <p style={{ fontSize: '14px', margin: '6px 0 0' }}>Paid with your credit. Your ticket is on its way by email.</p>
              </div>
            )}

            {a.credit.available > 0 && (
              <div style={{ ...card, background: 'linear-gradient(135deg, rgba(234,0,58,0.16), rgba(130,0,101,0.16))', borderColor: 'rgba(234,0,58,0.4)' }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Your credit</div>
                <div style={{ fontSize: '30px', fontWeight: 700, margin: '4px 0 2px' }}>{baht(a.credit.available)}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>{a.credit.expires ? `Valid until ${pretty(a.credit.expires)} · ` : ''}refundable any time before you use it</div>
                <a href="/book?credit=account" style={{ ...primary, marginTop: '14px' }}>Book with my credit →</a>
              </div>
            )}

            <p style={head}>Upcoming</p>
            {a.upcoming.length ? a.upcoming.map((b) => <BookingCard key={b.id} b={b} />) : (
              <div style={card}>
                <p style={{ fontSize: '14px', margin: '0 0 12px', color: 'rgba(255,255,255,0.7)' }}>No upcoming nights booked.</p>
                <a href="/weekends" style={primary}>Book a night</a>
              </div>
            )}

            {a.past.length > 0 && (
              <>
                <button onClick={() => setShowPast(!showPast)} style={{ ...head, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'block' }}>
                  Past & cancelled ({a.past.length}) {showPast ? '▴' : '▾'}
                </button>
                {showPast && a.past.map((b) => <BookingCard key={b.id} b={b} />)}
              </>
            )}

            <p style={head}>My details</p>
            <Details a={a} onSaved={load} />

            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '20px', textAlign: 'center' }}>
              Need help? <a href="https://wa.me/66660399569" style={{ color: '#fff' }}>WhatsApp us</a> or reply to any of our emails.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
