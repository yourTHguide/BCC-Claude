'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CheckinResponse {
  booking: {
    id: string
    guestName: string | null
    guestEmail: string | null
    quantity: number
    totalPaid: number
    status: string
    attendanceStatus: string
    reference: string
  }
  event: { eventDate: string; startTime: string | null }
  product: { name: string; slug: string | null }
  alreadyCheckedIn: boolean
}

// Host/operator check-in confirmation (Stage 9d). This is what opens when a
// host scans a guest's QR with their phone's own camera app — the QR
// already encodes this exact URL (lib/qrTicket.ts), so there is no in-app
// camera/decoding code here at all. Protected by the existing
// middleware.ts `/dashboard/:path*` auth gate for free (no admin session →
// redirected to /login, same as every other dashboard route).
//
// Deliberately booking-level only: a booking's `attendance_status` has no
// concept of "how many of this group checked in" — see the API route for
// why partial group check-in isn't built here.
export default function CheckinTokenPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<CheckinResponse | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [confirming, setConfirming] = useState(false)
  const [justConfirmed, setJustConfirmed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/checkin/${encodeURIComponent(params.token)}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) {
          setState('notfound')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        setData(await res.json())
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [params.token])

  async function confirmCheckin() {
    setConfirming(true)
    try {
      const res = await fetch(`/api/admin/checkin/${encodeURIComponent(params.token)}`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        setData(json)
        setJustConfirmed(!json.alreadyCheckedIn)
      } else {
        alert(json.error || 'Check-in failed')
      }
    } catch {
      alert('Network error — please try again')
    } finally {
      setConfirming(false)
    }
  }

  const S = {
    page: {
      minHeight: '100vh', background: '#0D000A', fontFamily: 'Inter, sans-serif',
      padding: '32px 20px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    },
    card: {
      width: '100%', maxWidth: '380px', background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '24px',
    },
    label: {
      fontWeight: 600, fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.40)', marginBottom: '4px',
    },
    back: { color: 'rgba(255,255,255,0.50)', fontSize: '13px', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' },
  }

  return (
    <div style={S.page}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <Link href="/dashboard/checkin" style={S.back}>← Scan another ticket</Link>
      </div>

      {state === 'loading' && (
        <div style={S.card}><p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '14px' }}>Looking up ticket…</p></div>
      )}

      {state === 'notfound' && (
        <div style={S.card}>
          <p style={{ ...S.label, color: '#EA003A' }}>Ticket Not Found</p>
          <p style={{ color: '#fff', fontSize: '14px', lineHeight: 1.6 }}>
            This code doesn&apos;t match any booking. Double-check it, or ask the guest to show
            their confirmation email instead.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div style={S.card}>
          <p style={{ ...S.label, color: '#EA003A' }}>Something Went Wrong</p>
          <p style={{ color: '#fff', fontSize: '14px' }}>Please try again.</p>
        </div>
      )}

      {state === 'ready' && data && (
        <div style={S.card}>
          {data.alreadyCheckedIn && !justConfirmed && (
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 600, margin: 0 }}>Already checked in</p>
            </div>
          )}
          {justConfirmed && (
            <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.30)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              <p style={{ color: '#22c55e', fontSize: '13px', fontWeight: 600, margin: 0 }}>✓ Checked in</p>
            </div>
          )}

          <p style={S.label}>{data.product.name}</p>
          <p style={{ color: '#fff', fontSize: '13px', marginBottom: '18px' }}>
            {data.event.eventDate}{data.event.startTime ? ` · ${data.event.startTime.slice(0, 5)}` : ''}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <p style={S.label}>Guest</p>
              <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{data.booking.guestName || 'Guest'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={S.label}>Guests</p>
              <p style={{ color: '#fff', fontSize: '15px', fontWeight: 600 }}>{data.booking.quantity}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p style={S.label}>Booking Ref</p>
              <p style={{ color: 'rgba(255,255,255,0.70)', fontSize: '13px' }}>{data.booking.reference}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={S.label}>Payment</p>
              <p style={{ color: 'rgba(255,255,255,0.70)', fontSize: '13px' }}>
                {data.booking.status === 'confirmed' ? `Paid ฿${data.booking.totalPaid.toLocaleString()}` : data.booking.status}
              </p>
            </div>
          </div>

          {(data.booking.status === 'cancelled' || data.booking.status === 'refunded') ? (
            <p style={{ color: '#EA003A', fontSize: '13px' }}>
              This booking was {data.booking.status} — do not check in.
            </p>
          ) : data.alreadyCheckedIn ? (
            <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px' }}>
              This ticket has already been used. No further action needed.
            </p>
          ) : (
            <button
              onClick={confirmCheckin}
              disabled={confirming}
              style={{
                width: '100%', height: '46px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
                fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px',
                cursor: confirming ? 'default' : 'pointer', opacity: confirming ? 0.7 : 1,
              }}
            >
              {confirming ? 'Checking in…' : `Check in ${data.booking.quantity} guest${data.booking.quantity !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
