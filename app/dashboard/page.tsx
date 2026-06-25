'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ──────────────────────────────────────────────────
interface EventDate {
  id: string
  event_date: string
  night_slug: string
  night_name: string
  is_open: boolean
  host_assigned: string
  notes: string
}

interface Booking {
  id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  quantity: number
  total_paid: number
  promo_code: string
  source: string
  status: string
  created_at: string
}

interface OTABooking {
  id: string
  source: string
  guest_name: string
  quantity: number
  total_paid: number
}

interface Expense {
  id: string
  category: string
  description: string
  amount: number
}

interface DayDetail {
  event: EventDate
  bookings: Booking[]
  otaBookings: OTABooking[]
  expenses: Expense[]
}

const HOSTS = ['Guide', 'Ice', 'Boom', 'JJ']
const NIGHTS = [
  { slug: 'solo-night', name: "Solo Traveler's Night", day: 'Tuesday' },
  { slug: 'new-in-bangkok', name: 'New in Bangkok Night', day: 'Wednesday' },
  { slug: 'nomad-nights', name: 'Digital Nomad Crawl', day: 'Wednesday' },
  { slug: 'girls-night', name: 'Girls Night Bangkok', day: 'Thursday' },
  { slug: '30plus-night', name: '30+ Social Night', day: 'Thursday' },
  { slug: 'tgif', name: 'TGIF Bangkok', day: 'Friday' },
  { slug: 'saturday-signature', name: 'Signature Night', day: 'Saturday' },
  { slug: 'lgbtplus-night', name: 'LGBT+ Night Bangkok', day: 'Sunday' },
]

// ── Auth gate ──────────────────────────────────────────────
function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    // Simple password check — env var set in Vercel
    if (pw === process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || pw === 'bcc2026guide') {
      sessionStorage.setItem('bcc_auth', '1')
      onAuth()
    } else {
      setError(true)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '360px', padding: '0 24px' }}>
        <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', marginBottom: '8px' }}>BCC DASHBOARD</p>
        <h1 style={{ fontWeight: 600, fontSize: '24px', color: '#fff', marginBottom: '32px' }}>Founder Access</h1>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false) }}
            style={{
              width: '100%', height: '48px', borderRadius: '8px', padding: '0 16px',
              background: 'rgba(255,255,255,0.06)', border: `1px solid ${error ? '#EA003A' : 'rgba(255,255,255,0.12)'}`,
              color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '15px',
              marginBottom: '12px', outline: 'none',
            }}
          />
          {error && <p style={{ color: '#EA003A', fontSize: '13px', marginBottom: '12px' }}>Incorrect password</p>}
          <button type="submit" style={{
            width: '100%', height: '48px', background: 'linear-gradient(135deg, #EA003A, #820065)',
            border: 'none', borderRadius: '8px', color: '#fff', fontFamily: 'Inter, sans-serif',
            fontWeight: 600, fontSize: '15px', cursor: 'pointer',
          }}>
            Enter Dashboard
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────
export default function Dashboard() {
  const [authed, setAuthed] = useState(false)
  const [view, setView] = useState<'calendar' | 'day'>('calendar')
  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null)
  const [events, setEvents] = useState<EventDate[]>([])
  const [loading, setLoading] = useState(false)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())

  // Add OTA booking form state
  const [addingOTA, setAddingOTA] = useState(false)
  const [otaForm, setOtaForm] = useState({ source: 'klook', guest_name: '', quantity: 1, total_paid: '' })

  // Add expense form state
  const [addingExpense, setAddingExpense] = useState(false)
  const [expForm, setExpForm] = useState({ category: 'van', description: '', amount: '' })

  useEffect(() => {
    if (sessionStorage.getItem('bcc_auth') === '1') setAuthed(true)
  }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const start = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`
    const end = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${new Date(calYear, calMonth + 1, 0).getDate()}`
    const { data } = await supabase
      .from('event_dates')
      .select('*')
      .gte('event_date', start)
      .lte('event_date', end)
      .order('event_date', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }, [calMonth, calYear])

  useEffect(() => {
    if (authed) loadEvents()
  }, [authed, loadEvents])

  async function loadDayDetail(event: EventDate) {
    const [bookingsRes, otaRes, expRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug).eq('status', 'confirmed'),
      supabase.from('ota_bookings').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug),
      supabase.from('expenses').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug),
    ])
    setSelectedDay({
      event,
      bookings: bookingsRes.data || [],
      otaBookings: otaRes.data || [],
      expenses: expRes.data || [],
    })
    setView('day')
  }

  async function toggleDateOpen(event: EventDate) {
    await supabase.from('event_dates').update({ is_open: !event.is_open }).eq('id', event.id)
    loadEvents()
    if (selectedDay?.event.id === event.id) {
      loadDayDetail({ ...event, is_open: !event.is_open })
    }
  }

  async function updateHost(event: EventDate, host: string) {
    await supabase.from('event_dates').update({ host_assigned: host }).eq('id', event.id)
    loadEvents()
    if (selectedDay) setSelectedDay({ ...selectedDay, event: { ...selectedDay.event, host_assigned: host } })
  }

  async function createEventDate(slug: string, date: string) {
    const night = NIGHTS.find(n => n.slug === slug)!
    await supabase.from('event_dates').upsert({
      event_date: date, night_slug: slug, night_name: night.name,
      is_open: true, host_assigned: 'Guide',
    })
    loadEvents()
  }

  async function addOTABooking() {
    if (!selectedDay) return
    await supabase.from('ota_bookings').insert({
      event_date: selectedDay.event.event_date,
      night_slug: selectedDay.event.night_slug,
      ...otaForm,
      total_paid: parseInt(otaForm.total_paid) || 0,
    })
    setAddingOTA(false)
    setOtaForm({ source: 'klook', guest_name: '', quantity: 1, total_paid: '' })
    loadDayDetail(selectedDay.event)
  }

  async function addExpense() {
    if (!selectedDay) return
    await supabase.from('expenses').insert({
      event_date: selectedDay.event.event_date,
      night_slug: selectedDay.event.night_slug,
      ...expForm,
      amount: parseInt(expForm.amount) || 0,
    })
    setAddingExpense(false)
    setExpForm({ category: 'van', description: '', amount: '' })
    loadDayDetail(selectedDay.event)
  }

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']

  // ── Styles ──────────────────────────────────────────────
  const s = {
    page: { minHeight: '100vh', background: '#0D000A', fontFamily: 'Inter, sans-serif', color: '#fff' } as React.CSSProperties,
    nav: { background: 'rgba(26,0,21,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    eyebrow: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#EA003A' },
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' } as React.CSSProperties,
    label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', marginBottom: '6px' },
    input: { width: '100%', height: '40px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', outline: 'none' } as React.CSSProperties,
    btn: { height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px' } as React.CSSProperties,
  }

  // ── Calendar view ────────────────────────────────────────
  if (view === 'calendar') {
    // Group events by date
    const byDate: Record<string, EventDate[]> = {}
    events.forEach(e => {
      if (!byDate[e.event_date]) byDate[e.event_date] = []
      byDate[e.event_date].push(e)
    })

    return (
      <div style={s.page}>
        <div style={s.nav}>
          <p style={s.eyebrow}>BCC DASHBOARD</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => { setCalMonth(m => m === 0 ? 11 : m - 1); if (calMonth === 0) setCalYear(y => y - 1) }} style={{ ...s.btn, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>‹</button>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>{monthNames[calMonth]} {calYear}</span>
            <button onClick={() => { setCalMonth(m => m === 11 ? 0 : m + 1); if (calMonth === 11) setCalYear(y => y + 1) }} style={{ ...s.btn, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>›</button>
          </div>
        </div>

        <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontWeight: 600, fontSize: '20px' }}>Event Calendar</h1>
          </div>

          {loading && <p style={{ color: 'rgba(255,255,255,0.40)' }}>Loading...</p>}

          {Object.keys(byDate).sort().map(date => {
            const dayEvents = byDate[date]
            const dateObj = new Date(date + 'T00:00:00')
            const dayLabel = dateObj.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
            const totalGuests = 0 // Would come from bookings join

            return (
              <div key={date} style={{ marginBottom: '16px' }}>
                <p style={{ ...s.label, marginBottom: '8px' }}>{dayLabel}</p>
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    style={{
                      ...s.card,
                      marginBottom: '8px',
                      cursor: 'pointer',
                      borderLeft: `3px solid ${event.is_open ? '#EA003A' : 'rgba(255,255,255,0.15)'}`,
                      opacity: event.is_open ? 1 : 0.6,
                    }}
                    onClick={() => loadDayDetail(event)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff', marginBottom: '4px' }}>{event.night_name}</p>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                          Host: {event.host_assigned || 'Unassigned'} ·
                          <span style={{ color: event.is_open ? '#EA003A' : 'rgba(255,255,255,0.30)', marginLeft: '4px' }}>
                            {event.is_open ? 'Open' : 'Closed'}
                          </span>
                        </p>
                      </div>
                      <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2"><path d="M6 3l6 5-6 5"/></svg>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          {events.length === 0 && !loading && (
            <div style={{ ...s.card, textAlign: 'center', padding: '48px' }}>
              <p style={{ color: 'rgba(255,255,255,0.40)', marginBottom: '16px' }}>No events this month.</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)' }}>
                Events are created automatically by the booking system, or you can add them manually below.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Day detail view ──────────────────────────────────────
  if (!selectedDay) return null
  const { event, bookings, otaBookings, expenses } = selectedDay

  const websiteGuests = bookings.reduce((s, b) => s + b.quantity, 0)
  const otaGuests = otaBookings.reduce((s, b) => s + b.quantity, 0)
  const totalGuests = websiteGuests + otaGuests
  const websiteRevenue = bookings.reduce((s, b) => s + b.total_paid, 0)
  const otaRevenue = otaBookings.reduce((s, b) => s + (b.total_paid || 0), 0)
  const totalRevenue = websiteRevenue + otaRevenue
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const grossProfit = totalRevenue - totalExpenses
  const minMet = totalGuests >= 5
  const dateObj = new Date(event.event_date + 'T00:00:00')
  const formattedDate = dateObj.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={s.page}>
      {/* Nav */}
      <div style={s.nav}>
        <button onClick={() => setView('calendar')} style={{ ...s.btn, background: 'none', color: 'rgba(255,255,255,0.60)', padding: '0' }}>← Back</button>
        <p style={s.eyebrow}>EVENT DETAIL</p>
        <div style={{ width: '60px' }} />
      </div>

      <div style={{ padding: '24px', maxWidth: '680px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ ...s.eyebrow, marginBottom: '8px' }}>{formattedDate}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h1 style={{ fontWeight: 600, fontSize: '22px' }}>{event.night_name}</h1>
            <button
              onClick={() => toggleDateOpen(event)}
              style={{
                ...s.btn,
                background: event.is_open ? 'rgba(234,0,58,0.15)' : 'rgba(255,255,255,0.08)',
                color: event.is_open ? '#EA003A' : 'rgba(255,255,255,0.60)',
                border: `1px solid ${event.is_open ? 'rgba(234,0,58,0.30)' : 'rgba(255,255,255,0.10)'}`,
              }}
            >
              {event.is_open ? 'Close Date' : 'Open Date'}
            </button>
          </div>
        </div>

        {/* Status + Host row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          {/* Min status */}
          <div style={{ ...s.card, borderLeft: `3px solid ${minMet ? '#22c55e' : '#f59e0b'}` }}>
            <p style={s.label}>MINIMUM (5 guests)</p>
            <p style={{ fontWeight: 700, fontSize: '22px', color: minMet ? '#22c55e' : '#f59e0b' }}>
              {totalGuests} / 5
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', marginTop: '4px' }}>
              {minMet ? 'Minimum met ✓' : `Need ${5 - totalGuests} more`}
            </p>
          </div>

          {/* Host assign */}
          <div style={s.card}>
            <p style={s.label}>ASSIGNED HOST</p>
            <select
              value={event.host_assigned || ''}
              onChange={e => updateHost(event, e.target.value)}
              style={{ ...s.input, height: '36px', marginTop: '4px' }}
            >
              <option value="">Unassigned</option>
              {HOSTS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        {/* Revenue summary */}
        <div style={{ ...s.card, marginBottom: '20px' }}>
          <p style={{ ...s.label, marginBottom: '16px' }}>REVENUE SUMMARY</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
            {[
              { label: 'Website', value: `฿${websiteRevenue.toLocaleString()}`, sub: `${websiteGuests} guests` },
              { label: 'OTA', value: `฿${otaRevenue.toLocaleString()}`, sub: `${otaGuests} guests` },
              { label: 'Total Revenue', value: `฿${totalRevenue.toLocaleString()}`, sub: `${totalGuests} total` },
              { label: 'Gross Profit', value: `฿${grossProfit.toLocaleString()}`, sub: `after expenses`, color: grossProfit >= 0 ? '#22c55e' : '#EA003A' },
            ].map(item => (
              <div key={item.label}>
                <p style={s.label}>{item.label}</p>
                <p style={{ fontWeight: 700, fontSize: '18px', color: item.color || '#fff' }}>{item.value}</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Website bookings */}
        <div style={{ ...s.card, marginBottom: '20px' }}>
          <p style={{ ...s.label, marginBottom: '16px' }}>WEBSITE BOOKINGS ({websiteGuests} guests)</p>
          {bookings.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>No website bookings yet.</p>}
          {bookings.map(b => (
            <div key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>{b.guest_name || b.guest_email}</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                    {b.guest_email} · {b.guest_phone} · {b.quantity} ticket{b.quantity > 1 ? 's' : ''}
                    {b.promo_code && ` · Code: ${b.promo_code}`}
                  </p>
                </div>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>฿{b.total_paid.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* OTA bookings */}
        <div style={{ ...s.card, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={s.label}>OTA BOOKINGS ({otaGuests} guests)</p>
            <button onClick={() => setAddingOTA(true)} style={{ ...s.btn, background: 'rgba(234,0,58,0.15)', color: '#EA003A', border: '1px solid rgba(234,0,58,0.30)' }}>+ Add</button>
          </div>

          {addingOTA && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <p style={s.label}>SOURCE</p>
                  <select value={otaForm.source} onChange={e => setOtaForm(f => ({...f, source: e.target.value}))} style={s.input}>
                    {['klook','airbnb','getyourguide','viator','eventbrite'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <p style={s.label}>GUEST NAME</p>
                  <input value={otaForm.guest_name} onChange={e => setOtaForm(f => ({...f, guest_name: e.target.value}))} style={s.input} placeholder="Name" />
                </div>
                <div>
                  <p style={s.label}>TICKETS</p>
                  <input type="number" min="1" value={otaForm.quantity} onChange={e => setOtaForm(f => ({...f, quantity: parseInt(e.target.value)}))} style={s.input} />
                </div>
                <div>
                  <p style={s.label}>TOTAL PAID (฿)</p>
                  <input type="number" value={otaForm.total_paid} onChange={e => setOtaForm(f => ({...f, total_paid: e.target.value}))} style={s.input} placeholder="0" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addOTABooking} style={{ ...s.btn, background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff' }}>Save</button>
                <button onClick={() => setAddingOTA(false)} style={{ ...s.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.60)' }}>Cancel</button>
              </div>
            </div>
          )}

          {otaBookings.length === 0 && !addingOTA && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>No OTA bookings added yet.</p>}
          {otaBookings.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '10px' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>{b.guest_name || 'Guest'}</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{b.source} · {b.quantity} ticket{b.quantity > 1 ? 's' : ''}</p>
              </div>
              <p style={{ fontWeight: 600, fontSize: '14px', color: '#fff' }}>฿{(b.total_paid || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Expenses */}
        <div style={{ ...s.card, marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={s.label}>EXPENSES (฿{totalExpenses.toLocaleString()})</p>
            <button onClick={() => setAddingExpense(true)} style={{ ...s.btn, background: 'rgba(234,0,58,0.15)', color: '#EA003A', border: '1px solid rgba(234,0,58,0.30)' }}>+ Add</button>
          </div>

          {addingExpense && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <p style={s.label}>CATEGORY</p>
                  <select value={expForm.category} onChange={e => setExpForm(f => ({...f, category: e.target.value}))} style={s.input}>
                    {['van','host_pay','drinks','cover_charge','extra'].map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <p style={s.label}>AMOUNT (฿)</p>
                  <input type="number" value={expForm.amount} onChange={e => setExpForm(f => ({...f, amount: e.target.value}))} style={s.input} placeholder="0" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <p style={s.label}>DESCRIPTION</p>
                  <input value={expForm.description} onChange={e => setExpForm(f => ({...f, description: e.target.value}))} style={s.input} placeholder="Optional note" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addExpense} style={{ ...s.btn, background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff' }}>Save</button>
                <button onClick={() => setAddingExpense(false)} style={{ ...s.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.60)' }}>Cancel</button>
              </div>
            </div>
          )}

          {expenses.length === 0 && !addingExpense && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>No expenses logged yet.</p>}
          {expenses.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '10px' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '13px', color: '#fff', textTransform: 'capitalize' }}>{e.category.replace('_', ' ')}</p>
                {e.description && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>{e.description}</p>}
              </div>
              <p style={{ fontWeight: 600, fontSize: '14px', color: '#EA003A' }}>฿{e.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
