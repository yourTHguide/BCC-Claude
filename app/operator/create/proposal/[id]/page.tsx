import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getProposal } from '@/lib/proposals'
import { getPartner } from '@/lib/partners'
import { getServiceSupabase } from '@/lib/supabase'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import ProposalDraftClient from './ProposalDraftClient'

export const dynamic = 'force-dynamic'

// Phase 3E/3F: the proposal screen for one row — a Working Draft (Edit /
// Regenerate / Request Changes / Save deal variables / Preview, every action
// a plain UPDATE that never assigns `version`) or, once Finalize & Generate
// PDF has run, a frozen Finalized Version (read-only, PDF access, Create New
// Draft). ProposalDraftClient renders whichever branch applies.
export default async function ProposalDraftPage({ params }: { params: { id: string } }) {
  const proposal = await getProposal(params.id)
  if (!proposal) notFound()
  const partner = await getPartner(proposal.partnerId)
  if (!partner) notFound()

  // Resolve "Finalized by" to a real name, never a raw UUID — same pattern
  // as lib/operator/partners.ts's relationshipOwnerName resolution.
  let finalizedByName: string | null = null
  if (proposal.approvedBy) {
    const supabase = getServiceSupabase()
    const { data } = await supabase.from('admin_users').select('display_name').eq('user_id', proposal.approvedBy).maybeSingle()
    finalizedByName = (data as { display_name?: string | null } | null)?.display_name ?? null
  }

  return (
    <div style={{ padding: '20px 18px 40px' }}>
      <Link href="/operator/create/proposal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> New Proposal
      </Link>
      <p style={eyebrow(T.textFaint)}>Create · Partner + Proposal</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>{proposal.title}</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 18px' }}>{partner.displayName}</p>

      <ProposalDraftClient proposal={proposal} partnerName={partner.displayName} finalizedByName={finalizedByName} />
    </div>
  )
}
