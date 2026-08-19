'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

const C = {
  page: { minHeight: '100vh', background: '#0D000A', fontFamily: 'Inter, sans-serif', color: '#fff' } as React.CSSProperties,
  nav: { background: 'rgba(26,0,21,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
  eyebrow: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#EA003A' },
  link: { fontSize: '13px', color: 'rgba(255,255,255,0.70)', textDecoration: 'none' } as React.CSSProperties,
  wrap: { maxWidth: '960px', margin: '0 auto', padding: '28px 24px' } as React.CSSProperties,
  th: { textAlign: 'left' as const, fontWeight: 600, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', padding: '0 12px 10px' },
  td: { padding: '14px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: '14px', verticalAlign: 'middle' as const },
}

function statusBadge(status: Product['status']) {
  const map: Record<Product['status'], { bg: string; fg: string }> = {
    active: { bg: 'rgba(52,199,89,0.14)', fg: '#34C759' },
    draft: { bg: 'rgba(255,196,0,0.14)', fg: '#FFC400' },
    archived: { bg: 'rgba(255,255,255,0.10)', fg: 'rgba(255,255,255,0.55)' },
  }
  const s = map[status]
  return (
    <span style={{ background: s.bg, color: s.fg, fontWeight: 600, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: '6px' }}>
      {status}
    </span>
  )
}

const baht = (n: number | null) => (n == null ? '—' : `฿${n.toLocaleString()}`)
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—')
const yn = (b: boolean) => (b ? '✓' : '·')

export default function ProductsListPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/products', { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        setProducts(data.products ?? [])
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    })()
  }, [])

  return (
    <div style={C.page}>
      <div style={C.nav}>
        <p style={C.eyebrow}>BCC DASHBOARD · PRODUCTS</p>
        <Link href="/dashboard" style={C.link}>← Dashboard</Link>
      </div>

      <div style={C.wrap}>
        <h1 style={{ fontWeight: 600, fontSize: '22px', margin: '0 0 4px' }}>Products</h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 24px' }}>
          Reusable experience definitions. Read-only at this stage.
        </p>

        {status === 'loading' && <p style={{ color: 'rgba(255,255,255,0.5)' }}>Loading…</p>}
        {status === 'error' && (
          <p style={{ color: '#EA003A' }}>Could not load products. Check that you are signed in as an admin.</p>
        )}

        {status === 'ready' && products.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>No products yet.</p>
        )}

        {status === 'ready' && products.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={C.th}>Product</th>
                  <th style={C.th}>Status</th>
                  <th style={C.th}>Default price</th>
                  <th style={C.th}>Start</th>
                  <th style={C.th}>BCC</th>
                  <th style={C.th}>BNT</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={C.td}>
                      <Link href={`/dashboard/products/${p.id}`} style={{ color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
                        {p.name}
                      </Link>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)' }}>{p.slug}</div>
                    </td>
                    <td style={C.td}>{statusBadge(p.status)}</td>
                    <td style={C.td}>{baht(p.default_price)}</td>
                    <td style={C.td}>{hhmm(p.default_start_time)}</td>
                    <td style={{ ...C.td, color: p.visible_bcc ? '#34C759' : 'rgba(255,255,255,0.30)' }}>{yn(p.visible_bcc)}</td>
                    <td style={{ ...C.td, color: p.visible_bnt ? '#34C759' : 'rgba(255,255,255,0.30)' }}>{yn(p.visible_bnt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
