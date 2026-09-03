'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { operatorTheme as T } from '@/lib/operator/theme'
import type { ProposalStatus } from '@/lib/proposals'

const actionBtn: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, padding: '5px 10px', borderRadius: '999px', textDecoration: 'none',
  border: `1px solid ${T.border}`, background: T.bg, color: T.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
}

/**
 * Proposal delivery/acceptance actions for one row in Manage → Partner
 * Profile. Mark as Sent / Mark as Accepted are manual operator
 * confirmations only — no email, no WhatsApp, no e-signature. Editing is
 * never offered here for a frozen (non-null version) proposal; View
 * Proposal always routes to the same /operator/create/proposal/[id] screen,
 * which itself decides whether to render the editable Working Draft or the
 * read-only Finalized view.
 */
export default function ProposalActions({
  proposalId, status, version, hasPdf,
}: {
  proposalId: string
  status: ProposalStatus
  version: number | null
  hasPdf: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function post(path: string, key: string) {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      const res = await fetch(path, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'That action failed.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function openPdf(mode: 'view' | 'download') {
    if (busy) return
    setBusy(mode)
    setError(null)
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/pdf-url?mode=${mode}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not open the PDF.')
        return
      }
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusy(null)
    }
  }

  async function handleCreateNewDraft() {
    if (busy) return
    setBusy('new-draft')
    setError(null)
    try {
      const res = await fetch(`/api/admin/proposals/${proposalId}/new-draft`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.proposal) {
        setError(data.error || 'Could not create a new draft.')
        return
      }
      router.push(`/operator/create/proposal/${data.proposal.id}`)
    } finally {
      setBusy(null)
    }
  }

  const isWorkingDraft = version === null

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Link href={`/operator/create/proposal/${proposalId}`} style={actionBtn}>
          View Proposal
        </Link>
        {hasPdf && (
          <>
            <button type="button" style={actionBtn} disabled={busy !== null} onClick={() => openPdf('view')}>
              {busy === 'view' ? 'Opening…' : 'View PDF'}
            </button>
            <button type="button" style={actionBtn} disabled={busy !== null} onClick={() => openPdf('download')}>
              {busy === 'download' ? 'Preparing…' : 'Download PDF'}
            </button>
          </>
        )}
        {status === 'finalized' && (
          <button type="button" style={actionBtn} disabled={busy !== null} onClick={() => post(`/api/admin/proposals/${proposalId}/mark-sent`, 'sent')}>
            {busy === 'sent' ? 'Saving…' : 'Mark as Sent'}
          </button>
        )}
        {status === 'sent' && (
          <button type="button" style={actionBtn} disabled={busy !== null} onClick={() => post(`/api/admin/proposals/${proposalId}/mark-accepted`, 'accepted')}>
            {busy === 'accepted' ? 'Saving…' : 'Mark as Accepted'}
          </button>
        )}
        {!isWorkingDraft && (
          <button type="button" style={actionBtn} disabled={busy !== null} onClick={handleCreateNewDraft}>
            {busy === 'new-draft' ? 'Creating…' : 'Create New Draft'}
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: '11px', color: T.statusRed, margin: '6px 0 0' }}>{error}</p>}
    </div>
  )
}
