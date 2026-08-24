'use client'

import { useEffect } from 'react'

// Root-level fallback for any client-side error outside a more specific
// boundary (e.g. the root layout itself, or a public page). Next.js
// requires this file to render its own <html>/<body> since it replaces the
// root layout when triggered. Before this file existed, the app had NO
// error boundary anywhere, so any unhandled client-side exception fell
// through to Next.js's generic, dead-end "Application error" screen.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error boundary caught:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px 20px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <p style={{ fontWeight: 600, fontSize: '18px', marginBottom: '8px' }}>Something went wrong</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', marginBottom: '24px' }}>
              {error.message || 'Unknown error'}
            </p>
            <button
              onClick={reset}
              style={{
                height: '46px',
                padding: '0 32px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg,#EA003A,#820065)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
