'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Storefront } from '@/lib/storefront'
import { brandFor } from '@/lib/storefrontBrand'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

const nightPriceMap: Record<string, number> = {
  'saturday-signature': 1500,
  'tgif': 1200,
  'lgbtplus-night': 1200,
  'solo-night': 1000,
  'new-in-bangkok': 1000,
  'nomad-nights': 1000,
  'girls-night': 1000,
  '30plus-night': 1000,
}

const nightNameMap: Record<string, string> = {
  'saturday-signature': 'BCC Signature Night',
  'tgif': 'TGIF Bangkok',
  'lgbtplus-night': 'LGBT+ Night Bangkok',
  'solo-night': "Solo Traveler's Night",
  'new-in-bangkok': 'New in Bangkok Night',
  'nomad-nights': 'Digital Nomad Crawl',
  'girls-night': 'Girls Night Bangkok',
  '30plus-night': '30+ Social Night',
}

// "What happens next" copy, per storefront. BCC's is unchanged (WhatsApp
// group by 7 PM, 9:30 PM meet-up) — that's BCC's real, specific run of show.
// BNT's is deliberately generic (Stage 10 Phase 6 instruction: do not
// reintroduce BCC-specific run-of-show copy for a BNT purchase unless the
// booked product's own canonical content requires it) since New in Bangkok
// and future BNT products don't share BCC's exact WhatsApp-group/9:30-PM
// format — the ticket page/email already carries the real meeting point and
// timing for whatever was actually booked.
function nextStepsFor(storefront: Storefront) {
  if (storefront === 'bnt') {
    return [
      { step: '1', text: 'Check your email for your full ticket and event details.' },
      { step: '2', text: 'Your ticket — meeting point, timing, and everything else you need — is always available at the link below.' },
      { step: '3', text: 'Show your ticket or QR code at check-in.' },
    ]
  }
  return [
    { step: '1', text: 'Check your email for full booking details and reminders.' },
    { step: '2', text: "By 7 PM on the day, you'll receive a WhatsApp group link with the exact meet-up location." },
    { step: '3', text: 'Show up at 9:30 PM. Your host will be there.' },
  ]
}

function SuccessContent({ storefront }: { storefront: Storefront }) {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const nightSlug = searchParams.get('night') ?? ''
  const qty = parseInt(searchParams.get('qty') ?? '1', 10)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [ticketToken, setTicketToken] = useState<string | null>(null)
  const brand = brandFor(storefront)

  useEffect(() => {
    if (sessionId) {
      setStatus('success')
      // Fire Purchase pixel event on confirmed payment. No-op on the BNT
      // host — the Meta Pixel script itself is never loaded there (see
      // app/layout.tsx's isBcc gate), so window.fbq is undefined and this
      // optional call is inert by construction, not by a storefront check
      // here.
      const pricePerTicket = nightPriceMap[nightSlug] ?? 1000
      const nightName = nightNameMap[nightSlug] ?? brand.name
      const totalValue = pricePerTicket * qty
      window.fbq?.('track', 'Purchase', {
        value: totalValue,
        currency: 'THB',
        content_name: nightName,
        content_category: 'Nightlife Event',
        num_items: qty,
      })
    } else {
      setStatus('error')
    }
  }, [sessionId, nightSlug, qty, brand.name])

  // The Stripe webhook (async, server-to-server) may not have written the
  // booking yet when the browser lands here — poll briefly for its
  // ticket_token rather than treating "not there yet" as an error. Stops as
  // soon as it's found, or after ~8 tries (~12s); if the webhook is slow or
  // fails, the page still shows the existing generic reassurance + WhatsApp
  // fallback below, unchanged.
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let attempts = 0

    async function poll() {
      if (cancelled) return
      attempts += 1
      try {
        const res = await fetch(`/api/bookings/by-session?session_id=${encodeURIComponent(sessionId!)}`)
        const data = await res.json()
        if (!cancelled && data.ticketToken) {
          setTicketToken(data.ticketToken)
          return
        }
      } catch {
        // network hiccup — just retry on the next tick
      }
      if (!cancelled && attempts < 8) {
        setTimeout(poll, 1500)
      }
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const steps = nextStepsFor(storefront)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1A0015',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
    }}>
      {status === 'loading' && (
        <p style={{ color: 'rgba(255,255,255,0.40)' }}>Confirming your booking...</p>
      )}

      {status === 'success' && (
        <>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #EA003A, #820065)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '28px',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M7 16l6 6 12-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <p style={{
            fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#EA003A', marginBottom: '12px',
          }}>BOOKING CONFIRMED</p>

          <h1 style={{
            fontWeight: 600, fontSize: 'clamp(24px, 6vw, 36px)',
            color: '#fff', marginBottom: '16px', lineHeight: 1.15,
          }}>
            {storefront === 'bnt' ? <>You’re in.<br />See you out there.</> : <>You’re in.<br />Bangkok awaits.</>}
          </h1>

          <p style={{
            fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
            fontSize: '18px', color: 'rgba(255,255,255,0.60)',
            marginBottom: '40px', lineHeight: 1.6, maxWidth: '400px',
          }}>
            Check your email — full details, timing, and tips are all in there.
          </p>

          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '24px',
            maxWidth: '400px', width: '100%',
            marginBottom: '32px', textAlign: 'left',
          }}>
            <p style={{
              fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: '16px',
            }}>WHAT HAPPENS NEXT</p>
            {steps.map(({ step, text }) => (
              <div key={step} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: step === '3' ? 0 : '14px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #EA003A, #820065)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontWeight: 700, fontSize: '11px', color: '#fff',
                }}>
                  {step}
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0, paddingTop: '3px' }}>
                  {text}
                </p>
              </div>
            ))}
          </div>

          <div style={{
            background: 'rgba(234,0,58,0.08)', border: '1px solid rgba(234,0,58,0.20)',
            borderLeft: '3px solid #EA003A', borderRadius: '10px',
            padding: '16px 20px', maxWidth: '400px', width: '100%',
            textAlign: 'left', marginBottom: '36px',
          }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: '#fff' }}>Didn’t get the email?</strong> Check your spam folder or contact us on WhatsApp at{' '}
              <a href={brand.supportWhatsappUrl} style={{ color: '#EA003A', textDecoration: 'none' }}>
                {brand.supportWhatsappDisplay}
              </a>
            </p>
          </div>

          {ticketToken ? (
            <>
              <Link href={`/ticket/${ticketToken}`} style={{
                background: 'linear-gradient(135deg, #EA003A, #820065)',
                color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                fontSize: '15px', padding: '16px 32px', borderRadius: '8px',
                textDecoration: 'none', display: 'inline-block', marginBottom: '16px',
              }}>
                View your ticket
              </Link>
              <br />
              <Link href={brand.homeHref} style={{ color: 'rgba(255,255,255,0.50)', fontFamily: 'Inter, sans-serif', fontSize: '13px', textDecoration: 'none' }}>
                {brand.backLabel}
              </Link>
            </>
          ) : (
            <Link href={brand.homeHref} style={{
              background: 'linear-gradient(135deg, #EA003A, #820065)',
              color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600,
              fontSize: '15px', padding: '16px 32px', borderRadius: '8px',
              textDecoration: 'none', display: 'inline-block',
            }}>
              {brand.backLabel}
            </Link>
          )}
        </>
      )}

      {status === 'error' && (
        <>
          <h1 style={{ color: '#fff', marginBottom: '16px' }}>Something went wrong</h1>
          <p style={{ color: 'rgba(255,255,255,0.60)', marginBottom: '32px' }}>
            If you were charged, your booking is confirmed. Check your email or contact us.
          </p>
          <Link href={brand.homeHref} style={{ color: '#EA003A', textDecoration: 'none' }}>
            Return to home
          </Link>
        </>
      )}
    </div>
  )
}

export default function BookingSuccessClient({ storefront }: { storefront: Storefront }) {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif' }}>Loading...</p>
      </div>
    }>
      <SuccessContent storefront={storefront} />
    </Suspense>
  )
}
