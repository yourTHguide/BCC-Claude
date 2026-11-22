'use client'

import { useState } from 'react'

// Confirm-then-unsubscribe page for BEST and Bangkok Club Crawl waitlist emails. One button, no
// login. Styled to match the BEST dark palette without loading the full
// landing stylesheet.
export default function UnsubscribeClient({ token, brandName = 'BEST Nightlife Thailand' }: { token: string; brandName?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function confirm() {
    setState('busy')
    const res = await fetch('/api/waitlist/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => null)
    if (res?.ok) return setState('done')
    const data = res ? await res.json().catch(() => ({})) : {}
    setError(data.error || 'Connection problem. Please try again.')
    setState('error')
  }

  return (
    <main style={{ minHeight: '100vh', background: '#0D0D0D', color: '#FFFFFF', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', margin: '0 0 12px' }}>{brandName}</p>
        {state === 'done' ? (
          <>
            <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>You&apos;re unsubscribed.</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              We won&apos;t send you any more emails from this waitlist. Other lists you may be on are not affected. If you sign up again later, we&apos;ll treat it as a new request.
            </p>
          </>
        ) : !token ? (
          <>
            <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>This link is incomplete.</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              Use the unsubscribe link in our email, or reply to that email and we&apos;ll remove you.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>Stop these emails?</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 24px' }}>
              You&apos;ll no longer get emails from this waitlist (new dates, or seats reopening for the date you asked about).
            </p>
            <button
              onClick={confirm}
              disabled={state === 'busy'}
              style={{ width: '100%', padding: '14px 18px', borderRadius: 9999, border: 'none', background: '#EA003A', color: '#FFFFFF', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: state === 'busy' ? 0.7 : 1 }}
            >
              {state === 'busy' ? 'Unsubscribing…' : 'Unsubscribe'}
            </button>
            {state === 'error' && <p role="alert" style={{ color: '#FF6B8A', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        )}
      </div>
    </main>
  )
}
