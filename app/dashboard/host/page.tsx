'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HostEvent {
  id: string
  eventDate: string
  nightName: string
  nightSlug: string
  isOpen: boolean
  hostAssigned: string | null
  operationVerdict: string
}

interface Viewer {
  role: 'owner' | 'admin' | 'staff'
  displayName: string | null
  today: string
}

// Stage 9j — Host landing page. A host ('staff') sees only nights assigned
// to them. An owner/admin gets a "My nights / All nights" switch: My nights
// is the exact host experience (e.g. Guide hosting a night herself), All
// nights is every actionable event (the original QA path). No revenue,
// host-pay, or product/storefront controls anywhere on this page or the
// detail page it links to.
export default function HostEventsPage() {
  const [events, setEvents] = useState<HostEvent[] | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState(true)

  useEffect(() => {
    setEvents(null)
    setError(null)
    fetch(`/api/admin/host/events${mine ? '?mine=1' : ''}`)
      .then(async (res) => {
        if (!res.ok) {
          setError('Failed to load your events')
          return
        }
        const data = await res.json()
        setEvents(data.events)
        setViewer(data.viewer ?? null)
      })
      .catch(() => setError('Failed to load your events'))
  }, [mine])

  const isManager = viewer && viewer.role !== 'staff'
  const tonight = events?.filter((e) => e.eventDate === viewer?.today) ?? []
  const later = events?.filter((e) => e.eventDate !== viewer?.today) ?? []

  const S = {
    page: { minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '24px 20px' },
    card: {
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px', padding: '18px', marginBottom: '10px', textDecoration: 'none', display: 'block',
    },
    section: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', margin: '18px 0 8px' },
  }

  function EventCard({ e, highlight }: { e: HostEvent; highlight?: boolean }) {
    const label = new Date(e.eventDate + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })
    return (
      <Link
        href={`/dashboard/host/${e.id}`}
        style={{ ...S.card, ...(highlight ? { border: '1px solid rgba(234,0,58,0.45)', background: 'rgba(234,0,58,0.08)' } : {}) }}
      >
        <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff', margin: '0 0 4px' }}>{e.nightName}</p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', margin: 0 }}>
          {label}{!e.isOpen && ' · Closed'}
          {e.operationVerdict === 'Operation Confirmed' && <span style={{ color: '#22c55e' }}> · Confirmed</span>}
          {!mine && <span> · Host: {e.hostAssigned || 'unassigned'}</span>}
        </p>
      </Link>
    )
  }

  return (
    <div style={S.page}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', marginBottom: '8px' }}>
          Host Operations
        </p>
        <h1 style={{ fontSize: '20px', margin: '0 0 6px' }}>
          {viewer?.displayName ? `Hi ${viewer.displayName} — your nights` : 'Your Events'}
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', marginBottom: '16px' }}>
          Open a night for the guest list, check-in, route and WhatsApp group.
        </p>

        {isManager && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {[[true, 'My nights'], [false, 'All nights']].map(([val, label]) => (
              <button
                key={String(val)}
                onClick={() => setMine(val as boolean)}
                style={{
                  flex: 1, height: '34px', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${mine === val ? '#EA003A' : 'rgba(255,255,255,0.12)'}`,
                  background: mine === val ? 'rgba(234,0,58,0.15)' : 'transparent',
                  color: mine === val ? '#fff' : 'rgba(255,255,255,0.60)',
                }}
              >
                {label as string}
              </button>
            ))}
          </div>
        )}

        <Link
          href="/dashboard/checkin"
          style={{
            display: 'block', textAlign: 'center', padding: '13px', borderRadius: '8px', marginBottom: '4px',
            background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
          }}
        >
          Scan Ticket
        </Link>

        {error && <p style={{ color: '#EA003A', fontSize: '13px' }}>{error}</p>}
        {events === null && !error && <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px', marginTop: '16px' }}>Loading…</p>}
        {events?.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: '13px', marginTop: '16px' }}>
            {mine && isManager ? 'You are not assigned as host on any upcoming night.' : 'No events assigned to you yet.'}
          </p>
        )}

        {tonight.length > 0 && <p style={S.section}>Tonight</p>}
        {tonight.map((e) => <EventCard key={e.id} e={e} highlight />)}
        {later.length > 0 && <p style={S.section}>Coming up</p>}
        {later.map((e) => <EventCard key={e.id} e={e} />)}
      </div>
    </div>
  )
}
