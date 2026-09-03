import { notFound } from 'next/navigation'
import { getProposal } from '@/lib/proposals'
import { getPartner } from '@/lib/partners'
import { buildProposalDocument, type DocBlock, type DocRun } from '@/lib/proposalDocument'
import { humanizeBusinessContexts } from '@/lib/operator/businessContexts'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import FinalizeBar from './FinalizeBar'

export const dynamic = 'force-dynamic'

// Phase 3F: Proposal Preview — a clean, read-only presentation of the
// current Working Draft (or a past Finalized Version), built from the same
// buildProposalDocument()/proposal-writing-standard pipeline the PDF uses.
// No internal slugs, ids, status, or editing controls ever appear here.
// Viewing this page never assigns `version` — only the Finalize action on
// FinalizeBar does, and only for a Working Draft.

function runsText(runs: DocRun[]): React.ReactNode[] {
  return runs.map((r, i) => {
    const style: React.CSSProperties = { fontWeight: r.bold ? 700 : 400, fontStyle: r.italic ? 'italic' : 'normal' }
    return (
      <span key={i} style={style}>
        {r.text}
      </span>
    )
  })
}

function DocBlockView({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'heading': {
      const size = block.level <= 1 ? '18px' : block.level === 2 ? '15px' : '13px'
      return (
        <p style={{ fontSize: size, fontWeight: 700, color: '#1f2937', margin: '20px 0 8px' }}>
          {runsText(block.runs)}
        </p>
      )
    }
    case 'paragraph':
      return (
        <p style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.65, margin: '0 0 10px' }}>
          {runsText(block.runs)}
        </p>
      )
    case 'list':
      return block.ordered ? (
        <ol style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.6, marginBottom: '4px' }}>
              {runsText(item)}
            </li>
          ))}
        </ol>
      ) : (
        <ul style={{ margin: '0 0 12px', paddingLeft: '20px' }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ fontSize: '13.5px', color: '#374151', lineHeight: 1.6, marginBottom: '4px' }}>
              {runsText(item)}
            </li>
          ))}
        </ul>
      )
    case 'terms':
      return (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', margin: '0 0 14px' }}>
          {block.rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', borderTop: i > 0 ? '1px solid #e5e7eb' : 'none' }}>
              <div style={{ flex: '0 0 42%', padding: '9px 12px', fontSize: '12.5px', fontWeight: 700, color: '#1f2937', background: '#f9fafb' }}>
                {runsText(row.label)}
              </div>
              <div style={{ flex: 1, padding: '9px 12px', fontSize: '12.5px', color: '#1f2937' }}>{runsText(row.value)}</div>
            </div>
          ))}
        </div>
      )
    case 'table':
      return (
        <div style={{ overflowX: 'auto', margin: '0 0 14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            {block.header.length > 0 && (
              <thead>
                <tr>
                  {block.header.map((cell, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '8px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', color: '#1f2937' }}>
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '8px 10px', border: '1px solid #e5e7eb', color: '#374151' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'rule':
      return <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
  }
}

export default async function ProposalPreviewPage({ params }: { params: { id: string } }) {
  const proposal = await getProposal(params.id)
  if (!proposal) notFound()
  const partner = await getPartner(proposal.partnerId)
  if (!partner) notFound()

  const document = buildProposalDocument(proposal, partner.displayName)
  const contextLabel = humanizeBusinessContexts(proposal.businessContexts)
  // Phase 4 — this chrome (not part of document.blocks) mirrors the PDF's
  // own language: verification requires Preview and PDF to show the same
  // Thai content, so these labels shouldn't read English around a Thai body.
  const isTh = document.meta.language === 'th'

  return (
    <div style={{ padding: '20px 18px 40px' }}>
      <p style={eyebrow(T.textFaint)}>Create · Partner + Proposal · Preview</p>
      <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 14px' }}>Proposal Preview</h1>

      <FinalizeBar proposalId={proposal.id} canFinalize={proposal.version === null} version={proposal.version} draftRevision={proposal.draftRevision} />

      {/* The document itself — styled to read like the external artifact, not the operator shell. */}
      <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '28px 24px', color: '#1f2937' }}>
        <p style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7c3aed', margin: '0 0 6px' }}>
          {document.meta.preparedBy}
        </p>
        <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.02em', margin: '0 0 14px', color: '#111827' }}>{document.meta.title}</h2>

        <div style={{ display: 'grid', gap: '4px', marginBottom: '18px' }}>
          <p style={{ fontSize: '13.5px', margin: 0 }}>
            <span style={{ color: '#6b7280' }}>{isTh ? 'จัดทำสำหรับ: ' : 'Prepared for: '}</span>
            <strong>{document.meta.partnerName}</strong>
          </p>
          <p style={{ fontSize: '13px', margin: 0, color: '#6b7280' }}>
            {isTh ? 'บริบทธุรกิจ' : 'Business context'}: {contextLabel || '—'}
            {document.meta.product ? ` · ${document.meta.product}` : ''}
          </p>
          <p style={{ fontSize: '13px', margin: 0, color: '#6b7280' }}>{isTh ? 'จัดทำโดย' : 'Prepared by'}: {document.meta.preparedBy}</p>
          <p style={{ fontSize: '13px', margin: 0, color: '#6b7280' }}>{isTh ? 'วันที่' : 'Date'}: {document.meta.dateLabel}</p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0 0 18px' }} />

        {document.blocks.map((block, i) => (
          <DocBlockView key={i} block={block} />
        ))}
      </div>
    </div>
  )
}
