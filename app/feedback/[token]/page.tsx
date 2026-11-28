'use client'

import { useState } from 'react'

// "Tell us privately" from the review email. Goes straight to the owner.
export default function FeedbackPage({ params }: { params: { token: string } }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  async function send() {
    setBusy(true); setError('')
    const r = await fetch(`/api/feedback/${params.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) }).catch(() => null)
    const j = await r?.json().catch(() => ({}))
    setBusy(false)
    if (!r?.ok) { setError(j?.error || 'Something went wrong. Please try again.'); return }
    setDone(true)
  }
  return (
    <main style={{ minHeight: '100vh', background: '#1A0015', color: '#fff', fontFamily: 'Inter, sans-serif', padding: '28px 18px' }}>
      <div style={{ maxWidth: '460px', margin: '0 auto' }}>
        <a href="/" aria-label="Bangkok Club Crawl home" style={{ display: 'inline-block', marginBottom: '14px' }}>
          <img src="/images/bcc-logo.png" alt="Bangkok Club Crawl" style={{ height: '50px', width: 'auto', display: 'block' }} />
        </a>
        {done ? (
          <>
            <h1 style={{ fontSize: '22px', margin: '0 0 10px' }}>Thank you 🙏</h1>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>Your message went straight to our team. We read every one, and we’ll reply by email if there’s anything we can do.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '22px', margin: '0 0 8px' }}>Tell us privately</h1>
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: '0 0 14px' }}>What could we do better? Anything about the hosts, venues, transport or the night itself — it comes straight to us.</p>
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} placeholder="Your feedback…"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', borderRadius: '12px', padding: '12px', background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', fontSize: '16px', fontFamily: 'inherit' }} />
            {error && <p role="alert" style={{ color: '#FCA5A5', fontSize: '14px' }}>{error}</p>}
            <button onClick={send} disabled={busy || text.trim().length < 2}
              style={{ width: '100%', height: '50px', marginTop: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', opacity: busy || text.trim().length < 2 ? 0.5 : 1 }}>
              {busy ? 'Sending…' : 'Send to the team'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
