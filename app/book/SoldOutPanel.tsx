'use client'

import { useEffect, useRef, useState } from 'react'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { MAX_PARTY_SIZE, pickNextBookable, soldOutConsentText } from '@/lib/waitlist/soldOut'

// Sold-out recovery panel for a genuinely full Friday/Saturday Bangkok Club
// Crawl night (Phase 3B). Primary: the next night that is really bookable
// for this party (from the live /api/events list — never an invented date).
// Secondary: join the waitlist for this exact date. Joining reserves nothing;
// booking still goes through normal checkout at the normal price.

export interface SoldOutNight {
  eventId: string
  eventDate: string
  nightSlug: string
  nightName: string
  productSlug: string
}

interface BookableEvent {
  eventId: string
  eventDate: string
  nightName: string
  productSlug: string | null
  effectivePrice: number | null
  remaining?: number | null
}

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '16px',
  padding: '20px',
  marginBottom: '16px',
} as const

const input = {
  width: '100%', height: '44px', borderRadius: '10px', padding: '0 14px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: '14px', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
} as const

const primaryBtn = {
  width: '100%', height: '48px', borderRadius: '10px', border: 'none',
  background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)',
  color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
} as const

export default function SoldOutPanel({
  night,
  events,
  initialPartySize,
  waitlistEnabled,
  formatDateLabel,
  formatPrice,
  onChooseNight,
}: {
  night: SoldOutNight
  events: BookableEvent[]
  initialPartySize: number
  waitlistEnabled: boolean
  formatDateLabel: (iso: string) => string
  formatPrice: (n: number) => string
  onChooseNight: (eventId: string, eventDate: string, partySize: number) => void
}) {
  const [partySize, setPartySize] = useState(Math.min(MAX_PARTY_SIZE, Math.max(1, initialPartySize)))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const shownAt = useRef(Date.now())

  // A different sold-out night was clicked: start the form fresh.
  useEffect(() => {
    setState('idle')
    setError('')
    setConsent(false)
    shownAt.current = Date.now()
  }, [night.eventId])

  const next = pickNextBookable(events, night.eventDate, partySize, BCC_PRODUCT_SLUG)
  const consentText = soldOutConsentText(night.nightName, night.eventDate)

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      setError('Please tick the box to confirm you want this email.')
      setState('error')
      return
    }
    setState('busy')
    setError('')
    const res = await fetch('/api/waitlist/sold-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: night.eventId,
        name,
        email,
        partySize,
        consent: true,
        website,
        elapsedMs: Date.now() - shownAt.current,
      }),
    }).catch(() => null)
    if (res?.ok) {
      setState('done')
      return
    }
    const data = res ? await res.json().catch(() => ({})) : {}
    setError(data.error || 'Connection problem. Please try again.')
    setState('error')
  }

  return (
    <div style={{ animation: 'fadeUp 0.25s ease' }}>
      <div style={card}>
        <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
          Sold out
        </p>
        <p style={{ fontWeight: 600, fontSize: '17px', color: '#fff', marginBottom: '4px' }}>
          {night.nightName} · {formatDateLabel(night.eventDate)}
        </p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          Every seat for this night is taken.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>How many of you?</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" aria-label="Fewer people" onClick={() => setPartySize((n) => Math.max(1, n - 1))} style={stepBtn}>−</button>
            <span style={{ fontWeight: 600, fontSize: '15px', color: '#fff', minWidth: '20px', textAlign: 'center' }}>{partySize}</span>
            <button type="button" aria-label="More people" onClick={() => setPartySize((n) => Math.min(MAX_PARTY_SIZE, n + 1))} style={stepBtn}>+</button>
          </div>
        </div>
      </div>

      {/* Primary: the next night that can really be booked for this party. */}
      <div style={{ ...card, border: '1px solid rgba(234,0,58,0.35)' }}>
        {next ? (
          <>
            <p style={{ fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', marginBottom: '6px' }}>
              Next available night
            </p>
            <p style={{ fontWeight: 600, fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
              {next.nightName} · {formatDateLabel(next.eventDate)}
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '14px' }}>
              {next.effectivePrice != null ? `${formatPrice(next.effectivePrice)} per person` : ''}
              {next.remaining != null ? ` · ${next.remaining} seat${next.remaining === 1 ? '' : 's'} left` : ''}
            </p>
            <button type="button" style={primaryBtn} onClick={() => onChooseNight(next.eventId, next.eventDate, partySize)}>
              Book this night for {partySize}
            </button>
          </>
        ) : (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            No other night is open for a group of {partySize} right now.{waitlistEnabled ? ' Join the waitlist below, or message us on WhatsApp.' : ' Message us on WhatsApp and we’ll help.'}
          </p>
        )}
      </div>

      {/* Secondary: waitlist for this exact date. */}
      {waitlistEnabled && (
      <div style={card}>
        {state === 'done' ? (
          <>
            <p style={{ fontWeight: 600, fontSize: '15px', color: '#fff', marginBottom: '6px' }}>You&apos;re on the waitlist.</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
              If seats open up for {night.nightName} on {formatDateLabel(night.eventDate)}, we&apos;ll email you once. This doesn&apos;t
              reserve a seat — reopened seats go to whoever books first.
            </p>
          </>
        ) : (
          <form onSubmit={join} noValidate>
            <p style={{ fontWeight: 600, fontSize: '14px', color: '#fff', marginBottom: '4px' }}>Or join the waitlist for this date</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '14px', lineHeight: 1.5 }}>
              We&apos;ll email you if seats for {partySize} open up. Not a reservation, no payment.
            </p>
            <div style={{ display: 'grid', gap: '10px' }}>
              <input aria-label="Your name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required style={input} />
              <input aria-label="Email" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" required style={input} />
              {/* Honeypot: hidden from people, filled by bots. */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }} />
              <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: '3px' }} />
                <span>{consentText}</span>
              </label>
              <button type="submit" disabled={state === 'busy'} style={{ ...primaryBtn, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)', opacity: state === 'busy' ? 0.6 : 1 }}>
                {state === 'busy' ? 'Saving…' : 'Join the waitlist'}
              </button>
              {state === 'error' && (
                <p role="alert" style={{ color: '#FF6B8A', fontSize: '12px' }}>{error}</p>
              )}
            </div>
          </form>
        )}
      </div>
      )}
    </div>
  )
}

const stepBtn = {
  width: '32px', height: '32px', borderRadius: '50%',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: '16px', cursor: 'pointer',
} as const
