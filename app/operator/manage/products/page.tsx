import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getProductsList } from '@/lib/operator/products'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import ProductsListClient from './ProductsListClient'

export const dynamic = 'force-dynamic'

// Phase 2C: Products / Experiences graduates from a /dashboard link-out to a
// real in-shell surface (SNX_PHASE2C plan). Same products table the desktop
// Product Admin already reads — no second product system. Search/status/
// storefront filtering and the list/grid toggle are all client-side over
// this one already-fetched list (small dataset, same no-pagination
// convention the desktop list uses).
export default async function OperatorProductsPage() {
  const products = await getProductsList()

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href="/operator/manage" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Manage
      </Link>
      <p style={eyebrow(T.textFaint)}>Manage</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Products / Experiences</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 18px' }}>
        Everything SNX offers, in one catalog.
      </p>

      <ProductsListClient products={products} />
    </div>
  )
}
