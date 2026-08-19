'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'

interface Product {
  id: string
  slug: string
  name: string
  status: 'active' | 'draft' | 'archived'
  default_price: number | null
  default_start_time: string | null
  visible_bcc: boolean
  visible_bnt: boolean
  created_at: string
  updated_at: string | null
}
interface EventsSummary { total: number; upcomingOpen: number; nextOpenDate: string | null }

const C = {
  page: { minHeight: '100vh', background: '#0D000A', fontFamily: 'Inter, sans-serif', color: '#fff' } as React.CSSProperties,
  nav: { background: 'rgba(26,0,21,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  eyebrow: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#EA003A' },
  link: { fontSize: '13px', color: 'rgba(255,255,255,0.70)', textDecoration: 'none' } as React.CSSProperties,
  wrap: { maxWidth: '720px', margin: '0 auto', padding: '28px 24px' } as React.CSSProperties,
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 22px', marginBottom: '16px' } as React.CSSProperties,
  label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', margin: '0 0 4px' },
  value: { fontSize: '15px', margin: '0 0 16px' } as React.CSSProperties,
  banner: { background: 'rgba(52,199,89,0.10)', border: '1px solid rgba(52,199,89,0.35)', borderRadius: '10px', padding: '14px 16px', margin: '0 0 20px', color: '#8ff0a6', fontSize: '14px' } as React.CSSProperties,
}

const baht = (n: number | null) => (n == null ? '—' : `฿${n.toLocaleString()}`)
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—')

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><p style={C.label}>{label}</p><p style={C.value}>{children}</p></div>)
}

function ProductDetailInner() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const justCreated = search.get('created') === '1'
  const createdCount = search.get('count')

  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [product, setProduct] = useState<Product | null>(null)
  const [events, setEvents] = useState<EventsSummary | null>(null)

  useEffect(() => {
    if (!params?.id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/products/${params.id}`, { cache: 'no-store' })
        if (res.status === 404) { setStatus('notfound'); return }
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        setProduct(data.product)
        setEvents(data.events)
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    })()
  }, [params?.id])

  return (
    <div style={C.page}>
      <div style={C.nav}>
        <p style={C.eyebrow}>BCC DASHBOARD · PRODUCT</p>
        <Link href="/dashboard/products" style={C.link}>← Products</Link>
      </div>

      <div style={C.wrap}>
        {status === 'loading' && <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>}
        {status === 'error' && <p style={{ color: '#EA003A' }}>Could not load this product.</p>}
        {status === 'notfound' && <p style={{ color: 'rgba(255,255,255,0.6)' }}>Product not found.</p>}

        {status === 'ready' && product && (
          <>
            {justCreated && (
              <div style={C.banner}>
                ✓ Draft product created{createdCount ? ` with ${createdCount} date${createdCount === '1' ? '' : 's'} generated` : ''}. It stays hidden from customers until activated.
              </div>
            )}

            <h1 style={{ fontWeight: 600, fontSize: '22px', margin: '0 0 2px' }}>{product.name}</h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 22px' }}>
              {product.slug} · status: {product.status} · read-only
            </p>

            <div style={C.card}>
              <p style={{ ...C.label, color: '#EA003A', marginBottom: '14px' }}>Operational</p>
              <Field label="Status">{product.status}</Field>
              <Field label="Default price">{baht(product.default_price)}</Field>
              <Field label="Default start time">{hhmm(product.default_start_time)}</Field>
              <Field label="Visible on BCC">{product.visible_bcc ? 'Yes' : 'No'}</Field>
              <Field label="Visible on BNT">{product.visible_bnt ? 'Yes' : 'No'}</Field>
            </div>

            <div style={C.card}>
              <p style={{ ...C.label, color: '#EA003A', marginBottom: '14px' }}>Event instances (read-only)</p>
              <Field label="Total instances">{events?.total ?? 0}</Field>
              <Field label="Upcoming & open">{events?.upcomingOpen ?? 0}</Field>
              <Field label="Next open date">{events?.nextOpenDate ?? '—'}</Field>
            </div>

            <div style={C.card}>
              <p style={{ ...C.label, color: '#EA003A', marginBottom: '14px' }}>Identity</p>
              <Field label="Product ID">{product.id}</Field>
              <Field label="Created">{new Date(product.created_at).toLocaleString()}</Field>
              <Field label="Updated">{product.updated_at ? new Date(product.updated_at).toLocaleString() : '—'}</Field>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<div style={C.page} />}>
      <ProductDetailInner />
    </Suspense>
  )
}
