import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getPartnersListForOperator } from '@/lib/operator/partners'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import PartnerDirectoryClient from './PartnerDirectoryClient'

export const dynamic = 'force-dynamic'

// Phase 3D: Partner Directory — read-only. Reads the same production
// partners/partner_deals/partner_locations tables Phase 3C-1 applied; no
// second partner system, no write route added here (SNX_PHASE3D plan).
// Search/status filtering, the business-context filter (derived from real
// business_contexts values, never a hardcoded brand list — Phase 3B §5),
// and the list/grid toggle are all client-side over this one already-
// fetched list, the same no-pagination convention Products already uses.
export default async function OperatorPartnersPage() {
  const partners = await getPartnersListForOperator()

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/manage" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Manage
      </Link>
      <p style={eyebrow(T.textFaint)}>Manage</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Partners</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 18px' }}>
        Every organization Sanctuary Nexus has a relationship with, canonical across every business.
      </p>

      <PartnerDirectoryClient partners={partners} />
    </div>
  )
}
