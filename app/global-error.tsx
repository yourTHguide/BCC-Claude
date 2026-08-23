'use client'

import { useEffect } from 'react'
import { clientDebugLog, isDiagnosticEnvironment } from '@/lib/clientDebugLog'

// Root-level fallback for any client-side error outside a more specific
// boundary (e.g. the root layout itself, or a public page). Next.js
// requires this file to render its own <html>/<body> since it replaces the
// root layout when triggered. Before this file existed, the app had NO
// error boundary anywhere, so any unhandled client-side exception fell
// through to Next.js's generic, dead-end "Application error" screen.
//
// TEMPORARY (Stage 9 real-iPhone crash diagnosis) -- same as
// app/dashboard/error.tsx: diagnostic detail + the debug-log POST only
// activate off the real production hostname. Trim back once the real root
// cause is found and fixed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const diagnostic = isDiagnosticEnvironment()

  useEffect(() => {
    console.error('Global error boundary caught:', error)
    clientDebugLog('global_error_boundary_caught', {
      name: error?.name ?? null,
      message: error?.message ?? null,
      digest: error?.digest ?? null,
      stack: error?.stack ?? null,
      stringified: String(error),
    })
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
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.50)', marginBottom: diagnostic ? '12px' : '24px' }}>
              {error.message || 'Unknown error'}
            </p>
            {diagnostic && (
              <div
                style={{
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '24px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.70)',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}
              >
                <div>path: {typeof window !== 'undefined' ? window.location.pathname : 'n/a'}</div>
                <div>name: {error?.name || 'n/a'}</div>
                <div>digest: {error?.digest || 'n/a'}</div>
                <div>String(error): {String(error)}</div>
                <div style={{ marginTop: '6px' }}>stack:</div>
                <div>{error?.stack || 'n/a'}</div>
              </div>
            )}
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
