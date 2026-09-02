import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPartners } from '@/lib/partners'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import ProposalSetupClient from './ProposalSetupClient'

export const dynamic = 'force-dynamic'

// Phase 3E: Create -> Partner + Proposal, step 1 — "Who is this proposal
// for?" Existing Partner (search over the same canonical partners table the
// Directory reads) or a minimal New Partner form. All partners fetched
// server-side once (small dataset, same no-pagination convention every
// other operator list already uses) and handed to the client wizard, which
// also drives deal-context selection and draft creation.
export default async function CreateProposalSetupPage() {
  const partners = await getPartners()

  return (
    <div style={{ padding: '20px 18px 40px' }}>
      <Link href="/operator/create" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Create
      </Link>
      <p style={eyebrow(T.textFaint)}>Create</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Partner + Proposal</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 18px' }}>
        Who is this proposal for?
      </p>

      <ProposalSetupClient partners={partners.map((p) => ({ id: p.id, displayName: p.displayName, relationshipStatus: p.relationshipStatus }))} />
    </div>
  )
}
