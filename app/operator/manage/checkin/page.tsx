'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

const READER_ELEMENT_ID = 'op-qr-reader-region'

// Phase 2D: in-shell mobile scanner, adapted from app/dashboard/checkin/page.tsx.
// Same html5-qrcode integration, same decode/extract/navigate semantics —
// only the destination and styling change (/operator/manage/checkin/[token]
// instead of /dashboard/checkin/[token]). QR generation, ticket_token
// minting, and the legacy /dashboard/checkin/* flow are all untouched and
// stay fully functional in parallel — a guest's QR still opens the legacy
// flow if scanned with a phone's own camera app, since it still encodes
// /dashboard/checkin/{token} unchanged (SNX_PHASE2D plan).
function extractToken(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/checkin\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : trimmed
}

export default function OperatorScanTicketPage() {
  const router = useRouter()
  const scannedRef = useRef(false)
  const [cameraState, setCameraState] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState('')

  useEffect(() => {
    let cancelled = false
    let instance: import('html5-qrcode').Html5Qrcode | null = null
    // Same iPhone-crash guard as the legacy scanner (PHASE4_CHECKPOINT.md
    // Stage 9): html5-qrcode's stop() can throw synchronously if called on
    // an instance that isn't running/paused. `running` tracks what OUR code
    // believes the scanner state is, so cleanup never issues a redundant
    // stop() after the success-path stop() already ran.
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
            if (cancelled || scannedRef.current) return
            scannedRef.current = true
            running = false
            const token = extractToken(decodedText)
            instance!
              .stop()
              .catch(() => {})
              .finally(() => {
                if (!cancelled) router.push(`/operator/manage/checkin/${encodeURIComponent(token)}`)
              })
          },
          () => {
            // Per-frame "no code found this frame" — expected, not an error.
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
    if (token) router.push(`/operator/manage/checkin/${encodeURIComponent(token)}`)
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', minHeight: '44px', padding: '12px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bgElevated, color: T.text, fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '10px',
  }

  return (
    <div style={{ padding: '20px 18px 32px' }}>
      <Link href="/operator/manage" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Manage
      </Link>
      <p style={eyebrow(T.textFaint)}>Check-in</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Scan Ticket</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 16px' }}>
        Point the camera at the guest&apos;s QR code — it resolves automatically.
      </p>

      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: T.radius, overflow: 'hidden', background: '#000', border: `1px solid ${T.border}` }}>
        <div id={READER_ELEMENT_ID} style={{ width: '100%', height: '100%' }} />
        {cameraState === 'starting' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', background: 'rgba(0,0,0,0.55)' }}>
            <p style={{ fontSize: '13px', color: '#fff' }}>Starting camera…</p>
          </div>
        )}
        {cameraState === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', background: 'rgba(0,0,0,0.75)' }}>
            <p style={{ fontSize: '13px', color: '#fff', lineHeight: 1.6 }}>{cameraError}</p>
          </div>
        )}
      </div>

      {!manualOpen ? (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          style={{ width: '100%', minHeight: '44px', padding: '12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.bgElevated, color: T.text, fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginTop: '16px', fontFamily: 'inherit' }}
        >
          Enter code manually
        </button>
      ) : (
        <form onSubmit={submitManual} style={{ marginTop: '16px' }}>
          <input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Ticket code"
            autoFocus
            style={fieldStyle}
          />
          <button
            type="submit"
            style={{ width: '100%', minHeight: '44px', padding: '12px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Look up ticket
          </button>
        </form>
      )}
    </div>
  )
}
