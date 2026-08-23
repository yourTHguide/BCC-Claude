'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Scan Ticket landing (Stage 9d). Scanning a guest's QR with the phone's own
// camera app opens /dashboard/checkin/[token] directly — no in-app camera
// code needed for that path at all, since the QR already encodes that full
// URL (see lib/qrTicket.ts). This page exists for the fallback: no camera
// handy, bad lighting, or a host at a desktop. Accepts either a bare token
// or a pasted URL ending in /checkin/<token>.
function extractToken(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/\/checkin\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : trimmed
}

export default function ScanTicketPage() {
  const router = useRouter()
  const [value, setValue] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const token = extractToken(value)
    if (token) router.push(`/dashboard/checkin/${encodeURIComponent(token)}`)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0D000A', fontFamily: 'Inter, sans-serif',
      padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <Link href="/dashboard" style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px', textDecoration: 'none' }}>
          ← Back to Event Operations
        </Link>
        <h1 style={{ fontSize: '22px', color: '#fff', margin: '16px 0 8px' }}>Scan Ticket</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '24px', lineHeight: 1.6 }}>
          Point your phone&apos;s camera at the guest&apos;s QR code — it opens their ticket
          directly. No camera handy? Paste or type their ticket code below.
        </p>
        <form onSubmit={submit}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ticket code"
            autoFocus
            style={{
              width: '100%', height: '44px', borderRadius: '8px', padding: '0 14px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', marginBottom: '12px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%', height: '44px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg,#EA003A,#820065)', color: '#fff',
              fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            Look up ticket
          </button>
        </form>
      </div>
    </div>
  )
}
