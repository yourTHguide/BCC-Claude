'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su']
const HOSTS = ['Guide','Ice','Boom','JJ']

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
  created_at: string
  night_name: string
  event_date: string
  guest_name: string
  guest_email: string
  guest_phone: string
  quantity: number
  total_paid: number
  promo_code: string
  source: string
  status: string
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

// ── Styles ─────────────────────────────────────────────────
const S = {
  page: { minHeight:'100vh', background:'#0D000A', fontFamily:'Inter, sans-serif', color:'#fff' } as React.CSSProperties,
  nav: { background:'rgba(26,0,21,0.98)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 24px', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between' } as React.CSSProperties,
  eyebrow: { fontWeight:600, fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase' as const, color:'#EA003A' },
  card: { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px' } as React.CSSProperties,
  label: { fontWeight:600, fontSize:'10px', letterSpacing:'0.15em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.40)', marginBottom:'6px', display:'block' },
  input: { width:'100%', height:'40px', borderRadius:'8px', padding:'0 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', fontFamily:'Inter, sans-serif', fontSize:'14px', outline:'none' } as React.CSSProperties,
  btn: { height:'36px', padding:'0 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:'13px' } as React.CSSProperties,
  btnRed: { background:'linear-gradient(135deg,#EA003A,#820065)', color:'#fff' } as React.CSSProperties,
  btnGhost: { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.70)', border:'1px solid rgba(255,255,255,0.10)' } as React.CSSProperties,
  btnDanger: { background:'rgba(234,0,58,0.12)', color:'#EA003A', border:'1px solid rgba(234,0,58,0.25)' } as React.CSSProperties,
}

// ── Auth Gate ───────────────────────────────────────────────
function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pw === process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || pw === 'bcc2026guide') {
      sessionStorage.setItem('bcc_auth', '1')
      onAuth()
    } else { setError(true) }
  }
  return (
    <div style={{ minHeight:'100vh', background:'#1A0015', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter, sans-serif' }}>
      <div style={{ width:'100%', maxWidth:'360px', padding:'0 24px' }}>
        <p style={S.eyebrow}>BCC DASHBOARD</p>
        <h1 style={{ fontWeight:600, fontSize:'24px', color:'#fff', margin:'8px 0 32px' }}>Founder Access</h1>
        <form onSubmit={handleLogin}>
          <input type="password" placeholder="Password" value={pw}
            onChange={e => { setPw(e.target.value); setError(false) }}
            style={{ ...S.input, marginBottom:'12px', border:`1px solid ${error?'#EA003A':'rgba(255,255,255,0.12)'}` }}
          />
          {error && <p style={{ color:'#EA003A', fontSize:'13px', marginBottom:'12px' }}>Incorrect password</p>}
          <button type="submit" style={{ ...S.btn, ...S.btnRed, width:'100%', height:'48px' }}>Enter Dashboard</button>
        </form>
      </div>
    </div>
  )
}

// ── Day Panel ───────────────────────────────────────────────
function DayPanel({ event, onClose, onUpdate }: { event: EventDate, onClose: () => void, onUpdate: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [otaBookings, setOtaBookings] = useState<OTABooking[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [addingOTA, setAddingOTA] = useState(false)
  const [addingExp, setAddingExp] = useState(false)
  const [otaForm, setOtaForm] = useState({ source:'klook', guest_name:'', quantity:1, total_paid:'' })
  const [expForm, setExpForm] = useState({ category:'van', description:'', amount:'' })
  const [localEvent, setLocalEvent] = useState(event)

  useEffect(() => {
    setLocalEvent(event)
    loadDetail()
  }, [event.id])

  async function loadDetail() {
    const [b, o, e] = await Promise.all([
      supabase.from('bookings').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug).eq('status','confirmed'),
      supabase.from('ota_bookings').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug),
      supabase.from('expenses').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug),
    ])
    setBookings(b.data || [])
    setOtaBookings(o.data || [])
    setExpenses(e.data || [])
  }

  async function toggleOpen() {
    await supabase.from('event_dates').update({ is_open: !localEvent.is_open }).eq('id', localEvent.id)
    setLocalEvent(e => ({ ...e, is_open: !e.is_open }))
    onUpdate()
  }

  async function updateHost(host: string) {
    await supabase.from('event_dates').update({ host_assigned: host }).eq('id', localEvent.id)
    setLocalEvent(e => ({ ...e, host_assigned: host }))
    onUpdate()
  }

  async function addOTA() {
    await supabase.from('ota_bookings').insert({ event_date: event.event_date, night_slug: event.night_slug, ...otaForm, total_paid: parseInt(otaForm.total_paid)||0 })
    setAddingOTA(false)
    setOtaForm({ source:'klook', guest_name:'', quantity:1, total_paid:'' })
    loadDetail()
  }

  async function addExpense() {
    await supabase.from('expenses').insert({ event_date: event.event_date, night_slug: event.night_slug, ...expForm, amount: parseInt(expForm.amount)||0 })
    setAddingExp(false)
    setExpForm({ category:'van', description:'', amount:'' })
    loadDetail()
  }

  const webGuests = bookings.reduce((s,b) => s+b.quantity, 0)
  const otaGuests = otaBookings.reduce((s,b) => s+b.quantity, 0)
  const totalGuests = webGuests + otaGuests
  const webRev = bookings.reduce((s,b) => s+b.total_paid, 0)
  const otaRev = otaBookings.reduce((s,b) => s+(b.total_paid||0), 0)
  const totalRev = webRev + otaRev
  const totalExp = expenses.reduce((s,e) => s+e.amount, 0)
  const profit = totalRev - totalExp
  const minMet = totalGuests >= 5

  const dateObj = new Date(event.event_date + 'T00:00:00')
  const formattedDate = dateObj.toLocaleDateString('en', { weekday:'long', day:'numeric', month:'long' })

  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'420px', background:'#1A0015', borderLeft:'1px solid rgba(255,255,255,0.08)', zIndex:200, overflowY:'auto', fontFamily:'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'sticky', top:0, background:'#1A0015', zIndex:10 }}>
        <div>
          <p style={{ ...S.eyebrow, marginBottom:'4px' }}>{formattedDate}</p>
          <h2 style={{ fontWeight:600, fontSize:'18px', color:'#fff', margin:0 }}>{localEvent.night_name}</h2>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button onClick={toggleOpen} style={{ ...S.btn, ...(localEvent.is_open ? S.btnDanger : S.btnGhost) }}>
            {localEvent.is_open ? 'Close Date' : 'Open Date'}
          </button>
          <button onClick={onClose} style={{ ...S.btn, ...S.btnGhost, padding:'0 12px' }}>✕</button>
        </div>
      </div>

      <div style={{ padding:'20px 24px' }}>

        {/* Min status */}
        <div style={{ ...S.card, borderLeft:`3px solid ${minMet?'#22c55e':'#f59e0b'}`, marginBottom:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <p style={{ ...S.label }}>GUESTS (MIN. 5)</p>
              <p style={{ fontWeight:700, fontSize:'28px', color: minMet?'#22c55e':'#f59e0b', margin:0 }}>{totalGuests}</p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ ...S.label }}>STATUS</p>
              <p style={{ fontWeight:600, fontSize:'14px', color: minMet?'#22c55e':'#f59e0b' }}>{minMet ? '✓ Confirmed' : `Need ${5-totalGuests} more`}</p>
            </div>
          </div>
        </div>

        {/* Host */}
        <div style={{ marginBottom:'16px' }}>
          <label style={S.label}>ASSIGNED HOST</label>
          <select value={localEvent.host_assigned||''} onChange={e => updateHost(e.target.value)} style={S.input}>
            <option value="">Unassigned</option>
            {HOSTS.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>

        {/* Revenue */}
        <div style={{ ...S.card, marginBottom:'16px' }}>
          <p style={{ ...S.label, marginBottom:'16px' }}>REVENUE</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            {[
              { label:'Website', val:`฿${webRev.toLocaleString()}`, sub:`${webGuests} guests` },
              { label:'OTA', val:`฿${otaRev.toLocaleString()}`, sub:`${otaGuests} guests` },
              { label:'Total Revenue', val:`฿${totalRev.toLocaleString()}`, sub:`${totalGuests} total` },
              { label:'Gross Profit', val:`฿${profit.toLocaleString()}`, sub:'after expenses', color: profit>=0?'#22c55e':'#EA003A' },
            ].map(item => (
              <div key={item.label}>
                <p style={{ ...S.label }}>{item.label}</p>
                <p style={{ fontWeight:700, fontSize:'18px', color: item.color||'#fff', margin:'0 0 2px' }}>{item.val}</p>
                <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)' }}>{item.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Website bookings */}
        <div style={{ ...S.card, marginBottom:'16px' }}>
          <p style={{ ...S.label, marginBottom:'16px' }}>WEBSITE BOOKINGS ({webGuests} guests)</p>
          {bookings.length === 0 && <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>No website bookings yet.</p>}
          {bookings.map(b => (
            <div key={b.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'12px', marginBottom:'12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div>
                  <p style={{ fontWeight:600, fontSize:'14px', color:'#fff' }}>{b.guest_name||b.guest_email}</p>
                  <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', marginTop:'2px' }}>
                    {b.guest_email} · {b.guest_phone} · {b.quantity} ticket{b.quantity>1?'s':''}
                    {b.promo_code && ` · ${b.promo_code}`}
                  </p>
                </div>
                <p style={{ fontWeight:600, fontSize:'14px', color:'#fff' }}>฿{b.total_paid.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* OTA bookings */}
        <div style={{ ...S.card, marginBottom:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <p style={{ ...S.label, margin:0 }}>OTA BOOKINGS ({otaGuests} guests)</p>
            <button onClick={() => setAddingOTA(true)} style={{ ...S.btn, ...S.btnDanger, height:'30px', padding:'0 12px' }}>+ Add</button>
          </div>
          {addingOTA && (
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'16px', marginBottom:'16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div>
                  <label style={S.label}>SOURCE</label>
                  <select value={otaForm.source} onChange={e => setOtaForm(f=>({...f,source:e.target.value}))} style={S.input}>
                    {['klook','airbnb','getyourguide','viator','eventbrite'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>GUEST NAME</label>
                  <input value={otaForm.guest_name} onChange={e=>setOtaForm(f=>({...f,guest_name:e.target.value}))} style={S.input} placeholder="Name"/>
                </div>
                <div>
                  <label style={S.label}>TICKETS</label>
                  <input type="number" min="1" value={otaForm.quantity} onChange={e=>setOtaForm(f=>({...f,quantity:parseInt(e.target.value)}))} style={S.input}/>
                </div>
                <div>
                  <label style={S.label}>TOTAL (฿)</label>
                  <input type="number" value={otaForm.total_paid} onChange={e=>setOtaForm(f=>({...f,total_paid:e.target.value}))} style={S.input} placeholder="0"/>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={addOTA} style={{ ...S.btn, ...S.btnRed }}>Save</button>
                <button onClick={()=>setAddingOTA(false)} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              </div>
            </div>
          )}
          {otaBookings.length===0 && !addingOTA && <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>No OTA bookings added.</p>}
          {otaBookings.map(b => (
            <div key={b.id} style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'10px', marginBottom:'10px' }}>
              <div>
                <p style={{ fontWeight:600, fontSize:'13px', color:'#fff' }}>{b.guest_name||'Guest'}</p>
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', marginTop:'2px' }}>{b.source} · {b.quantity} ticket{b.quantity>1?'s':''}</p>
              </div>
              <p style={{ fontWeight:600, fontSize:'13px', color:'#fff' }}>฿{(b.total_paid||0).toLocaleString()}</p>
            </div>
          ))}
        </div>

        {/* Expenses */}
        <div style={{ ...S.card, marginBottom:'40px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <p style={{ ...S.label, margin:0 }}>EXPENSES (฿{totalExp.toLocaleString()})</p>
            <button onClick={()=>setAddingExp(true)} style={{ ...S.btn, ...S.btnDanger, height:'30px', padding:'0 12px' }}>+ Add</button>
          </div>
          {addingExp && (
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'16px', marginBottom:'16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div>
                  <label style={S.label}>CATEGORY</label>
                  <select value={expForm.category} onChange={e=>setExpForm(f=>({...f,category:e.target.value}))} style={S.input}>
                    {['van','host_pay','drinks','cover_charge','extra'].map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>AMOUNT (฿)</label>
                  <input type="number" value={expForm.amount} onChange={e=>setExpForm(f=>({...f,amount:e.target.value}))} style={S.input} placeholder="0"/>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>DESCRIPTION</label>
                  <input value={expForm.description} onChange={e=>setExpForm(f=>({...f,description:e.target.value}))} style={S.input} placeholder="Optional note"/>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={addExpense} style={{ ...S.btn, ...S.btnRed }}>Save</button>
                <button onClick={()=>setAddingExp(false)} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              </div>
            </div>
          )}
          {expenses.length===0 && !addingExp && <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>No expenses logged.</p>}
          {expenses.map(e => (
            <div key={e.id} style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'10px', marginBottom:'10px' }}>
              <div>
                <p style={{ fontWeight:600, fontSize:'13px', color:'#fff', textTransform:'capitalize' }}>{e.category.replace('_',' ')}</p>
                {e.description && <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', marginTop:'2px' }}>{e.description}</p>}
              </div>
              <p style={{ fontWeight:600, fontSize:'13px', color:'#EA003A' }}>฿{e.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────
export default function Dashboard() {
  const [authed, setAuthed] = useState(false)
  const [activeTab, setActiveTab] = useState<'calendar'|'bookings'>('calendar')
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [events, setEvents] = useState<EventDate[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventDate|null>(null)
  const [loading, setLoading] = useState(false)
  const [resendState, setResendState] = useState<Record<string,'idle'|'sending'|'sent'|'error'>>({})
  const [rescheduleOpen, setRescheduleOpen] = useState<Record<string,boolean>>({})
  const [rescheduleDate, setRescheduleDate] = useState<Record<string,string>>({})
  const [cancelConfirm, setCancelConfirm] = useState<Record<string,boolean>>({})
  const [actionState, setActionState] = useState<Record<string,'idle'|'sending'|'done'|'error'>>({})

  useEffect(() => { if (sessionStorage.getItem('bcc_auth')==='1') setAuthed(true) }, [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const start = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`
    const end = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${new Date(calYear,calMonth+1,0).getDate()}`
    const { data } = await supabase.from('event_dates').select('*').gte('event_date',start).lte('event_date',end)
    setEvents(data||[])
    setLoading(false)
  }, [calYear, calMonth])

  const loadBookings = useCallback(async () => {
    const { data } = await supabase.from('bookings').select('*').eq('status','confirmed').order('created_at',{ascending:false})
    setAllBookings(data||[])
  }, [])

  async function resendConfirmation(bookingId: string) {
    setResendState(s => ({ ...s, [bookingId]: 'sending' }))
    try {
      const res = await fetch('/api/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResendState(s => ({ ...s, [bookingId]: 'sent' }))
        setTimeout(() => setResendState(s => ({ ...s, [bookingId]: 'idle' })), 3000)
      } else {
        setResendState(s => ({ ...s, [bookingId]: 'error' }))
      }
    } catch {
      setResendState(s => ({ ...s, [bookingId]: 'error' }))
    }
  }

  async function rescheduleBooking(bookingId: string) {
    const newDate = rescheduleDate[bookingId]
    if (!newDate) return
    setActionState(s => ({ ...s, [bookingId]: 'sending' }))
    try {
      const res = await fetch('/api/reschedule-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, newDate }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setActionState(s => ({ ...s, [bookingId]: 'done' }))
        setRescheduleOpen(s => ({ ...s, [bookingId]: false }))
        loadBookings()
        setTimeout(() => setActionState(s => ({ ...s, [bookingId]: 'idle' })), 3000)
      } else {
        setActionState(s => ({ ...s, [bookingId]: 'error' }))
      }
    } catch {
      setActionState(s => ({ ...s, [bookingId]: 'error' }))
    }
  }

  async function cancelBooking(bookingId: string) {
    setActionState(s => ({ ...s, [bookingId]: 'sending' }))
    try {
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setActionState(s => ({ ...s, [bookingId]: 'done' }))
        setCancelConfirm(s => ({ ...s, [bookingId]: false }))
        loadBookings()
      } else {
        setActionState(s => ({ ...s, [bookingId]: 'error' }))
      }
    } catch {
      setActionState(s => ({ ...s, [bookingId]: 'error' }))
    }
  }

  useEffect(() => { if (authed) { loadEvents(); loadBookings() } }, [authed, loadEvents, loadBookings])

  if (!authed) return <AuthGate onAuth={() => setAuthed(true)} />

  // Build calendar grid
  const firstDow = new Date(calYear, calMonth, 1).getDay()
  const offset = (firstDow + 6) % 7 // Mon-start
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate()
  const today = new Date(); today.setHours(0,0,0,0)

  // Group events by date
  const eventsByDate: Record<string, EventDate[]> = {}
  events.forEach(e => {
    if (!eventsByDate[e.event_date]) eventsByDate[e.event_date] = []
    eventsByDate[e.event_date].push(e)
  })

  function prevMonth() {
    if (calMonth===0) { setCalMonth(11); setCalYear(y=>y-1) }
    else setCalMonth(m=>m-1)
    setSelectedEvent(null)
  }
  function nextMonth() {
    if (calMonth===11) { setCalMonth(0); setCalYear(y=>y+1) }
    else setCalMonth(m=>m+1)
    setSelectedEvent(null)
  }

  const nightColors: Record<string,string> = {
    'solo-night': '#7C3AED',
    'new-in-bangkok': '#2563EB',
    'nomad-nights': '#0891B2',
    'girls-night': '#DB2777',
    '30plus-night': '#D97706',
    'tgif': '#059669',
    'saturday-signature': '#EA003A',
    'lgbtplus-night': '#7C3AED',
  }

  return (
    <div style={S.page}>
      {/* Nav */}
      <div style={S.nav}>
        <p style={S.eyebrow}>BCC DASHBOARD</p>
        <div style={{ display:'flex', gap:'8px' }}>
          {(['calendar','bookings'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              ...S.btn,
              ...(activeTab===tab ? S.btnRed : S.btnGhost),
              textTransform:'capitalize',
            }}>
              {tab === 'calendar' ? '📅 Calendar' : '📋 Bookings'}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={prevMonth} style={{ ...S.btn, ...S.btnGhost, padding:'0 12px' }}>‹</button>
          <span style={{ fontWeight:600, fontSize:'15px', minWidth:'140px', textAlign:'center' }}>{MONTH_NAMES[calMonth]} {calYear}</span>
          <button onClick={nextMonth} style={{ ...S.btn, ...S.btnGhost, padding:'0 12px' }}>›</button>
        </div>
      </div>

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div style={{ padding:'24px', maxWidth: selectedEvent ? 'calc(100% - 440px)' : '900px', margin:'0 auto', transition:'max-width 0.2s' }}>
          {/* Day labels */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'8px' }}>
            {DAY_LABELS.map(d => (
              <div key={d} style={{ textAlign:'center', fontWeight:600, fontSize:'11px', color:'rgba(255,255,255,0.30)', padding:'8px 0' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
            {/* Empty offset cells */}
            {Array.from({length:offset}).map((_,i) => <div key={`e${i}`} />)}

            {/* Day cells */}
            {Array.from({length:daysInMonth}).map((_,i) => {
              const day = i+1
              const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayEvents = eventsByDate[dateStr] || []
              const isPast = new Date(dateStr+'T00:00:00') < today
              const isToday = new Date(dateStr+'T00:00:00').toDateString() === today.toDateString()
              const isSelected = selectedEvent?.event_date === dateStr

              return (
                <div
                  key={day}
                  style={{
                    minHeight:'80px',
                    borderRadius:'10px',
                    background: isSelected ? 'rgba(234,0,58,0.10)' : isToday ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: isSelected ? '1px solid rgba(234,0,58,0.40)' : isToday ? '1px solid rgba(234,0,58,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    padding:'8px',
                    cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                    opacity: isPast ? 0.5 : 1,
                    transition:'all 0.15s',
                  }}
                  onClick={() => dayEvents.length > 0 && setSelectedEvent(dayEvents[0])}
                >
                  {/* Day number */}
                  <div style={{
                    fontWeight: isToday ? 700 : 400,
                    fontSize:'13px',
                    color: isToday ? '#EA003A' : 'rgba(255,255,255,0.60)',
                    marginBottom:'6px',
                  }}>{day}</div>

                  {/* Event pills */}
                  {dayEvents.map(ev => (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                      style={{
                        background: ev.is_open ? (nightColors[ev.night_slug]||'#EA003A') : 'rgba(255,255,255,0.10)',
                        borderRadius:'4px',
                        padding:'2px 6px',
                        fontSize:'10px',
                        fontWeight:600,
                        color: ev.is_open ? '#fff' : 'rgba(255,255,255,0.40)',
                        marginBottom:'3px',
                        whiteSpace:'nowrap',
                        overflow:'hidden',
                        textOverflow:'ellipsis',
                        cursor:'pointer',
                      }}
                    >
                      {ev.is_open ? '' : '✕ '}{ev.night_name.split(' ')[0]}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginTop:'24px', padding:'16px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.05)' }}>
            {Object.entries(nightColors).slice(0,6).map(([slug,color]) => {
              const name = events.find(e=>e.night_slug===slug)?.night_name || slug
              return (
                <div key={slug} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:color }} />
                  <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.40)' }}>{name.split(' ').slice(0,2).join(' ')}</span>
                </div>
              )
            })}
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.20)' }} />
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.40)' }}>Closed</span>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div style={{ padding:'24px', maxWidth:'900px', margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
            <h1 style={{ fontWeight:600, fontSize:'20px', margin:0 }}>Confirmed Bookings</h1>
            <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.40)' }}>{allBookings.length} total</p>
          </div>

          {allBookings.length === 0 && (
            <div style={{ ...S.card, textAlign:'center', padding:'48px' }}>
              <p style={{ color:'rgba(255,255,255,0.40)' }}>No bookings yet.</p>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {allBookings.map(b => {
              const dateObj = new Date(b.event_date+'T00:00:00')
              const formattedDate = dateObj.toLocaleDateString('en',{weekday:'short',day:'numeric',month:'short'})
              return (
                <div key={b.id} style={{ ...S.card, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px' }}>
                  <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                    {/* Date badge */}
                    <div style={{ background:'linear-gradient(135deg,#EA003A,#820065)', borderRadius:'8px', padding:'6px 12px', textAlign:'center', flexShrink:0 }}>
                      <p style={{ fontWeight:700, fontSize:'16px', color:'#fff', margin:0, lineHeight:1 }}>{dateObj.getDate()}</p>
                      <p style={{ fontWeight:600, fontSize:'9px', color:'rgba(255,255,255,0.80)', margin:0, letterSpacing:'0.1em' }}>{dateObj.toLocaleString('en',{month:'short'}).toUpperCase()}</p>
                    </div>
                    <div>
                      <p style={{ fontWeight:600, fontSize:'14px', color:'#fff', margin:'0 0 3px' }}>{b.guest_name||b.guest_email}</p>
                      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', margin:0 }}>
                        {b.night_name} · {formattedDate}
                      </p>
                      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)', margin:'2px 0 0' }}>
                        {b.guest_email} · {b.guest_phone}
                      </p>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontWeight:700, fontSize:'16px', color:'#fff', margin:0 }}>฿{b.total_paid.toLocaleString()}</p>
                      <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.40)', margin:'2px 0 0' }}>
                        {b.quantity} ticket{b.quantity>1?'s':''} · {b.source}
                        {b.promo_code && ` · ${b.promo_code}`}
                      </p>
                    </div>
                    <button
                onClick={() => resendConfirmation(b.id)}
                disabled={resendState[b.id]==='sending'}
                style={{ ...S.btn, ...S.btnGhost, height:'30px', padding:'0 12px', fontSize:'12px' }}
              >
                {resendState[b.id]==='sending' ? 'Sending…' : resendState[b.id]==='sent' ? '✓ Sent' : resendState[b.id]==='error' ? 'Failed — Retry' : 'Resend Email'}
              </button>
              <button
                onClick={() => setRescheduleOpen(s => ({ ...s, [b.id]: !s[b.id] }))}
                style={{ ...S.btn, ...S.btnGhost, height:'30px', padding:'0 12px', fontSize:'12px' }}
              >
                Reschedule
              </button>
              <button
                onClick={() => setCancelConfirm(s => ({ ...s, [b.id]: !s[b.id] }))}
                style={{ ...S.btn, ...S.btnDanger, height:'30px', padding:'0 12px', fontSize:'12px' }}
              >
                Cancel
              </button>
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
                  </div>

                  {rescheduleOpen[b.id] && (
                    <div style={{ width:'100%', marginTop:'4px', paddingTop:'14px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center' }}>
                      <label style={{ ...S.label, marginBottom:0 }}>NEW DATE</label>
                      <input
                        type="date"
                        value={rescheduleDate[b.id] || ''}
                        onChange={e => setRescheduleDate(s => ({ ...s, [b.id]: e.target.value }))}
                        style={{ ...S.input, maxWidth:'180px' }}
                      />
                      <button
                        onClick={() => rescheduleBooking(b.id)}
                        disabled={!rescheduleDate[b.id] || actionState[b.id]==='sending'}
                        style={{ ...S.btn, ...S.btnRed }}
                      >
                        {actionState[b.id]==='sending' ? 'Sending…' : 'Confirm New Date & Notify Guest'}
                      </button>
                      <button onClick={() => setRescheduleOpen(s => ({ ...s, [b.id]: false }))} style={{ ...S.btn, ...S.btnGhost }}>
                        Never mind
                      </button>
                      {actionState[b.id]==='error' && <p style={{ color:'#EA003A', fontSize:'12px', margin:0 }}>Failed — try again</p>}
                    </div>
                  )}

                  {cancelConfirm[b.id] && (
                    <div style={{ width:'100%', marginTop:'4px', paddingTop:'14px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center' }}>
                      <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.70)', margin:0, flex:'1 1 260px' }}>
                        Cancel this booking and refund ฿{b.total_paid.toLocaleString()} to {b.guest_name||b.guest_email}? This can't be undone.
                      </p>
                      <button
                        onClick={() => cancelBooking(b.id)}
                        disabled={actionState[b.id]==='sending'}
                        style={{ ...S.btn, ...S.btnDanger }}
                      >
                        {actionState[b.id]==='sending' ? 'Cancelling…' : 'Confirm Cancel & Refund'}
                      </button>
                      <button onClick={() => setCancelConfirm(s => ({ ...s, [b.id]: false }))} style={{ ...S.btn, ...S.btnGhost }}>
                        Never mind
                      </button>
                      {actionState[b.id]==='error' && <p style={{ color:'#EA003A', fontSize:'12px', margin:0 }}>Failed — try again</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Day panel */}
      {selectedEvent && activeTab==='calendar' && (
        <DayPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdate={loadEvents}
        />
      )}
    </div>
  )
}
