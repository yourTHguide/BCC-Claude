'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HOSTS, VERDICT_OPTIONS, VERDICT_REQUIRING_CONFIRM } from '@/lib/operator/eventOps'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

// The three quick operational controls the mockup's Overview implies are
// actionable (status/open/host). All three PATCH the exact existing
// app/api/admin/dashboard/events/[id] route — same allowlisted keys the
// desktop day panel uses, no new endpoint. Verdict transitions the
// dashboard gates with a confirm prompt keep that gate here too
// (app/dashboard/page.tsx:10) — via native confirm(), not a rebuilt modal.
export default function OverviewControls({
  id,
  isOpen,
  hostAssigned,
  operationVerdict,
}: {
  id: string
  isOpen: boolean
  hostAssigned: string | null
  operationVerdict: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

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

  function onVerdictChange(next: string) {
    if (VERDICT_REQUIRING_CONFIRM.includes(next) && !confirm(`Set operation status to "${next}"?`)) return
    patch({ operationVerdict: next })
  }

  const fieldStyle = {
    width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'grid', gap: '10px', marginBottom: '18px', opacity: saving ? 0.6 : 1 }}>
      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Status</p>
        <select value={operationVerdict} disabled={saving} onChange={(e) => onVerdictChange(e.target.value)} style={fieldStyle}>
          {VERDICT_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Host</p>
          <select value={hostAssigned ?? ''} disabled={saving} onChange={(e) => patch({ hostAssigned: e.target.value || null })} style={fieldStyle}>
            <option value="">Unassigned</option>
            {HOSTS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          {/* Deliberately labeled "Sales", distinct from the operational
              "Status" field above — is_open governs bookability, not
              whether the operation itself is confirmed/completed. Same
              field, same PATCH, copy-only change. */}
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Sales</p>
          <button
            type="button"
            disabled={saving}
            onClick={() => patch({ isOpen: !isOpen })}
            style={{ ...fieldStyle, textAlign: 'left', cursor: 'pointer', color: isOpen ? T.statusGreen : T.statusRed }}
          >
            {isOpen ? 'Open — tap to close sales' : 'Closed — tap to open sales'}
          </button>
        </div>
      </div>
    </div>
  )
}
