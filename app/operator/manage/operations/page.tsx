import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import OperationsClient from './OperationsClient'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Same Operations Sheet as the BCC /dashboard "Operations" tab — shared
// component + /api/admin/dashboard/operations, so both places always show
// identical numbers.
export default function OperatorOperationsPage() {
  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/manage/events" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Event Operations
      </Link>
      <p style={eyebrow(T.textFaint)}>Operations Sheet</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Host, Route, Guests, Money</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 16px' }}>Filter by date, host, night or status. Same data as the BCC Dashboard Operations tab.</p>
      <OperationsClient />
    </div>
  )
}
