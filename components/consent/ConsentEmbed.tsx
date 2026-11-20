'use client'

import { useState } from 'react'
import { useConsent } from '@/lib/consent'

// Third-party embed (Elfsight reviews, Google Maps) that loads only after the
// visitor accepted non-essential cookies, or clicked "Show" for this page
// view. Until then a placeholder explains what would load and from whom.
export default function ConsentEmbed({
  provider,
  what,
  showLabel,
  children,
  fallbackLink,
  minHeight = 160,
}: {
  provider: string
  what: string
  showLabel: string
  children: React.ReactNode
  fallbackLink?: { href: string; label: string }
  minHeight?: number
}) {
  const consent = useConsent()
  const [once, setOnce] = useState(false)
  if (consent === 'all' || once) return <>{children}</>
  return (
    <div
      className="consent-embed"
      style={{
        minHeight,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 20,
        textAlign: 'center',
        border: '1px dashed rgba(255,255,255,0.2)',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        color: 'rgba(255,255,255,0.75)',
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
        lineHeight: 1.5,
        boxSizing: 'border-box',
      }}
    >
      <span>
        {what} {provider} may set cookies, so it loads only if you allow it.
      </span>
      <button
        type="button"
        onClick={() => setOnce(true)}
        style={{ border: '1px solid rgba(255,255,255,0.35)', background: 'transparent', color: '#FFFFFF', borderRadius: 9999, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        {showLabel}
      </button>
      {fallbackLink && (
        <a href={fallbackLink.href} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
          {fallbackLink.label}
        </a>
      )}
    </div>
  )
}
