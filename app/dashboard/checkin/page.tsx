'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const READER_ELEMENT_ID = 'qr-reader-region'

// Direct mobile scanner entry point (revised Stage 9d). This is what
// "SNX/BCC Operations → Scan Ticket" opens — a live camera view, not an
// event/date picker. Deliberately carries no product/event/date coupling:
// the QR itself identifies the canonical Booking, so this component is
// meant to become the future SNX Mobile Operations global "Scan" action
// unchanged, just re-hosted under a different nav.
//
// Uses html5-qrcode (a maintained, dependency-free scanning library) for
// camera access + decoding rather than hand-rolling getUserMedia/canvas
// decoding. Dynamically imported inside useEffect so nothing camera-related
// runs during server rendering. On a successful decode this does nothing
// but extract the token and navigate to the existing
// /dashboard/checkin/[token] resolver — the canonical booking resolution
// and check-in logic is NOT duplicated here.
function extractToken(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/checkin\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : trimmed
}

export default function ScanTicketPage() {
  const router = useRouter()
  const scannedRef = useRef(false)
  const [cameraState, setCameraState] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState('')

  useEffect(() => {
    let cancelled = false
    let instance: import('html5-qrcode').Html5Qrcode | null = null
    // Root cause of the real-iPhone check-in crash (PHASE4_CHECKPOINT.md
    // Stage 9): html5-qrcode's stop() throws SYNCHRONOUSLY (not a rejected
    // promise) if called while the scanner isn't running/paused. The
    // onScanSuccess callback below already stops the scanner before
    // navigating away; when that navigation then unmounts this component,
    // the cleanup below used to call stop() a SECOND time unconditionally —
    // on an instance already stopped, throwing "Cannot stop, scanner is not
    // running or paused" synchronously, which .catch(() => {}) can never
    // intercept (the throw happens before stop() returns a promise to
    // attach a handler to). React then attributes that cleanup-phase throw
    // to the nearest error boundary, which by then renders over whatever
    // route the navigation had already committed to. This ref tracks
    // whether OUR code still considers the scanner running, set to false
    // synchronously the moment we decide to stop it, so the cleanup never
    // attempts a redundant stop() in the first place.
    let running = false

    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        instance = new Html5Qrcode(READER_ELEMENT_ID)
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            // Guard against multiple frames decoding the same code before
            // stop() finishes — navigate exactly once per scan.
            if (cancelled || scannedRef.current) return
            scannedRef.current = true
            running = false
            const token = extractToken(decodedText)
            instance!
              .stop()
              .catch(() => {})
              .finally(() => {
                if (!cancelled) router.push(`/dashboard/checkin/${encodeURIComponent(token)}`)
              })
          },
          () => {
            // Per-frame "no code found this frame" — expected continuously
            // while aiming the camera, not an error.
          }
        )
        running = true
        if (!cancelled) setCameraState('scanning')
      } catch (err: any) {
        if (!cancelled) {
          setCameraState('error')
          setCameraError(
            err?.message?.includes('Permission')
              ? 'Camera permission was denied. Allow camera access and reload, or enter the code manually below.'
              : 'Camera unavailable on this device. Enter the code manually below.'
          )
        }
      }
    }

    start()

    return () => {
      cancelled = true
      if (instance && running) {
        running = false
        // Defense in depth: still guard the (now much rarer) case with a
        // real try/catch, not just .catch(), since a synchronous throw
        // bypasses .catch() entirely.
        try {
          instance.stop().catch(() => {})
        } catch {
          // stop() can throw synchronously if the scanner isn't running.
        }
      }
    }
  }, [router])

  function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const token = extractToken(manualValue)
    if (token) router.push(`/dashboard/checkin/${encodeURIComponent(token)}`)
  }

  const S = {
    page: {
      minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif',
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '24px 20px 40px',
    },
    back: { color: 'rgba(255,255,255,0.50)', fontSize: '13px', textDecoration: 'none' },
    viewport: {
      position: 'relative' as const, width: '100%', aspectRatio: '1 / 1', borderRadius: '16px',
      overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.10)', marginTop: '18px',
    },
    overlay: {
      position: 'absolute' as const, inset: 0, display: 'flex', flexDirection: 'column' as const,
      alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const, padding: '24px',
      background: 'rgba(13,0,10,0.85)',
    },
    secondaryBtn: {
      width: '100%', height: '46px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.14)',
      background: 'rgba(255,255,255,0.06)', color: '#fff', fontFamily: 'Inter, sans-serif',
      fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginTop: '16px',
    },
    input: {
      width: '100%', height: '44px', borderRadius: '8px', padding: '0 14px',
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
      color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', marginBottom: '10px', outline: 'none',
    },
    primaryBtn: {
      width: '100%', height: '44px', borderRadius: '8px', border: 'none',
      background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff',
      fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
    },
  }

  return (
    <div style={S.page}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <Link href="/dashboard" style={S.back}>← Back to Event Operations</Link>
        <h1 style={{ fontSize: '20px', margin: '16px 0 4px' }}>Scan Ticket</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
          Point the camera at the guest&apos;s QR code — it resolves automatically.
        </p>

        <div style={S.viewport}>
          <div id={READER_ELEMENT_ID} style={{ width: '100%', height: '100%' }} />
          {cameraState === 'starting' && (
            <div style={S.overlay}>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.60)' }}>Starting camera…</p>
            </div>
          )}
          {cameraState === 'error' && (
            <div style={S.overlay}>
              <p style={{ fontSize: '13px', color: '#fff', lineHeight: 1.6 }}>{cameraError}</p>
            </div>
          )}
        </div>

        {!manualOpen ? (
          <button onClick={() => setManualOpen(true)} style={S.secondaryBtn}>
            Enter code manually
          </button>
        ) : (
          <form onSubmit={submitManual} style={{ marginTop: '16px' }}>
            <input
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="Ticket code"
              autoFocus
              style={S.input}
            />
            <button type="submit" style={S.primaryBtn}>Look up ticket</button>
          </form>
        )}
      </div>
    </div>
  )
}
