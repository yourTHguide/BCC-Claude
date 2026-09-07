'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { suggestedHostFee } from '@/lib/operator/eventOps'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

// Same formula, same field, same transitions as app/dashboard/page.tsx's
// useSuggestedFee()/saveHostFee()/markHostPaid() — all via the existing
// PATCH /api/admin/dashboard/events/[id] route.
export default function HostFeeControl({
  id,
  checkedInGuests,
  hostFeeFinal,
  hostPaymentStatus,
}: {
  id: string
  checkedInGuests: number
  hostFeeFinal: number | null
  hostPaymentStatus: string
}) {
  const router = useRouter()
  const [fee, setFee] = useState(hostFeeFinal != null ? String(hostFeeFinal) : '')
  const [saving, setSaving] = useState(false)
  const suggested = suggestedHostFee(checkedInGuests)

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    try {
      await fetch(`/api/admin/dashboard/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function useSuggested() {
    setFee(String(suggested))
    patch({ hostFeeFinal: suggested, ...(hostPaymentStatus === 'Not calculated' ? { hostPaymentStatus: 'Calculated' } : {}) })
  }

  function saveFee() {
    const n = Number(fee)
    if (Number.isNaN(n)) return
    patch({ hostFeeFinal: n, ...(hostPaymentStatus === 'Not calculated' ? { hostPaymentStatus: 'Calculated' } : {}) })
  }

  function markPaid() {
    if (!confirm('Mark host fee as paid?')) return
    patch({ hostPaymentStatus: 'Paid' })
  }

  const fieldStyle = {
    padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit',
  }

  return (
    <div style={{ marginBottom: '18px' }}>
      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>Host Fee</p>
      <p style={{ fontSize: '12px', color: T.textMuted, margin: '0 0 8px' }}>
        Suggested from {checkedInGuests} checked-in guest{checkedInGuests === 1 ? '' : 's'}: ฿{suggested.toLocaleString()}
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="number" inputMode="numeric" value={fee} disabled={saving}
          onChange={(e) => setFee(e.target.value)} onBlur={saveFee}
          placeholder="Final fee (฿)" style={{ ...fieldStyle, flex: 1 }}
        />
        <button type="button" disabled={saving} onClick={useSuggested} style={{ ...fieldStyle, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
          Use suggested
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
          color: hostPaymentStatus === 'Paid' ? T.statusGreen : T.statusAmber,
          background: hostPaymentStatus === 'Paid' ? T.statusGreenSoft : T.statusAmberSoft,
        }}>
          {hostPaymentStatus}
        </span>
        {hostPaymentStatus !== 'Paid' && (
          <button type="button" disabled={saving} onClick={markPaid} style={{ ...fieldStyle, cursor: 'pointer', padding: '8px 14px', fontSize: '12.5px' }}>
            Mark Paid
          </button>
        )}
      </div>
    </div>
  )
}
