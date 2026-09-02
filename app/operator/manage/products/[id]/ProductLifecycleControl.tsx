'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

// Ports app/dashboard/products/[id]/page.tsx's Publish/Deactivate logic
// verbatim — same two existing routes, same business rules (publishing
// requires "Show on BCC" since checkout only ever gates on visible_bcc; a
// missing default price or zero upcoming open instances gets the same
// warning, not a hard block). No new mutation invented — Basic Info/Pricing
// stay read-only elsewhere on this page per the approved Phase 2C scope.
export default function ProductLifecycleControl({
  productId,
  status,
  visibleBcc,
  visibleBnt,
  defaultPrice,
  upcomingOpen,
}: {
  productId: string
  status: 'active' | 'draft' | 'archived'
  visibleBcc: boolean
  visibleBnt: boolean
  defaultPrice: number | null
  upcomingOpen: number
}) {
  const router = useRouter()
  const [panelOpen, setPanelOpen] = useState(false)
  const [pendingBcc, setPendingBcc] = useState(visibleBcc)
  const [pendingBnt, setPendingBnt] = useState(visibleBnt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    flex: 1, padding: '9px', borderRadius: T.radiusSm, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${on ? T.statusGreen : T.border}`, background: on ? T.statusGreenSoft : T.bgElevated,
    color: on ? T.statusGreen : T.textMuted,
  })

  async function handleActivate() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleBcc: pendingBcc, visibleBnt: pendingBnt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not publish this product.')
        return
      }
      setPanelOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate() {
    if (busy) return
    if (!confirm('Deactivate this product? It will immediately disappear from all storefronts and become unbookable. Its schedule and Event Instances are kept as-is.')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${productId}/deactivate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not deactivate this product.')
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (status === 'archived') return null

  return (
    <div>
      {error && (
        <div style={{ background: T.statusRedSoft, border: `1px solid ${T.statusRed}`, borderRadius: T.radiusSm, padding: '10px 12px', marginBottom: '10px', color: T.statusRed, fontSize: '12.5px' }}>
          {error}
        </div>
      )}

      {status === 'draft' && !panelOpen && (
        <button
          type="button"
          onClick={() => { setPendingBcc(visibleBcc); setPendingBnt(visibleBnt); setError(null); setPanelOpen(true) }}
          style={{ width: '100%', padding: '12px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
        >
          Publish…
        </button>
      )}

      {status === 'draft' && panelOpen && (
        <div style={{ padding: '13px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm }}>
          {upcomingOpen === 0 && (
            <p style={{ fontSize: '11.5px', color: T.statusAmber, margin: '0 0 8px' }}>No upcoming open Event Instances yet — it will be Active but nothing will be bookable until dates are open.</p>
          )}
          {defaultPrice == null && (
            <p style={{ fontSize: '11.5px', color: T.statusAmber, margin: '0 0 8px' }}>No default price set — instances without their own price override won&rsquo;t be bookable.</p>
          )}
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '6px' }}>Storefront visibility</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button type="button" style={toggleStyle(pendingBcc)} onClick={() => setPendingBcc((v) => !v)}>{pendingBcc ? '✓ ' : ''}Show on BCC</button>
            <button type="button" style={toggleStyle(pendingBnt)} onClick={() => setPendingBnt((v) => !v)}>{pendingBnt ? '✓ ' : ''}Show on BNT</button>
          </div>
          {!pendingBcc && (
            <p style={{ fontSize: '11px', color: T.statusAmber, margin: '0 0 10px' }}>
              BCC is the only storefront checkout currently supports — publishing requires &ldquo;Show on BCC&rdquo;.
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" disabled={busy} onClick={() => { setPanelOpen(false); setError(null) }} style={{ flex: 1, padding: '10px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: 'transparent', color: T.textMuted, fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button" disabled={!pendingBcc || busy} onClick={handleActivate} style={{ flex: 1, padding: '10px', borderRadius: T.radiusSm, border: 'none', background: !pendingBcc || busy ? T.chipBg : T.accent, color: !pendingBcc || busy ? T.textFaint : '#fff', fontWeight: 600, fontSize: '13px', cursor: !pendingBcc || busy ? 'not-allowed' : 'pointer' }}>
              {busy ? 'Publishing…' : 'Confirm Publish'}
            </button>
          </div>
        </div>
      )}

      {status === 'active' && (
        <button
          type="button"
          disabled={busy}
          onClick={handleDeactivate}
          style={{ width: '100%', padding: '12px', borderRadius: T.radiusSm, border: `1px solid ${T.statusRed}`, background: T.statusRedSoft, color: T.statusRed, fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
        >
          {busy ? 'Deactivating…' : 'Deactivate'}
        </button>
      )}
    </div>
  )
}
