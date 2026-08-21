'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import ProductPage, { ProductPageProps } from '@/components/ProductPage'

type PreviewData = {
  product: ProductPageProps['product'] & { status: string; visible_bcc: boolean; visible_bnt: boolean }
  content: ProductPageProps['content']
  media: ProductPageProps['media']
  upcomingEvents: ProductPageProps['upcomingEvents']
}

export default function ProductPreviewPage() {
  const params = useParams<{ id: string }>()
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [data, setData] = useState<PreviewData | null>(null)

  useEffect(() => {
    if (!params?.id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/products/${params.id}/preview`, { cache: 'no-store' })
        if (res.status === 404) {
          setState('notfound')
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const json = await res.json()
        setData(json)
        setState('ready')
      } catch {
        setState('error')
      }
    })()
  }, [params?.id])

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0D000A', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif', padding: '24px' }}>
        Loading preview…
      </div>
    )
  }
  if (state === 'notfound') {
    return (
      <div style={{ minHeight: '100vh', background: '#0D000A', color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif', padding: '24px' }}>
        Product not found. <Link href="/dashboard/products" style={{ color: '#EA003A' }}>← Products</Link>
      </div>
    )
  }
  if (state === 'error' || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D000A', color: '#EA003A', fontFamily: 'Inter, sans-serif', padding: '24px' }}>
        Could not load this product&rsquo;s preview.
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D000A' }}>
      <div
        style={{
          background: 'rgba(26,0,21,0.98)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <Link href={`/dashboard/products/${params.id}`} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.70)', textDecoration: 'none' }}>
          ← Back to Product
        </Link>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
          {data.product.name} · status: {data.product.status}
        </span>
      </div>

      <ProductPage
        product={data.product}
        content={data.content}
        media={data.media}
        upcomingEvents={data.upcomingEvents}
        mode="preview"
      />
    </div>
  )
}
