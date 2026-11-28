'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import DoorList, { type DoorListTheme } from '@/components/doorlist/DoorList'
import type { DoorGuest } from '@/lib/doorList'
import HostExpenses from './HostExpenses'
import HostReport from './HostReport'
import HostBrief from './HostBrief'

interface Expense {
  id: string
  hostName: string
  category: string
  note: string | null
  amount: number
  hasReceipt: boolean
  status: 'pending' | 'approved' | 'rejected'
  reviewNote: string | null
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
    startTime: string | null
  }
  guests: DoorGuest[]
  headcount: { total: number; checkedIn: number }
  expenses: Expense[]
  report: { status: 'none' | 'draft' | 'submitted'; submittedAt: string | null; canStart: boolean }
}

type Tab = 'brief' | 'guests' | 'expenses' | 'report'

const HOST_DOOR_THEME: DoorListTheme = {
  elevated: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', text: '#fff',
  muted: 'rgba(255,255,255,0.60)', faint: 'rgba(255,255,255,0.40)',
  accent: '#EA003A', accentText: '#FF4D6D',
  green: '#4ADE80', greenSoft: 'rgba(74,222,128,0.14)', blue: '#60A5FA', blueSoft: 'rgba(96,165,250,0.14)',
  red: '#F87171', redSoft: 'rgba(248,113,113,0.14)', chipBg: 'rgba(255,255,255,0.08)', radius: '10px',
}


// Stage 9j — the restricted Host operational view. Deliberately shows no
// revenue, total_paid, host fee, or profit anywhere — that data is never
// even fetched by the API route this page calls (see its doc comment for
// the RLS caveat this does NOT fix).
// Nov 2026: four tabs like the operator screens — Brief (read-only), Guests
// (door list + check-in), Expenses (host-paid, with receipts, waiting for the
// owner's approval) and Report (after the night; submit locks it).
export default function HostEventDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<HostEventDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'forbidden' | 'error'>('loading')
  const [tab, setTab] = useState<Tab>('brief')
  const pushed = useRef(false)
  // The Brief is the night's main page; Guests / Expenses / Report open from
  // it with a back button. The phone's back gesture also returns to the Brief.
  useEffect(() => {
    const read = () => {
      const t = new URLSearchParams(window.location.search).get('tab')
      const next = t === 'guests' || t === 'expenses' || t === 'report' ? t : 'brief'
      if (next === 'brief') pushed.current = false
      setTab(next)
    }
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])
  function open(t: Tab) {
    if (t === tab) return
    window.history.pushState(null, '', t === 'brief' ? window.location.pathname : `?tab=${t}`)
    pushed.current = t !== 'brief'
    setTab(t)
    window.scrollTo(0, 0)
  }
  function back() {
    // Opened from the Brief: step back. Opened by a link (?tab=…): go to the Brief.
    if (pushed.current) { pushed.current = false; window.history.back(); return }
    window.history.replaceState(null, '', window.location.pathname)
    setTab('brief')
    window.scrollTo(0, 0)
  }

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
        {tab === 'brief' ? (
          <Link href="/dashboard/host" style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>
            ← Your Events
          </Link>
        ) : (
          <button onClick={back} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontFamily: 'Inter, sans-serif', marginBottom: '16px', display: 'inline-block' }}>
            ‹ Back to the night
          </button>
        )}

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

            {tab === 'brief' && <HostBrief event={data.event} headcount={data.headcount} onTab={open} expenseCount={data.expenses.length} reportLabel={data.report.status === 'submitted' ? 'Report ✓' : 'Night report'} reportDone={data.report.status === 'submitted'} onChanged={load} />}

            {/* Door list: everyone (direct + OTA), one-tap check-in, Scan at the top */}
            {tab === 'guests' && (
              <div style={{ marginBottom: '14px' }}>
                <DoorList guests={data.guests} theme={HOST_DOOR_THEME} scanHref="/dashboard/checkin" />
              </div>
            )}

            {tab === 'expenses' && <HostExpenses eventId={data.event.id} expenses={data.expenses} onChange={load} />}
            {tab === 'report' && <HostReport eventId={data.event.id} canStart={data.report.canStart} onSubmitted={load} />}

          </>
        )}
      </div>
    </div>
  )
}
