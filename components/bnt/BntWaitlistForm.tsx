'use client'

import { useState } from 'react'
import { BNT_WHATSAPP_URL } from '@/lib/bnt/contact'
import { WAITLIST_PRODUCTS } from '@/lib/bnt/waitlist'

// Phase 3 (Nov 2026): "notify me" email capture for a BEST event with no
// open dates. Posts to /api/waitlist; never touches booking or checkout.
export default function BntWaitlistForm({ product, eventName }: { product: string; eventName: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')
  const consentText = WAITLIST_PRODUCTS[product]?.consentText

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    setState('sending')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, name: name.trim(), email: email.trim(), website }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        const w = window as unknown as { fbq?: (...args: unknown[]) => void }
        // Count a Lead only for a new sign-up, not a repeat of an address
        // that is already on the list.
        if (!data.duplicate && typeof w.fbq === 'function') {
          w.fbq('track', 'Lead', { content_name: `${eventName} waitlist`, content_category: 'waitlist' })
        }
        setState('done')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'We couldn’t save your email. Please try again.')
        setState('idle')
      }
    } catch {
      setError('Connection problem. Please try again.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div className="bnt-waitlist bnt-waitlist--done" role="status">
        <p className="bnt-waitlist-title">You&apos;re on the list.</p>
        <p className="bnt-waitlist-copy">We&apos;ll email you as soon as new dates open.</p>
      </div>
    )
  }

  return (
    <form className="bnt-waitlist" onSubmit={submit} noValidate>
      <p className="bnt-waitlist-title">New dates coming soon.</p>
      <p className="bnt-waitlist-copy">Leave your email and you&apos;ll be first to hear when they open.</p>
      <div className="bnt-waitlist-fields">
        <input
          type="text"
          placeholder="First name (optional)"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="First name (optional)"
        />
        <input
          type="email"
          placeholder="Your email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
        />
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="bnt-waitlist-hp"
          aria-hidden="true"
        />
      </div>
      {error && (
        <p className="bnt-waitlist-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="nib-btn-neon nib-btn-neon-filled" disabled={state === 'sending'}>
        <span>{state === 'sending' ? 'Saving…' : 'Notify me'}</span>
      </button>
      {consentText && <p className="bnt-waitlist-consent">{consentText}</p>}
      <p className="bnt-waitlist-alt">
        Prefer to chat?{' '}
        <a href={BNT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          Message us on WhatsApp
        </a>
      </p>
      <style>{`
        .bnt-waitlist { max-width: 420px; margin: 32px auto 0; text-align: center; }
        .bnt-waitlist-title { font-family: Inter, sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: #FFFFFF; margin: 0 0 8px; }
        .bnt-waitlist-copy { font-family: Inter, sans-serif; font-size: 14px; color: rgba(255,255,255,0.70); margin: 0 0 18px; line-height: 1.5; }
        .bnt-waitlist-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
        .bnt-waitlist-fields input { width: 100%; padding: 14px 18px; border-radius: 9999px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.04); color: #FFFFFF; font-family: Inter, sans-serif; font-size: 15px; outline: none; box-sizing: border-box; }
        .bnt-waitlist-fields input:focus { border-color: #EA003A; box-shadow: 0 0 0 3px rgba(234,0,58,0.18); }
        .bnt-waitlist-hp { position: absolute !important; left: -9999px !important; width: 1px !important; height: 1px !important; opacity: 0 !important; }
        .bnt-waitlist button { width: 100%; border: none; cursor: pointer; }
        .bnt-waitlist button:disabled { opacity: 0.7; cursor: wait; }
        .bnt-waitlist-error { font-family: Inter, sans-serif; font-size: 13px; color: #FF6B8A; margin: 0 0 12px; }
        .bnt-waitlist-consent { font-family: Inter, sans-serif; font-size: 12px; color: rgba(255,255,255,0.55); margin: 12px 0 0; line-height: 1.5; }
        .bnt-waitlist-alt { font-family: Inter, sans-serif; font-size: 12px; color: rgba(255,255,255,0.50); margin-top: 14px; }
        .bnt-waitlist-alt a { color: #FFFFFF; }
        .bnt-waitlist--done .bnt-waitlist-title { color: #EA003A; }
      `}</style>
    </form>
  )
}
