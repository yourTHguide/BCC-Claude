'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clientDebugLog } from '@/lib/clientDebugLog'

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

  // TEMPORARY diagnostic instrumentation (PHASE4_CHECKPOINT.md Stage 9 --
  // real-iPhone crash). window-level listeners catch failures that never
  // reach a React error boundary at all (a bare script error, an unhandled
  // promise rejection); breadcrumbs at each phase below let us tell, from
  // server logs, exactly how far a given load got before it stopped
  // progressing. Remove this whole effect once the real cause is found.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      clientDebugLog('window_error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        errorString: e.error ? String(e.error) : null,
        errorStack: e.error?.stack || null,
      })
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      clientDebugLog('unhandled_rejection', { reason: String(e.reason), reasonStack: e.reason?.stack || null })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    clientDebugLog('checkin_mounted', { token: params.token })
    clientDebugLog('checkin_fetch_start')
    fetch(`/api/admin/checkin/${encodeURIComponent(params.token)}`)
      .then(async (res) => {
        clientDebugLog('checkin_fetch_resolved', { status: res.status, ok: res.ok })
        if (cancelled) return
        if (res.status === 404) {
          setState('notfound')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        const json = await res.json()
        clientDebugLog('checkin_json_parsed', { keys: Object.keys(json || {}) })
        setData(json)
        setState('ready')
      })
      .catch((err) => {
        clientDebugLog('checkin_fetch_error', { errorString: String(err), errorStack: err?.stack || null })
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [params.token])

  useEffect(() => {
    if (state === 'ready') clientDebugLog('checkin_render_ready_committed')
  }, [state])

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

      {state === 'ready' && data && (() => {
        // The authoritative signal for whether an active check-in action may
        // still be taken is the booking's CURRENT attendance status — not
        // the `alreadyCheckedIn` response flag, which only means "was this
        // particular call a repeat scan" and is FALSE immediately after a
        // fresh confirm (correctly — it wasn't "already" checked in, it just
        // became checked in). Using that flag to gate the button was a real
        // bug: right after a successful check-in it would show the green
        // button again. Keying off attendanceStatus instead means the
        // button and the "checked in" banner are always mutually exclusive.
        const isCheckedIn = data.booking.attendanceStatus === 'checked_in'
        const isBlocked = data.booking.status === 'cancelled' || data.booking.status === 'refunded'
        const showScanNext = isCheckedIn || isBlocked

        return (
          <div style={S.card}>
            {isCheckedIn && (
              <div
                style={{
                  background: justConfirmed ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                  border: `2px solid ${justConfirmed ? '#22c55e' : '#f59e0b'}`,
                  borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '32px', lineHeight: 1, marginBottom: '8px' }}>
                  {justConfirmed ? '✓' : '⚠'}
                </div>
                <p style={{ color: justConfirmed ? '#22c55e' : '#f59e0b', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                  {justConfirmed ? 'Checked In' : 'Already Checked In'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginTop: '6px' }}>
                  {justConfirmed
                    ? `${data.booking.quantity} guest${data.booking.quantity !== 1 ? 's' : ''} checked in`
                    : 'This ticket has already been used'}
                </p>
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

            {/* Exactly one of these three renders — an active check-in
                action is never shown once the booking is already checked
                in or blocked. */}
            {isBlocked ? (
              <p style={{ color: '#EA003A', fontSize: '13px', marginBottom: '20px' }}>
                This booking was {data.booking.status} — do not check in.
              </p>
            ) : isCheckedIn ? null : (
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

            {/* Prominent next action once this ticket is resolved (checked
                in, already used, or blocked). Generous marginTop — this and
                the green "Check in" button are mutually exclusive by
                construction (never both rendered at once, see the isBlocked/
                isCheckedIn branch above), but the gap still needs to read as
                clearly separate from whatever precedes it (the payment row,
                or the checked-in banner) rather than sitting flush under it.
                The small "Scan another ticket" link at the top of the page
                covers the same destination from a non-terminal state. */}
            {showScanNext && (
              <Link
                href="/dashboard/checkin"
                style={{
                  display: 'block', textAlign: 'center', width: '100%', height: '46px', lineHeight: '46px',
                  borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)',
                  color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px',
                  textDecoration: 'none', marginTop: '28px',
                }}
              >
                Scan Next Ticket
              </Link>
            )}
          </div>
        )
      })()}
    </div>
  )
}
