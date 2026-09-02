'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

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

const baht = (n: number) => `฿${n.toLocaleString()}`

// Phase 2D: adapts app/dashboard/checkin/[token]/page.tsx into the operator
// shell. Calls the exact same GET/POST /api/admin/checkin/[token] routes,
// unchanged — no new mutation, no new endpoint. Deliberately booking-level
// only (no per-guest sub-state exists), and deliberately no undo control
// here — reversing a check-in stays Event Operations → Guests' job, via the
// existing /api/update-attendance route (SNX_PHASE2D plan).
export default function OperatorCheckinTokenPage({ params }: { params: { token: string } }) {
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
        const json = await res.json()
        setData(json)
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

  const cardStyle: React.CSSProperties = { background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '20px' }

  // Copy-only: the top link reads "Back to scanner" while the booking is
  // still pending a decision, and "Scan another ticket" once it has reached
  // a terminal/result state (checked in, already checked in, or blocked) —
  // matching the same isCheckedIn/isBlocked logic the render below uses,
  // just needed one level higher for this one label.
  const isTerminalState =
    !!data && (data.booking.attendanceStatus === 'checked_in' || data.booking.status === 'cancelled' || data.booking.status === 'refunded')

  return (
    <div style={{ padding: '20px 18px 32px' }}>
      <Link href="/operator/manage/checkin" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> {isTerminalState ? 'Scan another ticket' : 'Back to scanner'}
      </Link>

      {state === 'loading' && (
        <div style={cardStyle}><p style={{ color: T.textMuted, fontSize: '14px', margin: 0 }}>Looking up ticket…</p></div>
      )}

      {state === 'notfound' && (
        <div style={cardStyle}>
          <p style={{ ...eyebrow(T.statusRed), marginBottom: '8px' }}>Ticket Not Found</p>
          <p style={{ color: T.text, fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
            This code doesn&apos;t match any booking. Double-check it, or ask the guest to show
            their confirmation email instead.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div style={cardStyle}>
          <p style={{ ...eyebrow(T.statusRed), marginBottom: '8px' }}>Something Went Wrong</p>
          <p style={{ color: T.text, fontSize: '14px', margin: 0 }}>Please try again.</p>
        </div>
      )}

      {state === 'ready' && data && (() => {
        // Same authoritative-signal rule as the legacy page: gate on the
        // booking's CURRENT attendanceStatus, not the alreadyCheckedIn
        // response flag (which is false right after a fresh confirm,
        // correctly — it wasn't "already" checked in, it just became
        // checked in). Keeps the button and the "checked in" banner
        // mutually exclusive.
        const isCheckedIn = data.booking.attendanceStatus === 'checked_in'
        const isBlocked = data.booking.status === 'cancelled' || data.booking.status === 'refunded'
        const showScanNext = isCheckedIn || isBlocked

        return (
          <div style={cardStyle}>
            {isCheckedIn && (
              <div
                style={{
                  background: justConfirmed ? T.statusGreenSoft : T.statusAmberSoft,
                  border: `2px solid ${justConfirmed ? T.statusGreen : T.statusAmber}`,
                  borderRadius: T.radiusSm, padding: '18px', marginBottom: '18px', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '30px', lineHeight: 1, marginBottom: '8px' }}>
                  {justConfirmed ? '✓' : '⚠'}
                </div>
                <p style={{ color: justConfirmed ? T.statusGreen : T.statusAmber, fontSize: '17px', fontWeight: 700, margin: 0 }}>
                  {justConfirmed ? 'Checked In' : 'Already Checked In'}
                </p>
                <p style={{ color: T.textMuted, fontSize: '12.5px', marginTop: '6px' }}>
                  {justConfirmed
                    ? `${data.booking.quantity} guest${data.booking.quantity !== 1 ? 's' : ''} checked in`
                    : 'This ticket has already been used'}
                </p>
              </div>
            )}

            <p style={eyebrow(T.textFaint)}>{data.product.name}</p>
            <p style={{ color: T.text, fontSize: '13px', marginBottom: '18px' }}>
              {data.event.eventDate}{data.event.startTime ? ` · ${data.event.startTime.slice(0, 5)}` : ''}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <p style={eyebrow(T.textFaint)}>Guest</p>
                <p style={{ color: T.text, fontSize: '15px', fontWeight: 600, margin: 0 }}>{data.booking.guestName || 'Guest'}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={eyebrow(T.textFaint)}>Guests</p>
                <p style={{ color: T.text, fontSize: '15px', fontWeight: 600, margin: 0 }}>{data.booking.quantity}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px', paddingTop: '10px', borderTop: `1px solid ${T.border}` }}>
              <div>
                <p style={eyebrow(T.textFaint)}>Booking Ref</p>
                <p style={{ color: T.textMuted, fontSize: '13px', margin: 0 }}>{data.booking.reference}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={eyebrow(T.textFaint)}>Payment</p>
                <p style={{ color: T.textMuted, fontSize: '13px', margin: 0 }}>
                  {data.booking.status === 'confirmed' ? `Paid ${baht(data.booking.totalPaid)}` : data.booking.status}
                </p>
              </div>
            </div>

            {/* Exactly one of these three renders — an active check-in
                action is never shown once the booking is already checked
                in or blocked. No undo control here by design — that stays
                Event Operations → Guests' job. */}
            {isBlocked ? (
              <p style={{ color: T.statusRed, fontSize: '13px', marginBottom: '4px' }}>
                This booking was {data.booking.status} — do not check in.
              </p>
            ) : isCheckedIn ? null : (
              <button
                type="button"
                onClick={confirmCheckin}
                disabled={confirming}
                style={{
                  width: '100%', minHeight: '48px', padding: '13px', borderRadius: T.radiusSm, border: 'none',
                  background: confirming ? T.chipBg : T.statusGreen, color: confirming ? T.textFaint : '#fff',
                  fontWeight: 600, fontSize: '14.5px', cursor: confirming ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {confirming ? 'Checking in…' : `Check in ${data.booking.quantity} guest${data.booking.quantity !== 1 ? 's' : ''}`}
              </button>
            )}

            {showScanNext && (
              <Link
                href="/operator/manage/checkin"
                style={{
                  display: 'block', textAlign: 'center', width: '100%', minHeight: '48px', lineHeight: '48px',
                  borderRadius: T.radiusSm, background: T.accent, color: '#fff', fontWeight: 600, fontSize: '14.5px',
                  textDecoration: 'none', marginTop: '24px',
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
