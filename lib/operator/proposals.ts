import 'server-only'

// SNX Phase 3C-2 — operator read shapes for the (not-yet-built) proposal/
// version history view. Server-only reads, same pattern as
// lib/operator/products.ts. No pages exist yet (Phase 3F+).

import { proposalsForSeries, type Proposal } from '@/lib/proposals'

export interface ProposalHistoryRow {
  id: string
  version: number | null
  isWorkingDraft: boolean
  status: string
  title: string
  draftRevision: number
  createdAt: string
  approvedAt: string | null
  pdfStoragePath: string | null
}

function toHistoryRow(p: Proposal): ProposalHistoryRow {
  return {
    id: p.id,
    version: p.version,
    isWorkingDraft: p.version === null,
    status: p.status,
    title: p.title,
    draftRevision: p.draftRevision,
    createdAt: p.createdAt,
    approvedAt: p.approvedAt,
    pdfStoragePath: p.pdfStoragePath,
  }
}

/** Full history of one proposal "line" for the Partner Profile's Proposals section — the current Working Draft (if any) first, then every Finalized Version newest-first. */
export async function getProposalHistoryForOperator(seriesId: string): Promise<ProposalHistoryRow[]> {
  const proposals = await proposalsForSeries(seriesId)
  return proposals.map(toHistoryRow)
}
