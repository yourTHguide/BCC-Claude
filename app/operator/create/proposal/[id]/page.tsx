import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getProposal } from '@/lib/proposals'
import { getPartner } from '@/lib/partners'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import ProposalDraftClient from './ProposalDraftClient'

export const dynamic = 'force-dynamic'

// Phase 3E: the Working Draft screen. Edit / Regenerate / Request Changes /
// Save deal variables — every action is a plain UPDATE on this same row
// (lib/proposals.ts), never assigns `version`. No Finalize & Generate PDF
// button exists anywhere on this screen; that's a later phase.
export default async function ProposalDraftPage({ params }: { params: { id: string } }) {
  const proposal = await getProposal(params.id)
  if (!proposal) notFound()
  const partner = await getPartner(proposal.partnerId)
  if (!partner) notFound()

  return (
    <div style={{ padding: '20px 18px 40px' }}>
      <Link href="/operator/create/proposal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> New Proposal
      </Link>
      <p style={eyebrow(T.textFaint)}>Create · Partner + Proposal</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>{proposal.title}</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 18px' }}>{partner.displayName}</p>

      <ProposalDraftClient proposal={proposal} partnerName={partner.displayName} />
    </div>
  )
}
