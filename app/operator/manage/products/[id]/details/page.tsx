import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getProductDetail, getProductContent } from '@/lib/operator/products'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import ProductDetailsForm from './ProductDetailsForm'

export const dynamic = 'force-dynamic'

// Adapts the existing product_content CRUD (app/dashboard/products/[id]/ContentTab.tsx)
// to mobile — same fields, same allowlist, same PUT route, unchanged
// (SNX_PHASE2C plan). Nothing here writes to `products` itself.
export default async function ProductDetailsPage({ params }: { params: { id: string } }) {
  const [product, content] = await Promise.all([getProductDetail(params.id), getProductContent(params.id)])
  if (!product) notFound()

  return (
    <div style={{ padding: '20px 18px 56px' }}>
      <Link href={`/operator/manage/products/${params.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> {product.name}
      </Link>
      <p style={eyebrow(T.textFaint)}>Details</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 18px' }}>Content</h1>

      <ProductDetailsForm productId={params.id} initial={content} />
    </div>
  )
}
