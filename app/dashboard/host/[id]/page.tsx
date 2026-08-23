'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Guest {
  id: string
  source: string
  guestName: string
  quantity: number
  attendanceStatus: string
  table: 'bookings' | 'ota_bookings'
}

interface Expense {
  id: string
  category: string
  description: string | null
  amount: number
}

interface HostEventDetail {
  event: {
    id: string
    eventDate: string
    nightName: string
    nightSlug: string
    isOpen: boolean
    meetUpLocation: string | null
    whatsappGroupLink: string | null
    venueRoute: Record<string, string> | null
    vanOrTaxiContact: string | null
    specialNotes: string | null
    operationVerdict: string
  }
  guests: Guest[]
  headcount: { total: number; checkedIn: number }
  expenses: Expense[]
}

const EXPENSE_CATEGORIES = ['van', 'host_pay', 'drinks', 'cover_charge', 'extra']

// Stage 9j — the restricted Host operational view. Deliberately shows no
// revenue, total_paid, host fee, or profit anywhere — that data is never
// even fetched by the API route this page calls (see its doc comment for
// the RLS caveat this does NOT fix). Everything here is read/write through
// EXISTING shared endpoints (update-attendance, this event's own expenses
// route) — no separate host data model.
export default function HostEventDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<HostEventDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'forbidden' | 'error'>('loading')
  const [addingExpense, setAddingExpense] = useState(false)
  const [expForm, setExpForm] = useState({ category: 'van', description: '', amount: '' })

  function load() {
    fetch(`/api/admin/host/events/${params.id}`)
      .then(async (res) => {
        if (res.status === 404) return setState('notfound')
        if (res.status === 403) return setState('forbidden')
        if (!res.ok) return setState('error')
        setData(await res.json())
        setState('ready')
      })
      .catch(() => setState('error'))
  }

  useEffect(load, [params.id])

  async function updateAttendance(guest: Guest, status: string) {
    await fetch('/api/update-attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: guest.table, id: guest.id, status }),
    })
    load()
  }

  async function addExpense() {
    const res = await fetch(`/api/admin/host/events/${params.id}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...expForm, amount: parseInt(expForm.amount) || 0 }),
    })
    if (res.ok) {
      setAddingExpense(false)
      setExpForm({ category: 'van', description: '', amount: '' })
      load()
    }
  }

  const S = {
    page: { minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 20px' },
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px', marginBottom: '14px' },
    label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', marginBottom: '8px' },
    input: { width: '100%', height: '38px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none' },
    btn: { height: '36px', padding: '0 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px' },
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <Link href="/dashboard/host" style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>
          ← Your Events
        </Link>

        {state === 'loading' && <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '14px' }}>Loading…</p>}
        {state === 'notfound' && <p style={{ color: '#EA003A', fontSize: '14px' }}>Event not found.</p>}
        {state === 'forbidden' && <p style={{ color: '#EA003A', fontSize: '14px' }}>This event isn&apos;t assigned to you.</p>}
        {state === 'error' && <p style={{ color: '#EA003A', fontSize: '14px' }}>Something went wrong. Please try again.</p>}

        {state === 'ready' && data && (
          <>
            <h1 style={{ fontSize: '20px', margin: '0 0 4px' }}>{data.event.nightName}</h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', marginBottom: '20px' }}>
              {new Date(data.event.eventDate + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}
              {!data.event.isOpen && ' · Closed'}
            </p>

            <Link
              href="/dashboard/checkin"
              style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: '8px', marginBottom: '20px', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}
            >
              Scan Ticket
            </Link>

            {/* Operational brief — read-only for a Host */}
            <div style={S.card}>
              <p style={S.label}>Operational Brief</p>
              {data.event.meetUpLocation && <p style={{ fontSize: '13px', marginBottom: '6px' }}><strong>Meet-up:</strong> {data.event.meetUpLocation}</p>}
              {data.event.whatsappGroupLink && (
                <p style={{ fontSize: '13px', marginBottom: '6px' }}>
                  <strong>WhatsApp:</strong> <a href={data.event.whatsappGroupLink} style={{ color: '#EA003A' }}>{data.event.whatsappGroupLink}</a>
                </p>
              )}
              {data.event.vanOrTaxiContact && <p style={{ fontSize: '13px', marginBottom: '6px' }}><strong>Van/Taxi:</strong> {data.event.vanOrTaxiContact}</p>}
              {data.event.venueRoute && Object.values(data.event.venueRoute).some(Boolean) && (
                <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                  <strong>Route:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: '18px', color: 'rgba(255,255,255,0.75)' }}>
                    {Object.entries(data.event.venueRoute).filter(([, v]) => v).map(([k, v]) => <li key={k}>{v}</li>)}
                  </ul>
                </div>
              )}
              {data.event.specialNotes && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.70)' }}><strong>Notes:</strong> {data.event.specialNotes}</p>}
              {!data.event.meetUpLocation && !data.event.whatsappGroupLink && !data.event.vanOrTaxiContact && !data.event.specialNotes && (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)' }}>No operational details set yet.</p>
              )}
            </div>

            {/* Guest list */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <p style={{ ...S.label, marginBottom: 0 }}>Guests</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.60)' }}>{data.headcount.checkedIn} / {data.headcount.total} checked in</p>
              </div>
              {data.guests.length === 0 && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>No guests yet.</p>}
              {data.guests.map((g) => (
                <div key={`${g.table}-${g.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '8px' }}>
                  <p style={{ fontSize: '13px', color: '#fff', margin: 0, flex: 1 }}>{g.guestName} <span style={{ color: 'rgba(255,255,255,0.35)' }}>· {g.quantity}</span></p>
                  <select
                    value={g.attendanceStatus}
                    onChange={(e) => updateAttendance(g, e.target.value)}
                    style={{ ...S.input, height: '30px', fontSize: '12px', width: '130px' }}
                  >
                    <option value="expected">Expected</option>
                    <option value="checked_in">Checked in</option>
                    <option value="no_show">No-show</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Expenses — entry only, no revenue/profit shown */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ ...S.label, marginBottom: 0 }}>Expenses</p>
                <button onClick={() => setAddingExpense(true)} style={{ ...S.btn, background: 'rgba(234,0,58,0.12)', color: '#EA003A', border: '1px solid rgba(234,0,58,0.25)', height: '28px', padding: '0 10px', fontSize: '12px' }}>+ Add</button>
              </div>
              {addingExpense && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '14px', marginBottom: '12px' }}>
                  <select value={expForm.category} onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))} style={{ ...S.input, marginBottom: '8px' }}>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                  </select>
                  <input value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" style={{ ...S.input, marginBottom: '8px' }} />
                  <input type="number" value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount (฿)" style={{ ...S.input, marginBottom: '10px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={addExpense} style={{ ...S.btn, background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff' }}>Save</button>
                    <button onClick={() => setAddingExpense(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.10)' }}>Cancel</button>
                  </div>
                </div>
              )}
              {data.expenses.length === 0 && !addingExpense && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>No expenses logged.</p>}
              {data.expenses.map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: '#fff', textTransform: 'capitalize', margin: 0 }}>{e.category.replace('_', ' ')}</p>
                    {e.description && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{e.description}</p>}
                  </div>
                  <p style={{ fontSize: '13px', color: '#EA003A', fontWeight: 600 }}>฿{e.amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
