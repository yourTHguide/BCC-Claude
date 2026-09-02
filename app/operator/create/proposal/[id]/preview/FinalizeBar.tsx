'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronLeft, FileCheck2 } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'

const backLink: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none',
}
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: T.radiusSm, border: 'none',
  fontSize: '13px', fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  background: disabled ? T.chipBg : T.accent, color: disabled ? T.textFaint : T.bg,
})

/** Sticky-ish action bar above the read-only document: Back to Edit + (draft only) Finalize & Generate PDF. Preview never assigns version by itself — only a successful Finalize call does. */
export default function FinalizeBar({
  proposalId,
  canFinalize,
  version,
  draftRevision,
}: {
  proposalId: string
  canFinalize: boolean
  version: number | null
  /** The draft_revision this exact Preview render shows — sent to Finalize as a precondition so the generated PDF can never diverge from what was actually previewed. */
  draftRevision: number
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFinalize() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedDraftRevision: draftRevision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.proposal) {
        setError(data.error || 'Could not finalize this proposal.')
        return
      }
      router.push(`/operator/create/proposal/${proposalId}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <Link href={`/operator/create/proposal/${proposalId}`} style={backLink}>
          <ChevronLeft size={14} /> {canFinalize ? 'Back to Edit' : 'Back'}
        </Link>
        {canFinalize ? (
          <button type="button" style={primaryBtn(busy)} disabled={busy} onClick={handleFinalize}>
            <FileCheck2 size={14} /> {busy ? 'Finalizing…' : 'Finalize & Generate PDF'}
          </button>
        ) : (
          <span style={{ fontSize: '11.5px', color: T.textFaint }}>Version {version} · Finalized — read-only</span>
        )}
      </div>
      {error && <p style={{ fontSize: '12.5px', color: T.statusRed, margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}
