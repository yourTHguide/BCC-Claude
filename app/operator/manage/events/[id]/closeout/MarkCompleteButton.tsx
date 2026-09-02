'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'

const TERMINAL_VERDICTS = ['Completed', 'Reviewed', 'Cancelled / Rescheduled']

// operation_verdict is a real, already-used production field —
// 'Completed' already exists in live data today, set through this exact
// same PATCH route via the dashboard's own verdict dropdown. This button
// does not introduce a new "closeout" concept; it sets the one field
// production already uses to mean "this operation is done."
//
// host_payment_status is NOT coupled to operation_verdict anywhere in
// production (checked: no gating in app/dashboard/page.tsx or the PATCH
// route) — and live data already has a real Completed row with host
// payment "Not calculated". Completing with payment pending is existing,
// legitimate behavior, not a gap to close — so this stays a confirmation,
// never a block.
export default function MarkCompleteButton({
  id,
  operationVerdict,
  hostPaymentStatus,
}: {
  id: string
  operationVerdict: string
  hostPaymentStatus: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  if (TERMINAL_VERDICTS.includes(operationVerdict)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '13px', borderRadius: T.radiusSm, background: T.statusGreenSoft, border: `1px solid rgba(61,214,140,0.3)` }}>
        <CheckCircle2 size={17} color={T.statusGreen} />
        <p style={{ fontSize: '13.5px', fontWeight: 600, margin: 0, color: T.text }}>Marked {operationVerdict.toLowerCase()}</p>
      </div>
    )
  }

  async function markComplete() {
    const message = hostPaymentStatus !== 'Paid'
      ? `Close out this event? Host payment is still "${hostPaymentStatus}", not Paid. You can still mark it Paid later — this only sets the operation status.`
      : 'Close out this event? This sets its status to Completed.'
    if (!confirm(message)) return
    setSaving(true)
    try {
      await fetch(`/api/admin/dashboard/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationVerdict: 'Completed' }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      disabled={saving}
      onClick={markComplete}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '14px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
    >
      <CheckCircle2 size={18} /> {saving ? 'Closing out…' : 'Close Out Event'}
    </button>
  )
}
