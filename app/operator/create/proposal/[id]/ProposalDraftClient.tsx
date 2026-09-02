'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Save, MessageSquarePlus, Eye, FileText, Download, PlusCircle } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import type { Proposal, ProposalDealVariable } from '@/lib/proposals'

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
  background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { ...eyebrow(T.textFaint), display: 'block', marginBottom: '5px' }
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: T.radiusSm,
  border: `1px solid ${T.border}`, background: T.bgElevated, color: T.text, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
}
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: T.radiusSm, border: 'none',
  fontSize: '12.5px', fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  background: disabled ? T.chipBg : T.accent, color: disabled ? T.textFaint : T.bg,
})
const savedBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: T.radiusSm, border: 'none',
  fontSize: '12.5px', fontWeight: 700, cursor: 'default', background: T.statusGreenSoft, color: T.statusGreen,
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ ...eyebrow(T.textFaint), margin: '18px 0 9px' }}>{children}</p>
}

async function patchProposal(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/proposals/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data } as { ok: boolean; data: { proposal?: Proposal; error?: string } }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })
}

async function openPdf(proposalId: string, mode: 'view' | 'download', setError: (e: string | null) => void, setBusy: (b: string | null) => void) {
  setBusy(mode === 'view' ? 'view-pdf' : 'download-pdf')
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

/** The frozen, finalized-version view: no editing, only status + PDF access + Create New Draft. */
function FinalizedView({ proposal, partnerName, finalizedByName }: { proposal: Proposal; partnerName: string; finalizedByName: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCreateNewDraft() {
    if (busy) return
    setBusy('new-draft')
    setError(null)
    try {
      const res = await fetch(`/api/admin/proposals/${proposal.id}/new-draft`, { method: 'POST' })
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

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', color: T.statusGreen, background: T.statusGreenSoft }}>
          Version {proposal.version} · Finalized
        </span>
        {proposal.businessContexts.map((c) => (
          <span key={c} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{c}</span>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: T.textFaint, margin: '2px 0 0' }}>{partnerName}</p>

      <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '14px 16px', margin: '16px 0' }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: T.textFaint }}>Finalized</span>
            <span style={{ fontSize: '12.5px', color: T.text }}>{proposal.approvedAt ? formatDateTime(proposal.approvedAt) : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: T.textFaint }}>Finalized by</span>
            <span style={{ fontSize: '12.5px', color: T.text }}>{finalizedByName ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: T.textFaint }}>PDF</span>
            <span style={{ fontSize: '12.5px', color: proposal.pdfStoragePath ? T.statusGreen : T.statusRed }}>
              {proposal.pdfStoragePath ? 'Available' : 'Missing'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Link href={`/operator/create/proposal/${proposal.id}/preview`} style={{ ...secondaryBtn, textDecoration: 'none' }}>
          <Eye size={13} /> View Proposal
        </Link>
        <button type="button" style={secondaryBtn} disabled={busy !== null} onClick={() => openPdf(proposal.id, 'view', setError, setBusy)}>
          <FileText size={13} /> {busy === 'view-pdf' ? 'Opening…' : 'View PDF'}
        </button>
        <button type="button" style={secondaryBtn} disabled={busy !== null} onClick={() => openPdf(proposal.id, 'download', setError, setBusy)}>
          <Download size={13} /> {busy === 'download-pdf' ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>

      <SectionLabel>Next round</SectionLabel>
      <button type="button" style={primaryBtn(busy !== null)} disabled={busy !== null} onClick={handleCreateNewDraft}>
        <PlusCircle size={13} /> {busy === 'new-draft' ? 'Creating…' : 'Create New Draft'}
      </button>
      <p style={{ fontSize: '11px', color: T.textFaint, margin: '8px 0 0' }}>
        Starts a fresh Working Draft in the same series, seeded from this version's content with current deal terms merged in. It becomes Version {(proposal.version ?? 0) + 1} once finalized.
      </p>

      {error && <p style={{ fontSize: '12.5px', color: T.statusRed, marginTop: '12px' }}>{error}</p>}
    </div>
  )
}

export default function ProposalDraftClient({
  proposal: initial,
  partnerName,
  finalizedByName,
}: {
  proposal: Proposal
  partnerName: string
  finalizedByName?: string | null
}) {
  const router = useRouter()
  const [proposal, setProposal] = useState(initial)
  const [draftContent, setDraftContent] = useState(initial.draftContent ?? '')
  const [dealVariables, setDealVariables] = useState<ProposalDealVariable[]>(initial.dealTermsSnapshot)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [termsSaved, setTermsSaved] = useState(false)

  const isWorkingDraft = proposal.version === null

  useEffect(() => {
    if (!termsSaved) return
    const t = setTimeout(() => setTermsSaved(false), 2200)
    return () => clearTimeout(t)
  }, [termsSaved])

  async function run(action: string, body: Record<string, unknown>, onDone?: (p: Proposal) => void) {
    if (busy) return
    setBusy(action)
    setError(null)
    setNote(null)
    try {
      const { ok, data } = await patchProposal(proposal.id, { action, ...body })
      if (!ok || !data.proposal) {
        setError(data.error || 'That action failed.')
        return
      }
      setProposal(data.proposal)
      setDraftContent(data.proposal.draftContent ?? '')
      onDone?.(data.proposal)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (!isWorkingDraft) {
    return <FinalizedView proposal={proposal} partnerName={partnerName} finalizedByName={finalizedByName ?? null} />
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', color: T.statusAmber, background: T.statusAmberSoft }}>Working Draft</span>
        {proposal.businessContexts.map((c) => (
          <span key={c} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{c}</span>
        ))}
      </div>
      <p style={{ fontSize: '11px', color: T.textFaint, margin: '2px 0 0' }}>
        Revision {proposal.draftRevision} · {partnerName}
      </p>

      <Link
        href={`/operator/create/proposal/${proposal.id}/preview`}
        style={{ ...primaryBtn(false), textDecoration: 'none', marginTop: '12px', width: '100%', justifyContent: 'center' }}
      >
        <Eye size={14} /> Preview Proposal
      </Link>

      <SectionLabel>Draft content</SectionLabel>
      <textarea
        value={draftContent}
        onChange={(e) => setDraftContent(e.target.value)}
        style={{ ...fieldStyle, minHeight: '260px', resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '12.5px', lineHeight: 1.6 }}
      />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
        <button type="button" style={primaryBtn(busy !== null || draftContent === proposal.draftContent)} disabled={busy !== null || draftContent === proposal.draftContent} onClick={() => run('edit', { draftContent })}>
          <Save size={13} /> {busy === 'edit' ? 'Saving…' : 'Save'}
        </button>
        <button type="button" style={secondaryBtn} disabled={busy !== null} onClick={() => run('regenerate', {})}>
          <RefreshCw size={13} /> {busy === 'regenerate' ? 'Regenerating…' : 'Regenerate Draft'}
        </button>
      </div>

      <SectionLabel>Request changes</SectionLabel>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Describe the change you want, e.g. 'Make the tone warmer' or 'Emphasize the guaranteed traffic term'"
        style={{ ...fieldStyle, minHeight: '70px', resize: 'vertical' }}
      />
      <button
        type="button"
        style={{ ...secondaryBtn, marginTop: '8px' }}
        disabled={busy !== null || !instruction.trim()}
        onClick={() => run('request-changes', { instruction }, () => setInstruction(''))}
      >
        <MessageSquarePlus size={13} /> {busy === 'request-changes' ? 'Applying…' : 'Request Changes'}
      </button>

      <SectionLabel>Deal variables</SectionLabel>
      <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '4px 14px' }}>
        {dealVariables.map((v, i) => (
          <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
            <span style={{ fontSize: '12px', color: T.textMuted, flex: '0 0 40%' }}>{v.label}{v.required ? ' *' : ''}</span>
            <input
              value={v.value ?? ''}
              onChange={(e) => setDealVariables((vars) => vars.map((x) => (x.key === v.key ? { ...x, value: e.target.value } : x)))}
              placeholder="TBD"
              style={{ ...fieldStyle, flex: 1, padding: '7px 10px', fontSize: '12.5px' }}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        style={{ ...(termsSaved ? savedBtn : primaryBtn(busy !== null)), marginTop: '10px' }}
        disabled={busy !== null}
        onClick={() => run('update-deal-variables', { dealVariables }, () => setTermsSaved(true))}
      >
        <Save size={13} /> {busy === 'update-deal-variables' ? 'Saving…' : termsSaved ? 'Saved ✓' : 'Save Terms'}
      </button>
      <p style={{ fontSize: '11px', color: T.textFaint, margin: '6px 0 0' }}>
        Saving terms does not change the draft wording. Use Regenerate Draft above if you want the proposal text updated to match.
      </p>

      {proposal.contextForProposal && (
        <>
          <SectionLabel>Context for proposal</SectionLabel>
          <p style={{ fontSize: '12.5px', color: T.textMuted, lineHeight: 1.6, margin: 0 }}>{proposal.contextForProposal}</p>
        </>
      )}
      {proposal.writingDirection && (
        <>
          <SectionLabel>Writing direction</SectionLabel>
          <p style={{ fontSize: '12.5px', color: T.textMuted, lineHeight: 1.6, margin: 0 }}>{proposal.writingDirection}</p>
        </>
      )}

      {note && <p style={{ fontSize: '12px', color: T.textMuted, marginTop: '12px' }}>{note}</p>}
      {error && <p style={{ fontSize: '12.5px', color: T.statusRed, marginTop: '12px' }}>{error}</p>}
    </div>
  )
}
