'use client'

import { useEffect } from 'react'
import { clientDebugLog, isDiagnosticEnvironment } from '@/lib/clientDebugLog'

// The /dashboard subtree (including /dashboard/checkin/[token], the QR
// check-in resolver) previously had NO error boundary anywhere in the app —
// any unhandled client-side render error fell through to Next.js's generic,
// dead-end "Application error: a client-side exception has occurred" with no
// retry path and no visible detail. This is the first boundary in the app,
// scoped to /dashboard so a host mid-scan gets a recoverable screen instead
// of a blank crash, and so an occurrence shows the real error instead of
// requiring another round of blind diagnosis.
//
// TEMPORARY (Stage 9 real-iPhone crash diagnosis): the diagnostic block
// below -- on-screen error detail and the debug-log POST -- only activates
// off the real production hostname (bkkclubcrawl.com), so production never
// shows raw error internals. Trim back to just the generic message + Try
// Again once the real root cause is found and fixed.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const diagnostic = isDiagnosticEnvironment()

  useEffect(() => {
    console.error('Dashboard error boundary caught:', error)
    clientDebugLog('error_boundary_caught', {
      name: error?.name ?? null,
      message: error?.message ?? null,
      digest: error?.digest ?? null,
      stack: error?.stack ?? null,
      stringified: String(error),
    })
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D000A',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <p
          style={{
            fontWeight: 600,
            fontSize: '10px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#EA003A',
            marginBottom: '8px',
          }}
        >
          Something Went Wrong
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: '4px' }}>
          This screen hit an unexpected error. Your action may or may not have
          gone through — check before repeating it.
        </p>
        <p
          style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.35)',
            wordBreak: 'break-word',
            marginBottom: diagnostic ? '12px' : '24px',
          }}
        >
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
            width: '100%',
            height: '46px',
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
  )
}
