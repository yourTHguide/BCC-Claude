'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HostEvent {
  id: string
  eventDate: string
  nightName: string
  nightSlug: string
  isOpen: boolean
}

// Stage 9j — Host landing page. Lists only events assigned to the logged-in
// Host (or, for an owner/admin, every upcoming event — see the API route's
// doc comment for why that's also this feature's QA path). No revenue,
// host-pay, or product/storefront controls anywhere on this page or the
// detail page it links to.
export default function HostEventsPage() {
  const [events, setEvents] = useState<HostEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/host/events')
      .then(async (res) => {
        if (!res.ok) {
          setError('Failed to load your events')
          return
        }
        const data = await res.json()
        setEvents(data.events)
      })
      .catch(() => setError('Failed to load your events'))
  }, [])

  const S = {
    page: { minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 20px' },
    card: {
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px', padding: '18px', marginBottom: '10px', textDecoration: 'none', display: 'block',
    },
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', marginBottom: '8px' }}>
          Host Operations
        </p>
        <h1 style={{ fontSize: '20px', margin: '0 0 6px' }}>Your Events</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', marginBottom: '20px' }}>
          Open an event to see the guest list, log expenses, or scan tickets.
        </p>

        <Link
          href="/dashboard/checkin"
          style={{
            display: 'block', textAlign: 'center', padding: '13px', borderRadius: '8px', marginBottom: '20px',
            background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
          }}
        >
          Scan Ticket
        </Link>

        {error && <p style={{ color: '#EA003A', fontSize: '13px' }}>{error}</p>}
        {events === null && !error && <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px' }}>Loading…</p>}
        {events?.length === 0 && <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: '13px' }}>No events assigned to you yet.</p>}

        {events?.map((e) => {
          const dateObj = new Date(e.eventDate + 'T00:00:00')
          const label = dateObj.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <Link key={e.id} href={`/dashboard/host/${e.id}`} style={S.card}>
              <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff', margin: '0 0 4px' }}>{e.nightName}</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', margin: 0 }}>
                {label}{!e.isOpen && ' · Closed'}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
