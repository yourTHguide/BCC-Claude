'use client'

import { useEffect, useState } from 'react'

// bkkclubcrawl.com/night — one link for every guest (website and OTA).
// 1. The form: name on booking, email, WhatsApp, date booked → matched to the booking.
// 2. Saved (matched) / checking (not matched yet).
// 3. On their night, once the owner adds the group link: Join + meeting point.
// What to know is always on the page. Logic: lib/nightJoin.ts.

const CODES: [string, string][] = [
  ['+44', '🇬🇧 +44'], ['+1', '🇺🇸 +1'], ['+61', '🇦🇺 +61'], ['+64', '🇳🇿 +64'], ['+353', '🇮🇪 +353'], ['+49', '🇩🇪 +49'], ['+33', '🇫🇷 +33'],
  ['+31', '🇳🇱 +31'], ['+32', '🇧🇪 +32'], ['+41', '🇨🇭 +41'], ['+34', '🇪🇸 +34'], ['+39', '🇮🇹 +39'], ['+351', '🇵🇹 +351'], ['+46', '🇸🇪 +46'],
  ['+47', '🇳🇴 +47'], ['+45', '🇩🇰 +45'], ['+358', '🇫🇮 +358'], ['+48', '🇵🇱 +48'], ['+43', '🇦🇹 +43'], ['+420', '🇨🇿 +420'], ['+7', '🇷🇺 +7'],
  ['+972', '🇮🇱 +972'], ['+971', '🇦🇪 +971'], ['+91', '🇮🇳 +91'], ['+65', '🇸🇬 +65'], ['+60', '🇲🇾 +60'], ['+62', '🇮🇩 +62'], ['+63', '🇵🇭 +63'],
  ['+84', '🇻🇳 +84'], ['+86', '🇨🇳 +86'], ['+852', '🇭🇰 +852'], ['+886', '🇹🇼 +886'], ['+81', '🇯🇵 +81'], ['+82', '🇰🇷 +82'], ['+66', '🇹🇭 +66'],
  ['+55', '🇧🇷 +55'], ['+52', '🇲🇽 +52'], ['+54', '🇦🇷 +54'], ['+27', '🇿🇦 +27'],
]
const REGION_CODE: Record<string, string> = { GB: '+44', US: '+1', CA: '+1', AU: '+61', NZ: '+64', IE: '+353', DE: '+49', FR: '+33', NL: '+31', BE: '+32', CH: '+41', ES: '+34', IT: '+39', PT: '+351', SE: '+46', NO: '+47', DK: '+45', FI: '+358', PL: '+48', AT: '+43', CZ: '+420', IL: '+972', AE: '+971', IN: '+91', SG: '+65', MY: '+60', ID: '+62', PH: '+63', VN: '+84', CN: '+86', HK: '+852', TW: '+886', JP: '+81', KR: '+82', TH: '+66', BR: '+55', MX: '+52', AR: '+54', ZA: '+27' }

const pad = (n: number) => String(n).padStart(2, '0')
const todayBkk = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
function pretty(date: string, long = false) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short', day: 'numeric', month: long ? 'long' : 'short', ...(long ? {} : { year: 'numeric' }), timeZone: 'UTC' })
}

const box = { borderRadius: '14px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)' } as const
const field = { display: 'block', width: '100%', minWidth: 0, boxSizing: 'border-box' as const, height: '48px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.07)', color: '#fff', padding: '0 14px', fontSize: '16px', fontFamily: 'inherit' }
const label = { display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.75)' }
const gradient = 'linear-gradient(135deg,#EA003A,#820065)'

function Calendar({ value, onPick }: { value: string; onPick: (d: string) => void }) {
  const today = todayBkk()
  const [ym, setYm] = useState(() => { const [y, m] = (value || today).split('-').map(Number); return { y, m: m - 1 } })
  const first = new Date(Date.UTC(ym.y, ym.m, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate()
  const key = `${ym.y}-${pad(ym.m + 1)}`
  const canPrev = key > today.slice(0, 7)
  const shift = (n: number) => setYm(({ y, m }) => { const d = new Date(Date.UTC(y, m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() } })
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  return (
    <div style={{ borderRadius: '12px', background: 'rgba(0,0,0,0.25)', padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous month" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', padding: '4px 12px', opacity: canPrev ? 1 : 0.25, cursor: 'pointer' }}>‹</button>
        <b style={{ fontSize: '14px' }}>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', padding: '4px 12px', cursor: 'pointer' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginTop: '4px' }}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const date = `${key}-${pad(d)}`
          const off = date < today || i % 7 === 0
          const sel = date === value
          return (
            <button key={i} type="button" disabled={off} onClick={() => onPick(date)}
              style={{ height: '38px', borderRadius: '8px', border: 'none', fontFamily: 'inherit', fontSize: '14px', cursor: off ? 'default' : 'pointer',
                background: sel ? gradient : off ? 'transparent' : 'rgba(255,255,255,0.08)', color: off ? 'rgba(255,255,255,0.25)' : '#fff', fontWeight: sel ? 700 : 400 }}>
              {d}
            </button>
          )
        })}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>Mondays are greyed out — we don’t run on Mondays.</p>
    </div>
  )
}

function KnowList() {
  const items: [string, string, string][] = [
    ['⏰', '9:30 PM sharp at the first bar', 'Missing the first stop counts as a no-show.'],
    ['💰', 'Bring ฿2,000–3,000 cash', 'For drinks and extras — at least one drink at each venue.'],
    ['👔', 'Smart casual', 'No tank tops, sportswear, flip-flops or sandals.'],
    ['🪪', '20+ with photo ID', 'Under 25? Bring your physical passport.'],
    ['🍽', 'Eat before you come', 'It’s a long, fun night.'],
    ['🔋', 'Charge your phone', 'WhatsApp is how you’ll reach your host all night.'],
  ]
  return (
    <div style={{ ...box, padding: '6px 16px' }}>
      {items.map(([icon, title, sub], i) => (
        <div key={title} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
          <span style={{ fontSize: '20px', lineHeight: 1.3 }} aria-hidden="true">{icon}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <b style={{ fontSize: '15px' }}>{title}</b>
            <span style={{ fontSize: '13px', lineHeight: 1.5, color: 'rgba(255,255,255,0.68)' }}>{sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NightPage() {
  const [s, setS] = useState<any>(null)
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('+44')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const region = (navigator.language || '').split('-')[1]?.toUpperCase()
    if (region && REGION_CODE[region]) setCode(REGION_CODE[region])
    fetch('/api/night', { cache: 'no-store' }).then((r) => r.json()).then(setS).catch(() => setS({ state: 'form' }))
  }, [])

  async function submit() {
    setBusy(true); setError('')
    const r = await fetch('/api/night', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, code, phone, date }) }).catch(() => null)
    const j = await r?.json().catch(() => ({}))
    setBusy(false)
    if (!r?.ok) { setError(j?.error || 'Something went wrong. Please try again.'); return }
    setS(j); setEdit(false); window.scrollTo(0, 0)
  }

  const state = edit ? 'form' : s?.state
  return (
    <main style={{ minHeight: '100vh', background: '#1A0015', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 18px 48px' }}>
      <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <a href="/" aria-label="Bangkok Club Crawl home"><img src="/images/bcc-logo.png" alt="Bangkok Club Crawl" style={{ height: '52px', width: 'auto', display: 'block' }} /></a>

        {!s && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Loading…</p>}

        {state === 'form' && (
          <>
            <div>
              <h1 style={{ margin: '0 0 6px', fontSize: '26px', lineHeight: 1.2 }}>Get ready for your night</h1>
              <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.72)' }}>Everything you need to know before the crawl.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submit() }} style={{ borderRadius: '16px', padding: '2px', background: gradient }}>
              <div style={{ borderRadius: '14px', background: '#1A0015', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700 }}>📲 We use WhatsApp on the night</p>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'rgba(255,255,255,0.8)' }}>Updates, the meeting point, photos and the quickest way to reach your host. The group is created <b>on the day</b> — leave your details and we’ll send you the link on WhatsApp.</p>
                </div>
                <label style={label}>Name on your booking<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Ann Lee" maxLength={80} style={field} /></label>
                <label style={label}>Email used for your booking<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" placeholder="you@email.com" style={field} /></label>
                <div style={label}>
                  <span>WhatsApp number</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select aria-label="Country code" value={code} onChange={(e) => setCode(e.target.value)} style={{ ...field, width: 'auto', padding: '0 8px', fontSize: '15px' }}>
                      {CODES.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
                    </select>
                    <input aria-label="WhatsApp number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel-national" inputMode="tel" placeholder="7700 900123" style={{ ...field, flex: 1 }} />
                  </div>
                </div>
                <div style={label}>
                  <span>Date you booked{date ? <b style={{ color: '#fff' }}> · {pretty(date)}</b> : ''}</span>
                  <Calendar value={date} onPick={setDate} />
                </div>
                {error && <p role="alert" style={{ margin: 0, color: '#FCA5A5', fontSize: '14px' }}>{error}</p>}
                <button type="submit" disabled={busy} style={{ height: '52px', borderRadius: '12px', border: 'none', background: gradient, color: '#fff', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Checking your booking…' : 'Send me the group link'}
                </button>
                <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.55, color: 'rgba(255,255,255,0.6)' }}>We match these details with your booking so we know it’s really you — that way the group link only goes to our guests. We only use them for your night and never share them.</p>
              </div>
            </form>
            <KnowList />
          </>
        )}

        {(state === 'saved' || state === 'checking') && (
          <>
            {state === 'saved' ? (
              <div style={{ ...box, borderColor: 'rgba(110,231,183,0.45)', background: 'rgba(110,231,183,0.08)', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>✓ Thanks {s.name.split(' ')[0]} — we found your booking</p>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'rgba(255,255,255,0.85)' }}>Bangkok Club Crawl · <b>{pretty(s.date, true)}</b></p>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'rgba(255,255,255,0.85)' }}>We’ll send the group link to <b>{s.phone}</b> on WhatsApp on the day, before 7 PM. Your host will be inside to welcome you.</p>
              </div>
            ) : (
              <div style={{ ...box, borderColor: 'rgba(252,211,77,0.45)', background: 'rgba(252,211,77,0.08)', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Thanks — we’re checking your booking</p>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'rgba(255,255,255,0.85)' }}>We couldn’t find <b>“{s.name}”</b> on <b>{pretty(s.date)}</b> yet. We’ll keep checking, and send the group link to <b>{s.phone}</b> on WhatsApp once it’s confirmed — no need to do anything.</p>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>Booked in the last hour? Bookings from partner sites can take a little while to reach us.</p>
              </div>
            )}
            <button type="button" onClick={() => { setEdit(true); setName(s.name); setDate(s.date) }} style={{ height: '46px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.22)', background: 'transparent', color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              Wrong details? Fill them in again
            </button>
            <KnowList />
          </>
        )}

        {state === 'join' && (
          <>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: '#FF5C85' }}>Tonight</p>
              <h1 style={{ margin: '0 0 6px', fontSize: '26px', lineHeight: 1.2 }}>Tonight’s the night!</h1>
              <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.72)' }}>{pretty(s.date, true)} · {s.nightName}</p>
            </div>
            <div style={{ borderRadius: '16px', padding: '2px', background: gradient }}>
              <div style={{ borderRadius: '14px', background: '#1A0015', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>📲 Your group chat is open, {s.name.split(' ')[0]}</p>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'rgba(255,255,255,0.8)' }}>Updates, photos and the quickest way to reach your host tonight. Your host is already inside — say hi!</p>
                <a href={s.groupLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '54px', borderRadius: '12px', background: gradient, color: '#fff', textDecoration: 'none', fontSize: '16px', fontWeight: 700 }}>Join the WhatsApp group</a>
              </div>
            </div>
            {s.meetUp && (
              <div style={{ ...box, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Meeting point · 9:30 PM sharp</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>{s.meetUp}</p>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.meetUp + ', Bangkok')}`} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: '36px', padding: '0 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>📍 Map</a>
                </div>
              </div>
            )}
            <KnowList />
          </>
        )}

        {s && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Questions? We’re here.</p>
            <a href="https://wa.me/66660399569" style={{ display: 'inline-flex', alignItems: 'center', height: '40px', padding: '0 16px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>WhatsApp us</a>
          </div>
        )}
      </div>
    </main>
  )
}
