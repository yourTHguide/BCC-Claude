import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getProductDetail } from '@/lib/operator/products'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import ProductMediaEditor from './ProductMediaEditor'

export const dynamic = 'force-dynamic'

// Adapts the existing, fully-proven media workflow (app/dashboard/products/[id]/MediaTab.tsx)
// to mobile — same Supabase Storage bucket, same upload/delete/reorder API
// routes, unchanged (SNX_PHASE2C plan).
export default async function ProductMediaPage({ params }: { params: { id: string } }) {
  const product = await getProductDetail(params.id)
  if (!product) notFound()

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <Link href={`/operator/manage/products/${params.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> {product.name}
      </Link>
      <p style={eyebrow(T.textFaint)}>Media</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 18px' }}>Cover &amp; Gallery</h1>

      <ProductMediaEditor productId={params.id} />
    </div>
  )
}
