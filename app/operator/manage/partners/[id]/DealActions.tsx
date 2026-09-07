'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { operatorTheme as T } from '@/lib/operator/theme'
import type { PartnerDealStatus } from '@/lib/partners'

// Phase 3H: the practical Deal moves, mirrored from lib/partners.ts's
// DEAL_STATUS_TRANSITIONS (that file is server-only, so this client
// component can't import the const directly — this list exists purely to
// decide which buttons to render; the server route is the actual
// authority and will reject anything not in its own copy regardless).
const NEXT_STATUSES: Record<PartnerDealStatus, { status: PartnerDealStatus; label: string }[]> = {
  discussing: [
    { status: 'terms_agreed', label: 'Mark Terms Agreed' },
    { status: 'ended', label: 'End' },
  ],
  terms_agreed: [
    { status: 'active', label: 'Mark Active' },
    { status: 'ended', label: 'End' },
  ],
  active: [
    { status: 'paused', label: 'Pause' },
    { status: 'ended', label: 'End' },
  ],
  paused: [
    { status: 'active', label: 'Reactivate' },
    { status: 'ended', label: 'End' },
  ],
  ended: [],
}

// Visual-only distinction (Phase 3H refinement): the forward-moving action
// leads (accent, filled); a move into 'ended' — terminal, one-way — stays
// secondary/muted regardless of which status it's offered from.
const primaryActionBtn: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, padding: '6px 12px', borderRadius: '999px',
  border: 'none', background: T.accent, color: T.bg, cursor: 'pointer',
}
const secondaryActionBtn: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '999px',
  border: `1px solid ${T.border}`, background: T.bg, color: T.textMuted, cursor: 'pointer',
}

/** One contextual status action row for a Deal — not a CRM pipeline, just the one or two forward moves valid from its current status. */
export default function DealActions({ dealId, status }: { dealId: string; status: PartnerDealStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState<PartnerDealStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const next = NEXT_STATUSES[status]
  if (next.length === 0) return null

  async function handle(nextStatus: PartnerDealStatus) {
    if (busy) return
    setBusy(nextStatus)
    setError(null)
    try {
      const res = await fetch(`/api/admin/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not update the deal.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {next.map((n) => (
          <button
            key={n.status}
            type="button"
            style={n.status === 'ended' ? secondaryActionBtn : primaryActionBtn}
            disabled={busy !== null}
            onClick={() => handle(n.status)}
          >
            {busy === n.status ? 'Saving…' : n.label}
          </button>
        ))}
      </div>
      {error && <p style={{ fontSize: '11px', color: T.statusRed, margin: '6px 0 0' }}>{error}</p>}
    </div>
  )
}
