'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (sessionId) {
      setStatus('success')
    } else {
      setStatus('error')
    }
  }, [sessionId])

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
          {/* Checkmark */}
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
            You're in.<br />Bangkok awaits.
          </h1>

          <p style={{
            fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
            fontSize: '18px', color: 'rgba(255,255,255,0.60)',
            marginBottom: '40px', lineHeight: 1.6, maxWidth: '400px',
          }}>
            Check your email — full details, run of show, dress code, and tips are all in there.
          </p>

          {/* What happens next */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            marginBottom: '32px',
            textAlign: 'left',
          }}>
            <p style={{
              fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)',
              marginBottom: '16px',
            }}>WHAT HAPPENS NEXT</p>

            {[
              { step: '1', text: 'Check your email for full booking details and reminders.' },
              { step: '2', text: 'By 7 PM on the day, you\'ll receive a WhatsApp group link with the exact meet-up location.' },
              { step: '3', text: 'Show up at 9:30 PM. Your host will be there.' },
            ].map(({ step, text }) => (
              <div key={step} style={{
                display: 'flex', gap: '14px', alignItems: 'flex-start',
                marginBottom: step === '3' ? 0 : '14px',
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #EA003A, #820065)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontWeight: 700, fontSize: '11px', color: '#fff',
                }}>
                  {step}
                </div>
                <p style={{
                  fontSize: '13px', color: 'rgba(255,255,255,0.65)',
                  lineHeight: 1.6, margin: 0, paddingTop: '3px',
                }}>
                  {text}
                </p>
              </div>
            ))}
          </div>

          {/* Important note */}
          <div style={{
            background: 'rgba(234,0,58,0.08)',
            border: '1px solid rgba(234,0,58,0.20)',
            borderLeft: '3px solid #EA003A',
            borderRadius: '10px',
            padding: '16px 20px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'left',
            marginBottom: '36px',
          }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: '#fff' }}>Didn't get the email?</strong> Check your spam folder or contact us on WhatsApp at{' '}
              <a href="https://wa.me/66660399569" style={{ color: '#EA003A', textDecoration: 'none' }}>
                (+66) 66-039-9569
              </a>
            </p>
          </div>

          <Link href="/" style={{
            background: 'linear-gradient(135deg, #EA003A, #820065)',
            color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 600,
            fontSize: '15px', padding: '16px 32px', borderRadius: '8px',
            textDecoration: 'none', display: 'inline-block',
          }}>
            Back to Bangkok Club Crawl
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 style={{ color: '#fff', marginBottom: '16px' }}>Something went wrong</h1>
          <p style={{ color: 'rgba(255,255,255,0.60)', marginBottom: '32px' }}>
            If you were charged, your booking is confirmed. Check your email or contact us.
          </p>
          <Link href="/" style={{ color: '#EA003A', textDecoration: 'none' }}>
            Return to home
          </Link>
        </>
      )}
    </div>
  )
}

export default function BookingSuccess() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif' }}>Loading...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
