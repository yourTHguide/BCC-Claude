'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import OperationsSheet, { type OperationsPalette } from '@/components/operations/OperationsSheet'
import MeetupSender, { type MeetupPalette, type MeetupGuest } from '@/components/operations/MeetupSender'
import DoorList, { type DoorListTheme } from '@/components/doorlist/DoorList'
import OtaImport from '@/components/operations/OtaImport'
import AddNightPanel, { OnSaleToggle } from './AddNightPanel'
import VanPanel from './VanPanel'
import MissionControl from './MissionControl'
import type { DoorGuest } from '@/lib/doorList'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su']
const HOSTS = ['Guide','Ice','Boom','JJ']

const OPS_PALETTE: OperationsPalette = {
  text:'#fff', muted:'rgba(255,255,255,0.60)', faint:'rgba(255,255,255,0.38)',
  card:'rgba(255,255,255,0.04)', border:'rgba(255,255,255,0.08)', inputBg:'rgba(255,255,255,0.06)',
  accent:'#EA003A', accentText:'#fff', green:'#22c55e', amber:'#f59e0b', red:'#EA003A',
}

const MEETUP_PALETTE: MeetupPalette = {
  text:'#fff', muted:'rgba(255,255,255,0.55)', faint:'rgba(255,255,255,0.38)', border:'rgba(255,255,255,0.08)',
  rowBg:'rgba(255,255,255,0.03)', accent:'#EA003A', green:'#22c55e', amber:'#f59e0b', red:'#EA003A',
}
const VERDICT_OPTIONS = ['Pending','Pre-confirmation','Operation Confirmed','Cancelled / Rescheduled','Completed','Reviewed']
const VERDICT_REQUIRING_CONFIRM = ['Operation Confirmed','Cancelled / Rescheduled']
const PRE_CONFIRMATION_MESSAGE = "Quick update — we're close to confirming tonight's group. We'll make the final confirmation by 7 PM. If the group stays smaller, we'd like to check which option works best for you: reschedule or refund. If you prefer to reschedule, please send us your preferred alternative date."

// Host fee: flat 1500 for up to 5 show-up guests, +300 per guest beyond 5
function suggestedHostFee(showUpGuests: number): number {
  if (showUpGuests <= 5) return 1500
  return 1500 + (showUpGuests - 5) * 300
}

interface VenueRoute {
  venue1?: string
  venue2?: string
  venue3?: string
  venue4?: string
  backup?: string
  notes?: string
}

interface EventDate {
  id: string
  event_date: string
  night_slug: string
  night_name: string
  is_open: boolean
  host_assigned: string
  notes: string
  operation_verdict: string
  meet_up_location: string | null
  whatsapp_group_link: string | null
  venue_route: VenueRoute | null
  van_or_taxi_contact: string | null
  special_notes: string | null
  host_payment_status: string
  host_fee_final: number | null
}

interface Booking {
  id: string
  created_at: string
  night_name: string
  event_date: string
  guest_name: string
  guest_email: string
  guest_phone: string
  guest_whatsapp?: string | null
  night_phone?: string | null
  quantity: number
  total_paid: number
  promo_code: string
  source: string
  status: string
  attendance_status: string
  meetup_sent_at?: string | null
  notes?: string | null
  // Named guests (Single Meet Club); empty for bookings without them.
  booking_attendees?: { full_name: string; position: number }[]
}

// A wa.me link to message the guest, with a greeting ready. Thai local
// numbers (0XXXXXXXXX) get +66; anything else is used as given.
function whatsappUrl(b: Booking): string | null {
  const raw = b.guest_whatsapp || b.guest_phone || b.night_phone || ''
  let digits = raw.replace(/\D/g, '')
  if (!raw.trim().startsWith('+') && /^0\d{9}$/.test(digits)) digits = '66' + digits.slice(1)
  if (digits.length < 8) return null
  const first = (b.guest_name || '').trim().split(/\s+/)[0] || 'there'
  const day = new Date(b.event_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${first}, this is Bangkok Club Crawl about your booking for ${b.night_name} on ${day}. `)}`
}

// "Cancelled & refunded" when /api/cancel-booking recorded a Stripe refund.
function cancelledLabel(b: Booking): string {
  return /refunded via Stripe/.test(b.notes ?? '') ? 'Cancelled & refunded' : 'Cancelled'
}

// "1. Ana, 2. Ben" — only for bookings with more than one named guest.
function attendeeLine(b: Booking): string | null {
  const names = [...(b.booking_attendees ?? [])].sort((x, y) => x.position - y.position).map(a => a.full_name)
  return names.length > 1 ? names.map((n, i) => `${i + 1}. ${n}`).join(', ') : null
}

interface OTABooking {
  id: string
  source: string
  guest_name: string
  guest_email?: string | null
  quantity: number
  total_paid: number
  attendance_status: string
  meetup_sent_at?: string | null
}

interface Expense {
  id: string
  category: string
  description: string
  amount: number
}

// Same door list the Operator and Host views use (components/doorlist/DoorList).
const DOOR_THEME: DoorListTheme = {
  elevated: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: '#fff',
  muted: 'rgba(255,255,255,0.60)', faint: 'rgba(255,255,255,0.40)',
  accent: '#EA003A', accentText: '#FF4D6D',
  green: '#4ADE80', greenSoft: 'rgba(74,222,128,0.14)', blue: '#60A5FA', blueSoft: 'rgba(96,165,250,0.14)',
  red: '#F87171', redSoft: 'rgba(248,113,113,0.14)', chipBg: 'rgba(255,255,255,0.08)', radius: '10px',
}

// ── Styles ─────────────────────────────────────────────────
const S = {
  page: { minHeight:'100vh', background:'#0D000A', fontFamily:'Inter, sans-serif', color:'#fff' } as React.CSSProperties,
  eyebrow: { fontWeight:600, fontSize:'10px', letterSpacing:'0.2em', textTransform:'uppercase' as const, color:'#EA003A' },
  card: { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px' } as React.CSSProperties,
  label: { fontWeight:600, fontSize:'10px', letterSpacing:'0.15em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.40)', marginBottom:'6px', display:'block' },
  input: { width:'100%', height:'40px', borderRadius:'8px', padding:'0 12px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.10)', color:'#fff', fontFamily:'Inter, sans-serif', fontSize:'14px', outline:'none' } as React.CSSProperties,
  btn: { height:'36px', padding:'0 16px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'Inter, sans-serif', fontWeight:600, fontSize:'13px' } as React.CSSProperties,
  btnRed: { background:'linear-gradient(135deg,#EA003A,#820065)', color:'#fff' } as React.CSSProperties,
  btnGhost: { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.70)', border:'1px solid rgba(255,255,255,0.10)' } as React.CSSProperties,
  btnDanger: { background:'rgba(234,0,58,0.12)', color:'#EA003A', border:'1px solid rgba(234,0,58,0.25)' } as React.CSSProperties,
}

// ── Confirm Modal ───────────────────────────────────────────
// Generic admin-confirmation dialog used before any sensitive action
// (sending guest email, marking a verdict, marking host pay as Paid, etc.)
function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string, message: string, confirmLabel: string, onConfirm: () => void, onCancel: () => void,
}) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  // Portaled to <body>: this used to render inside DayPanel, which is itself
  // a position:fixed + overflowY:auto scroller. A fixed overlay nested in a
  // scrolling fixed parent can paint in one place and hit-test in another
  // (notably iOS Safari once the panel is scrolled), leaving a dimmed screen
  // whose buttons don't respond — the "froze, status never saved" report.
  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.60)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', fontFamily:'Inter, sans-serif' }}>
      <div style={{ ...S.card, width:'100%', maxWidth:'380px', background:'#1A0015', border:'1px solid rgba(234,0,58,0.25)' }}>
        <h3 style={{ fontWeight:600, fontSize:'16px', color:'#fff', margin:'0 0 10px' }}>{title}</h3>
        <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.65)', lineHeight:1.6, margin:'0 0 20px' }}>{message}</p>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button onClick={onCancel} disabled={busy} style={{ ...S.btn, ...S.btnGhost, opacity: busy ? 0.5 : 1 }}>Never mind</button>
          <button onClick={handleConfirm} disabled={busy} style={{ ...S.btn, ...S.btnRed, opacity: busy ? 0.7 : 1 }}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Day Panel ───────────────────────────────────────────────
function DayPanel({ event, onClose, onUpdate }: { event: EventDate, onClose: () => void, onUpdate: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [otaBookings, setOtaBookings] = useState<OTABooking[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [addingOTA, setAddingOTA] = useState(false)
  const [addingExp, setAddingExp] = useState(false)
  // Set when the add form is being reused to edit an existing row.
  const [editingOtaId, setEditingOtaId] = useState<string|null>(null)
  const [editingExpId, setEditingExpId] = useState<string|null>(null)
  // Locks the Save buttons while a save is in flight — a second tap used to
  // insert the same expense / booking twice (the server also dedupes).
  const [savingForm, setSavingForm] = useState<'ota'|'exp'|null>(null)
  const [detailLoadedId, setDetailLoadedId] = useState<string|null>(null)
  const [otaForm, setOtaForm] = useState({ source:'klook', guest_name:'', guest_email:'', quantity:1, total_paid:'' })
  const [expForm, setExpForm] = useState({ category:'van', description:'', amount:'' })
  const [localEvent, setLocalEvent] = useState(event)
  // Host choices: the usual four plus every display name on the Team page, so
  // whatever name a host signs in with can be assigned (and their Host view,
  // report and earnings match the night).
  const [hostNames, setHostNames] = useState<string[]>(HOSTS)
  useEffect(() => {
    fetch('/api/admin/hosts').then((r) => (r.ok ? r.json() : null)).then((j) => {
      const names = (j?.hosts ?? []).map((h: any) => (h.displayName ?? '').trim()).filter(Boolean)
      setHostNames(Array.from(new Set([...HOSTS, ...names])))
    }).catch(() => {})
  }, [])

  // ── Operations layer state ──
  const [confirmModal, setConfirmModal] = useState<{ title:string, message:string, confirmLabel:string, onConfirm:()=>void } | null>(null)
  const [hostFeeInput, setHostFeeInput] = useState<string>('')
  // "Pay host" step: van + drinks paid together with the host fee.
  const [payVan, setPayVan] = useState('')
  const [payDrinks, setPayDrinks] = useState('')
  const [payPersonal, setPayPersonal] = useState(false)
  const [briefCopyState, setBriefCopyState] = useState<'idle'|'copied'>('idle')
  const [preConfirmCopyState, setPreConfirmCopyState] = useState<'idle'|'copied'>('idle')

  useEffect(() => {
    setHostFeeInput(event.host_fee_final != null ? String(event.host_fee_final) : '')
  }, [event.id, event.host_fee_final])

  const [opsDraft, setOpsDraft] = useState({
    meet_up_location: event.meet_up_location || '',
    whatsapp_group_link: event.whatsapp_group_link || '',
    van_or_taxi_contact: event.van_or_taxi_contact || '',
    special_notes: event.special_notes || '',
    venue1: event.venue_route?.venue1 || '',
    venue2: event.venue_route?.venue2 || '',
    venue3: event.venue_route?.venue3 || '',
    venue4: event.venue_route?.venue4 || '',
    backup: event.venue_route?.backup || '',
    route_notes: event.venue_route?.notes || '',
  })
  useEffect(() => {
    setOpsDraft({
      meet_up_location: event.meet_up_location || '',
      whatsapp_group_link: event.whatsapp_group_link || '',
      van_or_taxi_contact: event.van_or_taxi_contact || '',
      special_notes: event.special_notes || '',
      venue1: event.venue_route?.venue1 || '',
      venue2: event.venue_route?.venue2 || '',
      venue3: event.venue_route?.venue3 || '',
      venue4: event.venue_route?.venue4 || '',
      backup: event.venue_route?.backup || '',
      route_notes: event.venue_route?.notes || '',
    })
  }, [event.id])

  useEffect(() => {
    setLocalEvent(event)
    loadDetail()
  }, [event.id])

  async function loadDetail() {
    const params = new URLSearchParams({ eventDate: event.event_date, nightSlug: event.night_slug })
    const res = await fetch(`/api/admin/dashboard/day-detail?${params}`)
    const data = await res.json().catch(() => ({} as any))
    setBookings(data.bookings || [])
    setOtaBookings(data.otaBookings || [])
    setExpenses(data.expenses || [])
    setDetailLoadedId(event.id)
  }

  async function toggleOpen() {
    await fetch(`/api/admin/dashboard/events/${localEvent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen: !localEvent.is_open }),
    })
    setLocalEvent(e => ({ ...e, is_open: !e.is_open }))
    onUpdate()
  }

  async function updateHost(host: string) {
    await fetch(`/api/admin/dashboard/events/${localEvent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostAssigned: host }),
    })
    setLocalEvent(e => ({ ...e, host_assigned: host }))
    onUpdate()
  }

  async function addOTA() {
    if (savingForm) return
    setSavingForm('ota')
    try { await saveOTAForm() } finally { setSavingForm(null) }
  }

  async function saveOTAForm() {
    const fields = {
      source: otaForm.source,
      guestName: otaForm.guest_name,
      guestEmail: otaForm.guest_email,
      quantity: otaForm.quantity,
      totalPaid: parseInt(otaForm.total_paid) || 0,
    }
    const res = await fetch('/api/admin/dashboard/ota-bookings', {
      method: editingOtaId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingOtaId
        ? { id: editingOtaId, ...fields }
        : { eventDate: event.event_date, nightSlug: event.night_slug, ...fields }),
    }).catch(() => null)
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => ({} as any)) : {}
      alert(`Couldn't save this booking: ${body.error || 'network error, please try again'}`)
      return
    }
    closeOtaForm()
    loadDetail()
    onUpdate()
  }

  function startEditOTA(o: OTABooking) {
    setEditingOtaId(o.id)
    setOtaForm({ source:o.source, guest_name:o.guest_name||'', guest_email:o.guest_email||'', quantity:o.quantity||1, total_paid:String(o.total_paid||0) })
    setAddingOTA(true)
  }

  function closeOtaForm() {
    setAddingOTA(false)
    setEditingOtaId(null)
    setOtaForm({ source:'klook', guest_name:'', guest_email:'', quantity:1, total_paid:'' })
  }

  function deleteOTABooking(o: OTABooking) {
    setConfirmModal({
      title: 'Remove this OTA booking?',
      message: `Remove ${o.guest_name || 'this guest'} (${o.source}, ${o.quantity} ticket${o.quantity===1?'':'s'})? This cannot be undone.`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/delete-ota-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: o.id }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as any))
            alert(`Couldn't remove this booking: ${body.error || res.statusText}`)
            return
          }
          await loadDetail()
          onUpdate()
        } catch (err: any) {
          alert(`Couldn't remove this booking: ${err?.message || 'network error, please try again'}`)
        } finally {
          setConfirmModal(null)
        }
      },
    })
  }

  async function addExpense() {
    if (savingForm) return
    setSavingForm('exp')
    try { await saveExpenseForm() } finally { setSavingForm(null) }
  }

  async function saveExpenseForm() {
    const fields = {
      category: expForm.category,
      description: expForm.description,
      amount: parseInt(expForm.amount) || 0,
    }
    const res = await fetch('/api/admin/dashboard/expenses', {
      method: editingExpId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingExpId
        ? { id: editingExpId, ...fields }
        : { eventDate: event.event_date, nightSlug: event.night_slug, ...fields }),
    }).catch(() => null)
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => ({} as any)) : {}
      alert(`Couldn't save this expense: ${body.error || 'network error, please try again'}`)
      return
    }
    closeExpForm()
    loadDetail()
  }

  function startEditExpense(e: Expense) {
    setEditingExpId(e.id)
    setExpForm({ category:e.category, description:e.description||'', amount:String(e.amount||0) })
    setAddingExp(true)
  }

  function closeExpForm() {
    setAddingExp(false)
    setEditingExpId(null)
    setExpForm({ category:'van', description:'', amount:'' })
  }

  function deleteExpense(e: Expense) {
    setConfirmModal({
      title: 'Delete this expense?',
      message: `Delete ${e.category.replace('_',' ')} ฿${(e.amount||0).toLocaleString()}${e.description ? ` (${e.description})` : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/dashboard/expenses', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: e.id }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({} as any))
            alert(`Couldn't delete this expense: ${body.error || res.statusText}`)
            return
          }
          if (editingExpId === e.id) closeExpForm()
          await loadDetail()
        } catch (err: any) {
          alert(`Couldn't delete this expense: ${err?.message || 'network error, please try again'}`)
        } finally {
          setConfirmModal(null)
        }
      },
    })
  }

  // ── Operations layer handlers ──
  // Security migration (Phase 2A): previously wrote directly to event_dates
  // via the anon-key client (same permissive public UPDATE policy toggleOpen/
  // updateHost used above); now routed through the same requireAdmin()-gated
  // PATCH endpoint they use, via an explicit field-name allowlist server-side.
  //
  // Regression fix (verdict/modal freeze): this previously fired the PATCH
  // and applied the local optimistic update unconditionally, never checking
  // whether the request actually succeeded — matching the OLD anon-key
  // client's behavior, but not the res.ok-checked pattern this same file
  // already uses for deleteOTABooking/updateAttendance. A confirm-modal
  // caller (updateVerdict, markHostPaid) also never awaited this, so the
  // modal closed before the save even reached the server, leaving no visual
  // feedback while a request was still in flight. Now returns whether the
  // save succeeded, and both confirm-modal callers await it.
  async function saveOpsField(patch: Partial<EventDate>): Promise<boolean> {
    const body: Record<string, any> = {}
    if ('operation_verdict' in patch) body.operationVerdict = patch.operation_verdict
    if ('meet_up_location' in patch) body.meetUpLocation = patch.meet_up_location
    if ('whatsapp_group_link' in patch) body.whatsappGroupLink = patch.whatsapp_group_link
    if ('venue_route' in patch) body.venueRoute = patch.venue_route
    if ('van_or_taxi_contact' in patch) body.vanOrTaxiContact = patch.van_or_taxi_contact
    if ('special_notes' in patch) body.specialNotes = patch.special_notes
    if ('host_fee_final' in patch) body.hostFeeFinal = patch.host_fee_final
    if ('host_payment_status' in patch) body.hostPaymentStatus = patch.host_payment_status
    // Hard timeout so a stalled request can never leave the confirm modal
    // stuck on "Working…" with no way out.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`/api/admin/dashboard/events/${localEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as any))
        alert(`Couldn't save: ${errBody.error || res.statusText}`)
        return false
      }
    } catch (err: any) {
      alert(err?.name === 'AbortError'
        ? "Couldn't save: the request timed out. Please try again."
        : `Couldn't save: ${err?.message || 'network error, please try again'}`)
      return false
    } finally {
      clearTimeout(timer)
    }
    setLocalEvent(e => ({ ...e, ...patch }))
    onUpdate()
    return true
  }

  function updateVerdict(verdict: string) {
    if (VERDICT_REQUIRING_CONFIRM.includes(verdict)) {
      setConfirmModal({
        title: verdict === 'Operation Confirmed' ? 'Confirm operation?' : 'Cancel / reschedule this date?',
        message: verdict === 'Operation Confirmed'
          ? `Mark ${localEvent.night_name} on ${event.event_date} as Operation Confirmed? This unlocks the "Send Confirmed Meetup" email.`
          : `Mark ${localEvent.night_name} on ${event.event_date} as Cancelled / Rescheduled? This does not automatically refund or notify guests — use the Bookings tab for that.`,
        confirmLabel: 'Confirm',
        onConfirm: async () => { await saveOpsField({ operation_verdict: verdict }); setConfirmModal(null) },
      })
    } else {
      saveOpsField({ operation_verdict: verdict })
    }
  }

  function updateVenueRoute(patch: Partial<VenueRoute>) {
    const next = { ...(localEvent.venue_route || {}), ...patch }
    saveOpsField({ venue_route: next })
  }

  async function updateAttendance(table: 'bookings'|'ota_bookings', id: string, status: string) {
    const doUpdate = async () => {
      try {
        const res = await fetch('/api/update-attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table, id, status }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({} as any))
          alert(`Couldn't update attendance: ${body.error || res.statusText}`)
          return
        }
        await loadDetail()
      } catch (err: any) {
        alert(`Couldn't update attendance: ${err?.message || 'network error, please try again'}`)
      } finally {
        setConfirmModal(null)
      }
    }
    if (status === 'no_show') {
      setConfirmModal({
        title: 'Mark as no-show?',
        message: 'This affects the suggested host fee calculation (based on checked-in guest count).',
        confirmLabel: 'Mark no-show',
        onConfirm: doUpdate,
      })
    } else {
      doUpdate()
    }
  }

  function saveHostFee() {
    const val = parseInt(hostFeeInput)
    saveOpsField({ host_fee_final: isNaN(val) ? null : val, host_payment_status: localEvent.host_payment_status === 'Not calculated' ? 'Calculated' : localEvent.host_payment_status })
  }

  function useSuggestedFee(suggested: number) {
    setHostFeeInput(String(suggested))
    saveOpsField({ host_fee_final: suggested, host_payment_status: localEvent.host_payment_status === 'Not calculated' ? 'Calculated' : localEvent.host_payment_status })
  }

  // Uses the fee currently in the input (falling back to the suggested fee)
  // and saves it together with 'Paid' in one request. Previously the popup
  // read the last *saved* host_fee_final, which went stale once attendance
  // changed the suggested fee (e.g. ฿1,500 saved earlier, ฿2,400 after 8
  // check-ins) — so the popup showed, and the record kept, the old amount.
  function markHostPaid(suggested: number) {
    const typed = parseInt(hostFeeInput)
    // Ticking "paid on personal card" means Guide hosted: no host fee unless one is typed.
    const fee = isNaN(typed) ? (payPersonal ? 0 : suggested) : typed
    const mismatch = fee !== suggested
      ? ` Note: the suggested fee for ${checkedInGuests} checked-in guest${checkedInGuests!==1?'s':''} is ฿${suggested.toLocaleString()}.`
      : ''
    const van = Math.max(0, parseInt(payVan) || 0)
    const drinks = Math.max(0, parseInt(payDrinks) || 0)
    const logged = (cat: string) => expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
    const already = [['van', van, logged('van')], ['drinks', drinks, logged('drinks')]]
      .filter(([, add, has]) => (add as number) > 0 && (has as number) > 0)
      .map(([cat, add, has]) => `${cat} ฿${(has as number).toLocaleString()} is already logged — this adds ฿${(add as number).toLocaleString()} more`)
    const paidOn = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' })
    const parts = [`host fee ฿${fee.toLocaleString()}`, van ? `van / taxi ฿${van.toLocaleString()}` : '', drinks ? `drinks ฿${drinks.toLocaleString()}` : ''].filter(Boolean)
    const total = fee + van + drinks
    setConfirmModal({
      title: 'Pay host?',
      message: `Save ${parts.join(' + ')} = ฿${total.toLocaleString()} on this night, and mark ${localEvent.host_assigned || 'the assigned host'} as Paid (${paidOn}).`
        + (payPersonal ? ' Van / drinks noted as paid on personal K-Bank card.' : '')
        + (already.length ? ` Note: ${already.join('; ')}.` : '')
        + mismatch,
      confirmLabel: `Pay ฿${total.toLocaleString()}`,
      onConfirm: async () => {
        const ok = await saveOpsField({ host_fee_final: fee, host_payment_status: 'Paid' })
        if (ok) {
          setHostFeeInput(String(fee))
          const desc = `Pay host step, paid ${paidOn}` + (payPersonal ? ' — paid on personal K-Bank card' : '')
          for (const [category, amount] of [['van', van], ['drinks', drinks]] as const) {
            if (!amount) continue
            const res = await fetch('/api/admin/dashboard/expenses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventDate: event.event_date, nightSlug: event.night_slug, category, description: desc, amount }),
            }).catch(() => null)
            if (!res || !res.ok) alert(`Host fee saved, but the ${category} cost (฿${amount.toLocaleString()}) didn't save — add it under Expenses.`)
          }
          setPayVan(''); setPayDrinks(''); setPayPersonal(false)
          await loadDetail()
        }
        setConfirmModal(null)
      },
    })
  }

  function copyPreConfirmMessage() {
    navigator.clipboard.writeText(PRE_CONFIRMATION_MESSAGE)
    setPreConfirmCopyState('copied')
    setTimeout(() => setPreConfirmCopyState('idle'), 2500)
  }

  function buildHostBriefText(): string {
    const route = localEvent.venue_route || {}
    const dateObj2 = new Date(event.event_date + 'T00:00:00')
    const fmtDate = dateObj2.toLocaleDateString('en', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    const guestLines = [
      ...bookings.map(b => `  - ${b.guest_name||b.guest_email} (${b.quantity} ticket${b.quantity>1?'s':''}) — website — ${b.attendance_status}`),
      ...otaBookings.map(o => `  - ${o.guest_name||'Guest'} (${o.quantity} ticket${o.quantity>1?'s':''}) — ${o.source} — ${o.attendance_status}`),
    ]
    return [
      `HOST BRIEF — ${localEvent.night_name}`,
      `Date: ${fmtDate}`,
      `Meet-up time: 9:30 PM`,
      `Meet-up location: ${localEvent.meet_up_location || '(not set)'}`,
      `Assigned host: ${localEvent.host_assigned || '(unassigned)'}`,
      `Total guests: ${totalGuests}`,
      ``,
      `GUEST LIST (${totalGuests}):`,
      ...(guestLines.length ? guestLines : ['  (no guests yet)']),
      ``,
      `WhatsApp group: ${localEvent.whatsapp_group_link || '(not set)'}`,
      ``,
      `VENUE ROUTE:`,
      `  Venue 1 (meet-up): ${route.venue1 || '(not set)'}`,
      `  Venue 2: ${route.venue2 || '-'}`,
      `  Venue 3: ${route.venue3 || '-'}`,
      `  Venue 4: ${route.venue4 || '-'}`,
      `  Backup venue: ${route.backup || '-'}`,
      `  Route notes: ${route.notes || '-'}`,
      ``,
      `Van/taxi contact: ${localEvent.van_or_taxi_contact || '(not set)'}`,
      ``,
      `SPECIAL NOTES: ${localEvent.special_notes || '(none)'}`,
      ``,
      `Emergency / Guide contact: WhatsApp https://wa.me/66660399569 · bangkokclubcrawl@gmail.com`,
    ].join('\n')
  }

  function copyHostBrief() {
    navigator.clipboard.writeText(buildHostBriefText())
    setBriefCopyState('copied')
    setTimeout(() => setBriefCopyState('idle'), 2500)
  }

  function downloadHostBrief() {
    const blob = new Blob([buildHostBriefText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `host-brief-${event.event_date}-${event.night_slug}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function sendMeetupIssuesFor(): string[] {
    const issues: string[] = []
    if (localEvent.operation_verdict !== 'Operation Confirmed') issues.push('Operation verdict must be "Operation Confirmed"')
    if (!localEvent.meet_up_location) issues.push('Meet-up location is not set')
    if (!localEvent.whatsapp_group_link) issues.push('WhatsApp group link is not set')
    const confirmedGuestCount = bookings.filter(b=>b.attendance_status!=='no_show').length + otaBookings.filter(o=>o.attendance_status!=='no_show').length
    if (confirmedGuestCount === 0) issues.push('There are no confirmed guests for this date')
    return issues
  }

  const webGuests = bookings.reduce((s,b) => s+b.quantity, 0)
  const otaGuests = otaBookings.reduce((s,b) => s+b.quantity, 0)
  const totalGuests = webGuests + otaGuests
  const webRev = bookings.reduce((s,b) => s+b.total_paid, 0)
  const otaRev = otaBookings.reduce((s,b) => s+(b.total_paid||0), 0)
  const totalRev = webRev + otaRev
  // Host cost = the final host fee (same rule as the Operations sheet); a
  // 'host_pay' expense only counts when no final fee is set.
  const hostFeeSet = localEvent.host_fee_final != null
  const totalExp = expenses.reduce((s,e) => s+e.amount, 0)
  const hostPayExp = expenses.filter(e => e.category === 'host_pay').reduce((s,e) => s+e.amount, 0)
  const profit = totalRev - totalExp + (hostFeeSet ? hostPayExp - localEvent.host_fee_final! : 0)
  const minMet = totalGuests >= 5
  const checkedInGuests = bookings.filter(b=>b.attendance_status==='checked_in').reduce((s,b)=>s+b.quantity,0)
    + otaBookings.filter(o=>o.attendance_status==='checked_in').reduce((s,o)=>s+o.quantity,0)
  const suggestedFee = suggestedHostFee(checkedInGuests)
  // Keep the final-fee input in step with the suggested fee as check-ins
  // change, as long as it hasn't been paid and nobody typed a custom amount
  // (i.e. the input still equals the previous suggestion, or is empty).
  // Only reacts to attendance edits, not to the panel's own initial load or
  // switching to another date.
  const prevSuggestedRef = useRef<number|null>(null)
  useEffect(() => {
    if (detailLoadedId !== event.id) { prevSuggestedRef.current = null; return }
    const prev = prevSuggestedRef.current
    prevSuggestedRef.current = suggestedFee
    if (prev === null || prev === suggestedFee) return
    if (localEvent.host_payment_status === 'Paid') return
    if (hostFeeInput === '' || parseInt(hostFeeInput) === prev) setHostFeeInput(String(suggestedFee))
  }, [suggestedFee, detailLoadedId, event.id])
  const meetupIssues = sendMeetupIssuesFor()

  const dateObj = new Date(event.event_date + 'T00:00:00')
  const formattedDate = dateObj.toLocaleDateString('en', { weekday:'long', day:'numeric', month:'long' })

  return (
    // Full-width on a narrow phone (this fixed panel previously hardcoded
    // width:420px, which on any viewport under 420px pushed its own left
    // edge off-screen — since `right:0` anchors the panel to the viewport's
    // right edge, a wider-than-viewport fixed element extends past the left
    // edge rather than being clipped, forcing page-level horizontal scroll.
    // That was the actual mechanism behind the reported overflow/clipping,
    // not the content inside the panel. `maxWidth` still caps it at 420px
    // from the sm breakpoint up, so desktop is pixel-identical to before.
    <div className="w-full sm:max-w-[420px]" style={{ position:'fixed', top:0, right:0, bottom:0, background:'#1A0015', borderLeft:'1px solid rgba(255,255,255,0.08)', zIndex:200, overflowY:'auto', fontFamily:'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'sticky', top:0, background:'#1A0015', zIndex:10 }}>
        <div>
          <p style={{ ...S.eyebrow, marginBottom:'4px' }}>{formattedDate}</p>
          <h2 style={{ fontWeight:600, fontSize:'18px', color:'#fff', margin:0 }}>{localEvent.night_name}</h2>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <OnSaleToggle on={localEvent.is_open} onChange={() => toggleOpen()} />
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
            {Array.from(new Set([...hostNames, ...(localEvent.host_assigned ? [localEvent.host_assigned] : [])])).map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>


        {/* ── Vans (Phase 3D) ── */}
        <VanPanel eventId={localEvent.id} />

        {/* ── Operations ── */}
        <div style={{ ...S.card, marginBottom:'16px' }}>
          <p style={{ ...S.label, marginBottom:'16px' }}>OPERATIONS</p>

          <div style={{ marginBottom:'14px' }}>
            <label style={S.label}>OPERATION VERDICT</label>
            <select value={localEvent.operation_verdict} onChange={e => updateVerdict(e.target.value)} style={S.input}>
              {VERDICT_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:'14px' }}>
            <label style={S.label}>MEET-UP LOCATION</label>
            <input
              value={opsDraft.meet_up_location}
              onChange={e => setOpsDraft(d => ({ ...d, meet_up_location: e.target.value }))}
              onBlur={() => saveOpsField({ meet_up_location: opsDraft.meet_up_location })}
              style={S.input}
              placeholder="e.g. Havana Social, Sukhumvit Soi 11"
            />
          </div>

          <div style={{ marginBottom:'14px' }}>
            <label style={S.label}>WHATSAPP GROUP LINK</label>
            <input
              value={opsDraft.whatsapp_group_link}
              onChange={e => setOpsDraft(d => ({ ...d, whatsapp_group_link: e.target.value }))}
              onBlur={() => saveOpsField({ whatsapp_group_link: opsDraft.whatsapp_group_link })}
              style={S.input}
              placeholder="https://chat.whatsapp.com/..."
            />
          </div>

          <div style={{ marginBottom:'14px' }}>
            <label style={S.label}>VENUE ROUTE</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              <input value={opsDraft.venue1} onChange={e=>setOpsDraft(d=>({...d,venue1:e.target.value}))} onBlur={()=>updateVenueRoute({venue1:opsDraft.venue1})} style={S.input} placeholder="Venue 1 (meet-up)"/>
              <input value={opsDraft.venue2} onChange={e=>setOpsDraft(d=>({...d,venue2:e.target.value}))} onBlur={()=>updateVenueRoute({venue2:opsDraft.venue2})} style={S.input} placeholder="Venue 2"/>
              <input value={opsDraft.venue3} onChange={e=>setOpsDraft(d=>({...d,venue3:e.target.value}))} onBlur={()=>updateVenueRoute({venue3:opsDraft.venue3})} style={S.input} placeholder="Venue 3"/>
              <input value={opsDraft.venue4} onChange={e=>setOpsDraft(d=>({...d,venue4:e.target.value}))} onBlur={()=>updateVenueRoute({venue4:opsDraft.venue4})} style={S.input} placeholder="Venue 4 (optional)"/>
              <input value={opsDraft.backup} onChange={e=>setOpsDraft(d=>({...d,backup:e.target.value}))} onBlur={()=>updateVenueRoute({backup:opsDraft.backup})} style={S.input} placeholder="Backup venue (optional)"/>
              <input value={opsDraft.route_notes} onChange={e=>setOpsDraft(d=>({...d,route_notes:e.target.value}))} onBlur={()=>updateVenueRoute({notes:opsDraft.route_notes})} style={S.input} placeholder="Route notes (optional)"/>
            </div>
          </div>

          <div style={{ marginBottom:'14px' }}>
            <label style={S.label}>VAN / TAXI CONTACT</label>
            <input
              value={opsDraft.van_or_taxi_contact}
              onChange={e => setOpsDraft(d => ({ ...d, van_or_taxi_contact: e.target.value }))}
              onBlur={() => saveOpsField({ van_or_taxi_contact: opsDraft.van_or_taxi_contact })}
              style={S.input}
              placeholder="Name / phone"
            />
          </div>

          <div style={{ marginBottom:'16px' }}>
            <label style={S.label}>SPECIAL NOTES</label>
            <textarea
              value={opsDraft.special_notes}
              onChange={e => setOpsDraft(d => ({ ...d, special_notes: e.target.value }))}
              onBlur={() => saveOpsField({ special_notes: opsDraft.special_notes })}
              style={{ ...S.input, height:'70px', padding:'10px 12px', resize:'vertical' as const }}
              placeholder="Guest issues, dress code warnings, route changes, anything the host should know"
            />
          </div>

          {/* Host fee */}
          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'14px', marginBottom:'16px' }}>
            <p style={{ ...S.label, marginBottom:'10px' }}>HOST PAYMENT</p>
            <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', marginBottom:'10px' }}>
              Suggested fee for {checkedInGuests} checked-in guest{checkedInGuests!==1?'s':''}: <strong style={{color:'#fff'}}>฿{suggestedFee.toLocaleString()}</strong>
            </p>
            <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
              <input type="number" value={hostFeeInput} onChange={e=>setHostFeeInput(e.target.value)} onBlur={saveHostFee} style={{...S.input, flex:1}} placeholder="Final fee (฿)"/>
              <button onClick={() => useSuggestedFee(suggestedFee)} style={{ ...S.btn, ...S.btnGhost, whiteSpace:'nowrap' }}>Use suggested</button>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <select value={localEvent.host_payment_status} onChange={e => saveOpsField({ host_payment_status: e.target.value })} style={{...S.input, flex:1}}>
                <option value="Not calculated">Not calculated</option>
                <option value="Calculated">Calculated</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
            {localEvent.host_payment_status !== 'Paid' && (
              <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', marginBottom:'8px' }}>Pay host: fee above + this night's van and drinks, saved in one step.</p>
                <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                  <input type="number" min={0} value={payVan} onChange={e=>setPayVan(e.target.value)} style={{...S.input, flex:1}} placeholder="Van / taxi (฿)"/>
                  <input type="number" min={0} value={payDrinks} onChange={e=>setPayDrinks(e.target.value)} style={{...S.input, flex:1}} placeholder="Drinks (฿)"/>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'rgba(255,255,255,0.7)', marginBottom:'10px', cursor:'pointer' }}>
                  <input type="checkbox" checked={payPersonal} onChange={e=>setPayPersonal(e.target.checked)}/>
                  Paid on personal card (I hosted / paid the van myself)
                </label>
                <button onClick={() => markHostPaid(suggestedFee)} style={{ ...S.btn, ...S.btnRed, width:'100%' }}>Pay host</button>
              </div>
            )}
          </div>

          {/* Guest attendance: same door list as /operator and the Host view */}
          <div style={{ marginBottom:'16px' }}>
            <p style={{ ...S.label, marginBottom:'10px' }}>GUEST ATTENDANCE</p>
            <DoorList
              guests={[
                ...bookings.map((b: any): DoorGuest => ({
                  id: b.id, table: 'bookings', name: b.guest_name || b.guest_email || 'Guest', quantity: b.quantity,
                  source: b.source || 'website', status: b.attendance_status, email: b.guest_email || null,
                  phone: b.guest_whatsapp || b.guest_phone || null, ref: null, notes: b.notes || null,
                  attendeeNames: [...(b.booking_attendees ?? [])].sort((x: any, y: any) => x.position - y.position).map((a: any) => a.full_name),
                })),
                ...otaBookings.map((o: any): DoorGuest => ({
                  id: o.id, table: 'ota_bookings', name: o.guest_name || 'Guest', quantity: o.quantity, source: o.source,
                  status: o.attendance_status, email: o.guest_email || null, phone: null, ref: null, notes: o.notes || null, attendeeNames: [],
                })),
              ].sort((p, q) => p.name.trim().localeCompare(q.name.trim(), 'en', { sensitivity: 'base' }))}
              theme={DOOR_THEME}
              scanHref="/dashboard/checkin"
              onChanged={loadDetail}
            />
          </div>

          {/* Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={copyHostBrief} style={{ ...S.btn, ...S.btnGhost, flex:1 }}>
                {briefCopyState==='copied' ? '✓ Copied' : 'Copy Host Brief'}
              </button>
              <button onClick={downloadHostBrief} style={{ ...S.btn, ...S.btnGhost, flex:1 }}>Download .txt</button>
            </div>

            <button onClick={copyPreConfirmMessage} style={{ ...S.btn, ...S.btnGhost }}>
              {preConfirmCopyState==='copied' ? '✓ Copied' : 'Copy Pre-confirmation Message'}
            </button>

            <div style={{ marginTop:'6px' }}>
              <p style={{ ...S.label, marginBottom:'8px' }}>CONFIRMED MEETUP EMAIL</p>
              <MeetupSender
                eventId={localEvent.id}
                nightName={localEvent.night_name}
                eventDate={event.event_date}
                guests={[
                  ...bookings.map((b: Booking): MeetupGuest => ({ table:'bookings', id:b.id, name:b.guest_name||b.guest_email||'Guest', quantity:b.quantity, email:b.guest_email||null, sentAt:b.meetup_sent_at??null, attendance:b.attendance_status })),
                  ...otaBookings.map((o): MeetupGuest => ({ table:'ota_bookings', id:o.id, name:o.guest_name||'Guest', quantity:o.quantity, email:o.guest_email||null, sentAt:o.meetup_sent_at??null, attendance:o.attendance_status })),
                ]}
                blockers={meetupIssues.filter(i => !i.startsWith('There are no confirmed guests'))}
                palette={MEETUP_PALETTE}
                onSent={() => { loadDetail(); onUpdate() }}
              />
            </div>
          </div>
        </div>

        {/* Revenue */}
        <div style={{ ...S.card, marginBottom:'16px' }}>
          <p style={{ ...S.label, marginBottom:'16px' }}>REVENUE</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            {[
              { label:'Website', val:`฿${webRev.toLocaleString()}`, sub:`${webGuests} guests` },
              { label:'OTA / Direct', val:`฿${otaRev.toLocaleString()}`, sub:`${otaGuests} guests` },
              { label:'Total Revenue', val:`฿${totalRev.toLocaleString()}`, sub:`${totalGuests} total` },
              { label:'Gross Profit', val:`฿${profit.toLocaleString()}`, sub:'after host fee + expenses', color: profit>=0?'#22c55e':'#EA003A' },
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
                  {attendeeLine(b) && <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.6)', marginTop:'2px' }}>Guests: {attendeeLine(b)}</p>}
                </div>
                <p style={{ fontWeight:600, fontSize:'14px', color:'#fff' }}>฿{b.total_paid.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* OTA bookings */}
        <div style={{ ...S.card, marginBottom:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <p style={{ ...S.label, margin:0 }}>OTA / DIRECT BOOKINGS ({otaGuests} guests)</p>
            <button onClick={() => { closeOtaForm(); setAddingOTA(true) }} style={{ ...S.btn, ...S.btnDanger, height:'30px', padding:'0 12px' }}>+ Add</button>
          </div>
          {addingOTA && (
            <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:'8px', padding:'16px', marginBottom:'16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div>
                  <label style={S.label}>SOURCE</label>
                  <select value={otaForm.source} onChange={e => setOtaForm(f=>({...f,source:e.target.value}))} style={S.input}>
                    {['klook','airbnb','getyourguide','viator','eventbrite','direct'].map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>GUEST NAME</label>
                  <input value={otaForm.guest_name} onChange={e=>setOtaForm(f=>({...f,guest_name:e.target.value}))} style={S.input} placeholder="Name"/>
                </div>
                <div>
                  <label style={S.label}>GUEST EMAIL (OPTIONAL)</label>
                  <input value={otaForm.guest_email} onChange={e=>setOtaForm(f=>({...f,guest_email:e.target.value}))} style={S.input} placeholder="For confirmed-meetup email"/>
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
                <button onClick={addOTA} disabled={savingForm!==null} style={{ ...S.btn, ...S.btnRed, opacity: savingForm ? 0.6 : 1 }}>{savingForm==='ota' ? 'Saving…' : editingOtaId ? 'Save changes' : 'Save'}</button>
                <button onClick={closeOtaForm} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              </div>
            </div>
          )}
          {otaBookings.length===0 && !addingOTA && <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>No OTA or direct bookings added.</p>}
          {otaBookings.map(b => (
            <div key={b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'10px', marginBottom:'10px' }}>
              <div>
                <p style={{ fontWeight:600, fontSize:'13px', color:'#fff' }}>{b.guest_name||'Guest'}</p>
                <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', marginTop:'2px' }}>{b.source} · {b.quantity} ticket{b.quantity>1?'s':''}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <p style={{ fontWeight:600, fontSize:'13px', color:'#fff', margin:0 }}>฿{(b.total_paid||0).toLocaleString()}</p>
                <button onClick={() => startEditOTA(b)} title="Edit booking" style={{ ...S.btn, ...S.btnGhost, height:'30px', padding:'0 10px', fontSize:'12px' }}>Edit</button>
                <button onClick={() => deleteOTABooking(b)} title="Remove booking" style={{ ...S.btn, ...S.btnGhost, height:'30px', padding:'0 10px', fontSize:'12px', color:'#EA003A', borderColor:'rgba(234,0,58,0.35)' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>

        {/* Expenses */}
        <div style={{ ...S.card, marginBottom:'40px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <p style={{ ...S.label, margin:0 }}>EXPENSES (฿{totalExp.toLocaleString()})</p>
            <button onClick={()=>{ closeExpForm(); setAddingExp(true) }} style={{ ...S.btn, ...S.btnDanger, height:'30px', padding:'0 12px' }}>+ Add</button>
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
                <button onClick={addExpense} disabled={savingForm!==null} style={{ ...S.btn, ...S.btnRed, opacity: savingForm ? 0.6 : 1 }}>{savingForm==='exp' ? 'Saving…' : editingExpId ? 'Save changes' : 'Save'}</button>
                <button onClick={closeExpForm} style={{ ...S.btn, ...S.btnGhost }}>Cancel</button>
              </div>
            </div>
          )}
          {expenses.length===0 && !addingExp && <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.35)' }}>No expenses logged.</p>}
          {expenses.map(e => (
            <div key={e.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', borderBottom:'1px solid rgba(255,255,255,0.06)', paddingBottom:'10px', marginBottom:'10px' }}>
              <div>
                <p style={{ fontWeight:600, fontSize:'13px', color:'#fff', textTransform:'capitalize' }}>{e.category.replace('_',' ')}</p>
                {e.description && <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', marginTop:'2px' }}>{e.description}</p>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <p style={{ fontWeight:600, fontSize:'13px', color:'#EA003A', margin:0 }}>฿{e.amount.toLocaleString()}</p>
                <button onClick={() => startEditExpense(e)} title="Edit expense" style={{ ...S.btn, ...S.btnGhost, height:'30px', padding:'0 10px', fontSize:'12px' }}>Edit</button>
                <button onClick={() => deleteExpense(e)} title="Delete expense" style={{ ...S.btn, ...S.btnGhost, height:'30px', padding:'0 10px', fontSize:'12px', color:'#EA003A', borderColor:'rgba(234,0,58,0.35)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'mission'|'calendar'|'bookings'|'operations'>('mission')
  const [myName, setMyName] = useState<string|null>(null)
  // Deep link from Mission Control: /dashboard?night=<id>&date=YYYY-MM-DD opens that night's panel.
  const [openNightId, setOpenNightId] = useState<string|null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // Links from the menu on other pages: /dashboard?tab=bookings | operations
  // Re-read on every change of the address, so links from Mission Control
  // (same page, new ?night= / ?tab=) work without a reload.
  const searchParams = useSearchParams()
  const searchKey = searchParams?.toString() ?? ''
  useEffect(() => {
    const q = new URLSearchParams(searchKey)
    const t = q.get('tab')
    if (t === 'calendar' || t === 'bookings' || t === 'operations') setActiveTab(t)
    const night = q.get('night'), date = q.get('date')
    if (night) {
      setActiveTab('calendar')
      setOpenNightId(night)
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) { setCalYear(Number(date.slice(0, 4))); setCalMonth(Number(date.slice(5, 7)) - 1) }
    }
  }, [searchKey])

  // The /dashboard layout redirects hosts ('staff') on a full page load,
  // but an in-app link (e.g. "Back" on the scanner) navigates client-side
  // and skips the layout. Send a host back to their own view here too; the
  // data routes behind this page are owner/admin-only regardless.
  useEffect(() => {
    fetch('/api/admin/session', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(s => { if (s?.role === 'staff') window.location.replace('/dashboard/host'); else setMyName(s?.displayName ?? null) })
      .catch(() => {})
  }, [])
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [events, setEvents] = useState<EventDate[]>([])
  const [allBookings, setAllBookings] = useState<Booking[]>([])
  const [bookingEvent, setBookingEvent] = useState('all')
  const [bookingDate, setBookingDate] = useState('upcoming')
  const [bookingStatus, setBookingStatus] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState<EventDate|null>(null)
  // "Add a night" (Nov 2026): the empty upcoming day that was tapped.
  const [addNightDate, setAddNightDate] = useState<string|null>(null)
  useEffect(() => { if (selectedEvent) setAddNightDate(null) }, [selectedEvent])
  const [loading, setLoading] = useState(false)
  const [resendState, setResendState] = useState<Record<string,'idle'|'sending'|'sent'|'error'>>({})
  const [rescheduleOpen, setRescheduleOpen] = useState<Record<string,boolean>>({})
  const [rescheduleDate, setRescheduleDate] = useState<Record<string,string>>({})
  // Events on the chosen reschedule date, so a guest is moved onto a real
  // night (date + night), not just a new date on their old night.
  const [rescheduleEvents, setRescheduleEvents] = useState<Record<string,EventDate[]|null>>({})
  const [rescheduleEventId, setRescheduleEventId] = useState<Record<string,string>>({})
  const [rescheduleError, setRescheduleError] = useState<Record<string,string>>({})
  const [rescheduleMsg, setRescheduleMsg] = useState<Record<string,string>>({})
  const [proposalSent, setProposalSent] = useState<Record<string,string>>({})
  const [cancelConfirm, setCancelConfirm] = useState<Record<string,boolean>>({})
  const [actionState, setActionState] = useState<Record<string,'idle'|'sending'|'done'|'error'>>({})


  // Bookings tab filters (client-side; the list is already loaded).
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const filteredBookings = allBookings.filter(b => {
    if (bookingEvent !== 'all' && b.night_name !== bookingEvent) return false
    if (bookingStatus !== 'all' && b.status !== bookingStatus) return false
    if (bookingDate === 'upcoming') return b.event_date >= todayIso
    if (bookingDate === 'past') return b.event_date < todayIso
    if (bookingDate !== 'all') return b.event_date === bookingDate
    return true
  })

  const loadEvents = useCallback(async () => {
    setLoading(true)
    const start = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`
    const end = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${new Date(calYear,calMonth+1,0).getDate()}`
    // Deterministic order: open events first, then oldest-created within a
    // date/slug tie, so which event a day's dot/pill defaults to never
    // depends on Postgres's unordered-scan return order (was the root
    // cause of a real bug: Sept 1 New in Bangkok + a long-closed legacy
    // Solo Night both fall on the same date, and an unordered fetch
    // happened to return the closed one first).
    const res = await fetch(`/api/admin/dashboard/events?start=${start}&end=${end}`)
    const data = await res.json().catch(() => ({} as any))
    setEvents(data.events||[])
    setLoading(false)
  }, [calYear, calMonth])
  useEffect(() => {
    if (!openNightId) return
    const ev = events.find(e => e.id === openNightId)
    if (ev) {
      setSelectedEvent(ev); setOpenNightId(null)
      // Clear ?night= so the same Mission Control link works again next time.
      window.history.replaceState(null, '', '/dashboard?tab=calendar')
    }
  }, [events, openNightId])

  const loadBookings = useCallback(async () => {
    const res = await fetch('/api/admin/dashboard/bookings')
    const data = await res.json().catch(() => ({} as any))
    setAllBookings(data.bookings||[])
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

  async function chooseRescheduleDate(bookingId: string, date: string) {
    setRescheduleDate(s => ({ ...s, [bookingId]: date }))
    setRescheduleEventId(s => ({ ...s, [bookingId]: '' }))
    setRescheduleError(s => ({ ...s, [bookingId]: '' }))
    setRescheduleEvents(s => ({ ...s, [bookingId]: null }))
    if (!date) return
    const res = await fetch(`/api/admin/dashboard/events?start=${date}&end=${date}`).catch(() => null)
    const data = res ? await res.json().catch(() => ({} as any)) : {}
    const evs: EventDate[] = data.events || []
    setRescheduleEvents(s => ({ ...s, [bookingId]: evs }))
    // Ordered open-first by the API; preselect the first one.
    if (evs.length > 0) setRescheduleEventId(s => ({ ...s, [bookingId]: evs[0].id }))
  }

  async function rescheduleBooking(bookingId: string) {
    const newDate = rescheduleDate[bookingId]
    const newEventId = rescheduleEventId[bookingId]
    if (!newDate || !newEventId) return
    setActionState(s => ({ ...s, [bookingId]: 'sending' }))
    setRescheduleError(s => ({ ...s, [bookingId]: '' }))
    try {
      const res = await fetch('/api/reschedule-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, newDate, newEventId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setActionState(s => ({ ...s, [bookingId]: 'done' }))
        setRescheduleOpen(s => ({ ...s, [bookingId]: false }))
        loadBookings()
        loadEvents()
        setTimeout(() => setActionState(s => ({ ...s, [bookingId]: 'idle' })), 3000)
      } else {
        setRescheduleError(s => ({ ...s, [bookingId]: data.error || 'Failed — try again' }))
        setActionState(s => ({ ...s, [bookingId]: 'error' }))
      }
    } catch {
      setActionState(s => ({ ...s, [bookingId]: 'error' }))
    }
  }

  // Propose the new night to the guest by email: they accept it, keep it as
  // credit, or ask for a refund (lib/bookingOptions.ts proposeDate).
  async function proposeToGuest(bookingId: string) {
    const newEventId = rescheduleEventId[bookingId]
    if (!newEventId) return
    setActionState(s => ({ ...s, [bookingId]: 'sending' }))
    setRescheduleError(s => ({ ...s, [bookingId]: '' }))
    const res = await fetch('/api/admin/propose-date', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, newEventId, message: rescheduleMsg[bookingId] || null }) }).catch(() => null)
    const data = res ? await res.json().catch(() => ({} as any)) : { error: 'Connection problem' }
    if (res?.ok) {
      setActionState(s => ({ ...s, [bookingId]: 'idle' }))
      setRescheduleOpen(s => ({ ...s, [bookingId]: false }))
      setProposalSent(s => ({ ...s, [bookingId]: data.email === 'sent' ? '✓ New date sent to the guest — waiting for their answer.' : `Proposal created, but the email didn’t send. Send them this link: ${data.link}` }))
    } else {
      setRescheduleError(s => ({ ...s, [bookingId]: data.error || 'Failed — try again' }))
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

  useEffect(() => { loadEvents(); loadBookings() }, [loadEvents, loadBookings])


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
    'club-crawl': '#0891B2',
    'saturday-signature': '#EA003A',
    'lgbtplus-night': '#7C3AED',
  }

  return (
    <div style={S.page}>
      {/* Nav — stacks into 3 rows (branding / tabs / month nav) under the
          sm breakpoint, exactly one row above it (unchanged desktop
          layout). Layout props (display/direction/align/justify/gap/height)
          live in the className, not inline style, because an inline style
          always wins over a class for the same property — keeping them
          inline would silently defeat the sm: breakpoint overrides. */}
      <div className="flex flex-col gap-3 py-3 px-4 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0 sm:px-6" style={{ background:'rgba(26,0,21,0.98)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between sm:block">
          <a href="/dashboard" aria-label="Dashboard home" style={{ display:'flex', alignItems:'center' }}><img src="/images/bcc-logo.png" alt="Bangkok Club Crawl" style={{ height: '40px', width: 'auto', display: 'block' }} /></a>
          {/* Mobile: one ☰ menu instead of a long row of buttons (Nov 2026). */}
          <button type="button" className="sm:hidden" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}
            style={{ ...S.btn, ...S.btnGhost, padding:'0 12px', fontSize:'18px', lineHeight:1 }}>
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
        {menuOpen && (
          <div className="sm:hidden" style={{ display:'grid', gap:'4px', padding:'8px', borderRadius:'10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
            {(['mission','calendar','bookings','operations'] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setMenuOpen(false) }} style={{
                ...S.btn, ...(activeTab===tab ? S.btnRed : S.btnGhost), justifyContent:'flex-start', width:'100%', textAlign:'left',
              }}>
                {tab === 'mission' ? '🛰️ Mission Control' : tab === 'calendar' ? '📅 Calendar' : tab === 'bookings' ? '📋 Bookings' : '📊 Operations'}
              </button>
            ))}
            {([['/dashboard/bokun','🔄 Bókun'],['/dashboard/leads','📨 Leads'],['/dashboard/products','🧩 Products'],['/dashboard/reports','📝 Reports'],['/dashboard/commissions','💸 Commission'],['/dashboard/host','🎤 Host view'],['/dashboard/team','👥 Team']] as const).map(([href,label]) => (
              <Link key={href} href={href} style={{ ...S.btn, ...S.btnGhost, display:'flex', alignItems:'center', textDecoration:'none', width:'100%' }}>{label}</Link>
            ))}
          </div>
        )}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {(['mission','calendar','bookings','operations'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              ...S.btn,
              ...(activeTab===tab ? S.btnRed : S.btnGhost),
              textTransform:'capitalize',
            }}>
              {tab === 'mission' ? '🛰️ Mission Control' : tab === 'calendar' ? '📅 Calendar' : tab === 'bookings' ? '📋 Bookings' : '📊 Operations'}
            </button>
          ))}
          <Link href="/dashboard/products" style={{ ...S.btn, ...S.btnGhost, display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
            🧩 Products
          </Link>
          <Link href="/dashboard/host" style={{ ...S.btn, ...S.btnGhost, display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
            🎤 Host view
          </Link>
          <Link href="/dashboard/team" style={{ ...S.btn, ...S.btnGhost, display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
            👥 Team
          </Link>
          <Link href="/dashboard/leads" style={{ ...S.btn, ...S.btnGhost, display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
            📨 Leads
          </Link>
          <Link href="/dashboard/bokun" style={{ ...S.btn, ...S.btnGhost, display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
            🔄 Bókun
          </Link>
          <Link href="/dashboard/reports" style={{ ...S.btn, ...S.btnGhost, display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
            📝 Reports
          </Link>
          <Link href="/dashboard/commissions" style={{ ...S.btn, ...S.btnGhost, display:'inline-flex', alignItems:'center', textDecoration:'none' }}>
            💸 Commission
          </Link>
        </div>
        <div className={`${activeTab === 'mission' ? 'hidden' : 'flex'} items-center justify-center gap-3`}>
          <button onClick={prevMonth} style={{ ...S.btn, ...S.btnGhost, padding:'0 12px' }}>‹</button>
          <span style={{ fontWeight:600, fontSize:'15px', minWidth:'140px', textAlign:'center' }}>{MONTH_NAMES[calMonth]} {calYear}</span>
          <button onClick={nextMonth} style={{ ...S.btn, ...S.btnGhost, padding:'0 12px' }}>›</button>
        </div>
      </div>

      {/* Calendar Tab */}
      {activeTab === 'mission' && <MissionControl name={myName} />}

      {activeTab === 'calendar' && (
        <div
          className="px-2 py-3 sm:px-6 sm:py-6"
          style={{
            // Reserves room for the fixed-position EventPanel on desktop
            // (420px + margin). On any viewport under ~440px wide this calc()
            // alone goes negative — invalid, and the actual cause of the
            // reported "calendar needs landscape" overflow. CSS max() floors
            // it at 280px (comfortably fits a 7-column grid) without changing
            // the desktop value at all, since calc(100% - 440px) is already
            // well above 280px on any screen wide enough to show the panel
            // beside the calendar in the first place.
            maxWidth: selectedEvent ? 'max(280px, calc(100% - 440px))' : '900px',
            margin:'0 auto',
            transition:'max-width 0.2s',
          }}
        >
          {/* Day labels */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginBottom:'6px' }}>
            {DAY_LABELS.map(d => (
              <div key={d} className="py-1 sm:py-2" style={{ textAlign:'center', fontWeight:600, fontSize:'11px', color:'rgba(255,255,255,0.30)' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid — compact dots-only on mobile (native month-
              overview density: date number + small colored dots per event,
              no names), the original name-labeled pills unchanged from the
              sm breakpoint up. Both variants are always in the DOM; only
              className (hidden / sm:hidden) picks which one paints, so
              there's no client-only media-query state and no hydration
              mismatch. */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px' }}>
            {/* Empty offset cells */}
            {Array.from({length:offset}).map((_,i) => <div key={`e${i}`} />)}

            {/* Day cells */}
            {Array.from({length:daysInMonth}).map((_,i) => {
              const day = i+1
              const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const dayEvents = eventsByDate[dateStr] || []
              // A closed, still-Pending-verdict event has never had any real
              // operational activity — treat it as legacy noise on mobile's
              // tiny dot row rather than an equal, normal-weight selectable
              // event. Anything open, or anything a human has touched (verdict
              // moved off the default), stays fully prominent. Reused from the
              // same signal Stage 9l's Host Operations filter already uses
              // (operation_verdict !== 'Pending') — no new query, only fields
              // already loaded here.
              const prominentEvents = dayEvents.filter(ev => ev.is_open || ev.operation_verdict !== 'Pending')
              const legacyEvents = dayEvents.filter(ev => !ev.is_open && ev.operation_verdict === 'Pending')
              // Mobile shows legacy dots only when there's nothing prominent
              // that day, so a day is never silently empty; desktop pills are
              // unaffected (still list every event, unchanged).
              const mobileDayEvents = prominentEvents.length > 0 ? prominentEvents : legacyEvents
              const isPast = new Date(dateStr+'T00:00:00') < today
              const isToday = new Date(dateStr+'T00:00:00').toDateString() === today.toDateString()
              const isSelected = selectedEvent?.event_date === dateStr

              return (
                <div
                  key={day}
                  className="min-h-[40px] sm:min-h-[80px] p-1 sm:p-2"
                  style={{
                    borderRadius:'10px',
                    background: isSelected ? 'rgba(234,0,58,0.10)' : isToday ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: isSelected ? '1px solid rgba(234,0,58,0.40)' : isToday ? '1px solid rgba(234,0,58,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: dayEvents.length > 0 || !isPast ? 'pointer' : 'default',
                    opacity: isPast ? 0.5 : 1,
                    transition:'all 0.15s',
                  }}
                  onClick={() => {
                    // Fallback for a tap that lands on the cell but not on a
                    // specific dot/pill (e.g. the day number, empty space).
                    // Deterministic now that dayEvents is ordered open-first:
                    // prefers the prominent/open event over a closed legacy
                    // one instead of whatever Postgres happened to return
                    // first.
                    const fallback = prominentEvents[0] || dayEvents[0]
                    if (fallback) setSelectedEvent(fallback)
                    // Empty upcoming day: add a Club Crawl night here.
                    else if (!isPast) { setSelectedEvent(null); setAddNightDate(dateStr) }
                  }}
                >
                  {/* Day number */}
                  <div className="mb-0.5 sm:mb-1.5" style={{
                    fontWeight: isToday ? 700 : 400,
                    fontSize:'13px',
                    color: isToday ? '#EA003A' : 'rgba(255,255,255,0.60)',
                    textAlign:'center',
                  }}>{day}</div>

                  {/* Mobile: dots only, no names/text. Each dot is its own
                      event_dates record and independently tappable (was the
                      bug: only the whole cell was clickable, always opening
                      dayEvents[0] no matter which dot you touched). Legacy
                      (closed + never-touched) events only appear here when
                      there's nothing prominent that day. */}
                  {mobileDayEvents.length > 0 && (
                    <div className="flex sm:hidden" style={{ justifyContent:'center', flexWrap:'wrap', gap:'3px' }}>
                      {mobileDayEvents.map(ev => (
                        <div
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                          // Invisible padded wrapper gives a real finger-sized
                          // tap target around the small visible dot inside it.
                          style={{ padding:'6px', margin:'-6px' }}
                        >
                          <div
                            style={{
                              width: ev.is_open ? '6px' : '4px',
                              height: ev.is_open ? '6px' : '4px',
                              borderRadius:'50%',
                              background: ev.is_open ? (nightColors[ev.night_slug]||'#EA003A') : 'transparent',
                              border: ev.is_open ? 'none' : '1px solid rgba(255,255,255,0.30)',
                              opacity: ev.is_open ? 1 : 0.6,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Desktop: full name-labeled pills, unchanged */}
                  <div className="hidden sm:block">
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
                </div>
              )
            })}
          </div>

          {/* Legend — compacted on mobile (smaller gap/padding) only; the
              swatch shape/labels are untouched (still the original square
              pills, not the new mobile dots) since the desktop legend
              doesn't need to change beyond spacing. Color meaning unchanged. */}
          <div className="flex flex-wrap gap-2 mt-4 p-3 sm:gap-3 sm:mt-6 sm:p-4" style={{ background:'rgba(255,255,255,0.02)', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.05)' }}>
            {/* Current night types only (Nov 2026); older themes keep their colour on past dates. */}
            {([['tgif','TGIF'],['saturday-signature','Signature Night'],['club-crawl','Bangkok Club Crawl']] as const).map(([slug,name]) => {
              const color = nightColors[slug]
              return (
                <div key={slug} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:color, flexShrink:0 }} />
                  <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.40)' }}>{name}</span>
                </div>
              )
            })}
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <div style={{ width:'10px', height:'10px', borderRadius:'3px', background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.20)', flexShrink:0 }} />
              <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.40)' }}>Closed</span>
            </div>
          </div>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div style={{ padding:'24px', maxWidth:'900px', margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
            <h1 style={{ fontWeight:600, fontSize:'20px', margin:0 }}>Bookings</h1>
            <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.40)' }}>
              {filteredBookings.filter(b => b.status === 'confirmed').length} confirmed · {filteredBookings.filter(b => b.status === 'cancelled').length} cancelled
            </p>
          </div>

          <OtaImport />

          {allBookings.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:'10px', marginBottom:'16px' }}>
              <select value={bookingEvent} onChange={e => setBookingEvent(e.target.value)} style={{ ...S.input, width:'auto', minWidth:'180px', flex:'1 1 180px' }} aria-label="Filter by event">
                <option value="all">All events</option>
                {Array.from(new Set(allBookings.map(b => b.night_name).filter(Boolean))).sort().map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select value={bookingDate} onChange={e => setBookingDate(e.target.value)} style={{ ...S.input, width:'auto', minWidth:'160px', flex:'1 1 160px' }} aria-label="Filter by date">
                <option value="upcoming">Upcoming dates</option>
                <option value="past">Past dates</option>
                <option value="all">All dates</option>
                {Array.from(new Set(allBookings.map(b => b.event_date))).sort().map(d => (
                  <option key={d} value={d}>{new Date(d+'T00:00:00').toLocaleDateString('en',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</option>
                ))}
              </select>
              <select value={bookingStatus} onChange={e => setBookingStatus(e.target.value)} style={{ ...S.input, width:'auto', minWidth:'140px', flex:'1 1 140px' }} aria-label="Filter by status">
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {allBookings.length === 0 && (
            <div style={{ ...S.card, textAlign:'center', padding:'48px' }}>
              <p style={{ color:'rgba(255,255,255,0.40)' }}>No bookings yet.</p>
            </div>
          )}

          {allBookings.length > 0 && filteredBookings.length === 0 && (
            <div style={{ ...S.card, textAlign:'center', padding:'32px' }}>
              <p style={{ color:'rgba(255,255,255,0.40)', margin:0 }}>No bookings match these filters.</p>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {filteredBookings.map(b => {
              const dateObj = new Date(b.event_date+'T00:00:00')
              const formattedDate = dateObj.toLocaleDateString('en',{weekday:'short',day:'numeric',month:'short'})
              const cancelled = b.status === 'cancelled'
              return (
                <div key={b.id} style={{ ...S.card, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'12px', ...(cancelled ? { opacity:0.55 } : {}) }}>
                  <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                    {/* Date badge */}
                    <div style={{ background:'linear-gradient(135deg,#EA003A,#820065)', borderRadius:'8px', padding:'6px 12px', textAlign:'center', flexShrink:0 }}>
                      <p style={{ fontWeight:700, fontSize:'16px', color:'#fff', margin:0, lineHeight:1 }}>{dateObj.getDate()}</p>
                      <p style={{ fontWeight:600, fontSize:'9px', color:'rgba(255,255,255,0.80)', margin:0, letterSpacing:'0.1em' }}>{dateObj.toLocaleString('en',{month:'short'}).toUpperCase()}</p>
                    </div>
                    <div>
                      <p style={{ fontWeight:600, fontSize:'14px', color:'#fff', margin:'0 0 3px' }}>
                        {b.guest_name||b.guest_email}
                        {cancelled && (
                          <span style={{ marginLeft:'8px', fontSize:'10px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color:'#EA003A', border:'1px solid rgba(234,0,58,0.5)', borderRadius:'4px', padding:'1px 6px' }}>
                            {cancelledLabel(b)}
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.45)', margin:0 }}>
                        {b.night_name} · {formattedDate}
                      </p>
                      <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.35)', margin:'2px 0 0', overflowWrap:'anywhere' }}>
                        {b.guest_email} · {b.guest_phone}
                      </p>
                    </div>
                  </div>
                  {/* Wraps on phones so the buttons never run off the screen. */}
                  <div style={{ display:'flex', gap:'10px 16px', alignItems:'center', flexWrap:'wrap', minWidth:0, maxWidth:'100%' }}>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ fontWeight:700, fontSize:'16px', color:'#fff', margin:0 }}>฿{b.total_paid.toLocaleString()}</p>
                      <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.40)', margin:'2px 0 0' }}>
                        {b.quantity} ticket{b.quantity>1?'s':''} · {b.source}
                        {b.promo_code && ` · ${b.promo_code}`}
                      </p>
                    </div>
                    {!cancelled && (
                    <>
                    <button
                onClick={() => resendConfirmation(b.id)}
                disabled={resendState[b.id]==='sending'}
                style={{ ...S.btn, ...S.btnGhost, height:'30px', padding:'0 12px', fontSize:'12px' }}
              >
                {resendState[b.id]==='sending' ? 'Sending…' : resendState[b.id]==='sent' ? '✓ Sent' : resendState[b.id]==='error' ? 'Failed — Retry' : 'Resend Email'}
              </button>
              {whatsappUrl(b) && (
                <a href={whatsappUrl(b)!} target="_blank" rel="noopener noreferrer"
                  style={{ ...S.btn, height:'30px', padding:'0 12px', fontSize:'12px', display:'inline-flex', alignItems:'center', textDecoration:'none', background:'#25D366', color:'#062b14', fontWeight:600 }}>
                  WhatsApp
                </a>
              )}
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
                    </>
                    )}
                    <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: cancelled ? 'rgba(255,255,255,0.25)' : '#22c55e', flexShrink:0 }} />
                  </div>

                  {rescheduleOpen[b.id] && (
                    <div style={{ width:'100%', marginTop:'4px', paddingTop:'14px', borderTop:'1px solid rgba(255,255,255,0.06)', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center' }}>
                      <label style={{ ...S.label, marginBottom:0 }}>NEW DATE</label>
                      <input
                        type="date"
                        value={rescheduleDate[b.id] || ''}
                        onChange={e => chooseRescheduleDate(b.id, e.target.value)}
                        style={{ ...S.input, maxWidth:'180px' }}
                      />
                      {rescheduleDate[b.id] && rescheduleEvents[b.id] && rescheduleEvents[b.id]!.length === 0 && (
                        <p style={{ color:'#f59e0b', fontSize:'12px', margin:0, width:'100%' }}>No event on this date. Open the date in the calendar first.</p>
                      )}
                      {rescheduleEvents[b.id] && rescheduleEvents[b.id]!.length > 0 && (
                        <select
                          value={rescheduleEventId[b.id] || ''}
                          onChange={e => setRescheduleEventId(s => ({ ...s, [b.id]: e.target.value }))}
                          style={{ ...S.input, maxWidth:'240px' }}
                        >
                          {rescheduleEvents[b.id]!.map(ev => (
                            <option key={ev.id} value={ev.id}>{ev.night_name}{ev.is_open ? '' : ' (closed)'}</option>
                          ))}
                        </select>
                      )}
                      <textarea
                        rows={2}
                        value={rescheduleMsg[b.id] || ''}
                        onChange={e => setRescheduleMsg(s => ({ ...s, [b.id]: e.target.value }))}
                        placeholder="Message to the guest (optional) — e.g. why we need to move"
                        maxLength={1000}
                        style={{ ...S.input, width:'100%', height:'auto', padding:'8px 12px', fontFamily:'Inter, sans-serif' }}
                      />
                      <button
                        onClick={() => proposeToGuest(b.id)}
                        disabled={!rescheduleDate[b.id] || !rescheduleEventId[b.id] || actionState[b.id]==='sending'}
                        style={{ ...S.btn, ...S.btnRed }}
                      >
                        {actionState[b.id]==='sending' ? 'Sending…' : 'Send new date to guest'}
                      </button>
                      <button
                        onClick={() => confirm('Move this booking now? Only do this if the guest already agreed — they’ll get the new ticket by email.') && rescheduleBooking(b.id)}
                        disabled={!rescheduleDate[b.id] || !rescheduleEventId[b.id] || actionState[b.id]==='sending'}
                        style={{ ...S.btn, ...S.btnGhost }}
                      >
                        Move now (guest agreed)
                      </button>
                      <p style={{ width:'100%', margin:0, fontSize:'12px', color:'rgba(255,255,255,0.5)' }}>The guest gets an email to accept the new date, keep it as credit, or ask for a full refund. No answer in 48 h → credit.</p>
                      <button onClick={() => setRescheduleOpen(s => ({ ...s, [b.id]: false }))} style={{ ...S.btn, ...S.btnGhost }}>
                        Never mind
                      </button>
                      {actionState[b.id]==='error' && <p style={{ color:'#EA003A', fontSize:'12px', margin:0 }}>{rescheduleError[b.id] || 'Failed — try again'}</p>}
                    </div>
                  )}

                  {proposalSent[b.id] && <p style={{ width:'100%', margin:'4px 0 0', fontSize:'12px', color:'#6EE7B7', overflowWrap:'anywhere' }}>{proposalSent[b.id]}</p>}

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

      {activeTab === 'operations' && (
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'20px 16px 60px' }}>
          <p style={{ ...S.eyebrow, marginBottom:'4px' }}>OPERATIONS SHEET</p>
          <h2 style={{ fontWeight:600, fontSize:'20px', margin:'0 0 16px' }}>Every event: host, route, guests, money</h2>
          <OperationsSheet palette={OPS_PALETTE} eventHref={r => `/operator/manage/events/${r.id}`} />
        </div>
      )}

      {/* Add a night on an empty day */}
      {addNightDate && activeTab==='calendar' && (
        <AddNightPanel
          date={addNightDate}
          onClose={() => setAddNightDate(null)}
          onCreated={async (ev) => {
            setAddNightDate(null)
            await loadEvents()
            setSelectedEvent(ev)
          }}
        />
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
