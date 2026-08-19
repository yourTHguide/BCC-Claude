'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import InstancesPanel from './InstancesPanel'
import ContentTab from './ContentTab'

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
  wrap: { maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' } as React.CSSProperties,
  narrow: { maxWidth: '640px' } as React.CSSProperties,
  contentWrap: { maxWidth: '760px' } as React.CSSProperties,
  tabBar: { display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px' } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    height: '38px', padding: '0 16px', border: 'none', borderBottom: active ? '2px solid #EA003A' : '2px solid transparent',
    background: 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.50)', fontWeight: 600, fontSize: '13px',
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
  }),
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px 22px', marginBottom: '16px' } as React.CSSProperties,
  label: { fontWeight: 600, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.40)', margin: '0 0 4px' },
  value: { fontSize: '15px', margin: '0 0 16px' } as React.CSSProperties,
  banner: { background: 'rgba(52,199,89,0.10)', border: '1px solid rgba(52,199,89,0.35)', borderRadius: '10px', padding: '14px 16px', margin: '0 0 20px', color: '#8ff0a6', fontSize: '14px' } as React.CSSProperties,
  hint: { fontSize: '12px', color: 'rgba(255,255,255,0.40)', margin: '6px 0 0' } as React.CSSProperties,
  warn: { background: 'rgba(255,196,0,0.08)', border: '1px solid rgba(255,196,0,0.30)', borderRadius: '10px', padding: '12px 14px', margin: '0 0 10px', color: '#FFC400', fontSize: '13px', lineHeight: 1.5 } as React.CSSProperties,
  actionErr: { background: 'rgba(234,0,58,0.10)', border: '1px solid rgba(234,0,58,0.30)', borderRadius: '8px', padding: '12px 14px', color: '#ff6b8a', fontSize: '13px', margin: '0 0 14px', lineHeight: 1.5 } as React.CSSProperties,
  toggle: (on: boolean): React.CSSProperties => ({ height: '36px', padding: '0 14px', borderRadius: '8px', border: `1px solid ${on ? 'rgba(52,199,89,0.4)' : 'rgba(255,255,255,0.12)'}`, background: on ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.05)', color: on ? '#34C759' : 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }),
  primaryBtn: (dis: boolean): React.CSSProperties => ({ height: '42px', padding: '0 20px', borderRadius: '9px', border: 'none', background: dis ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#EA003A,#820065)', color: dis ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: 600, fontSize: '14px', cursor: dis ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }),
  ghostBtn: { height: '42px', padding: '0 20px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: 'rgba(255,255,255,0.75)', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
  dangerBtn: { height: '42px', padding: '0 20px', borderRadius: '9px', border: '1px solid rgba(234,0,58,0.35)', background: 'rgba(234,0,58,0.08)', color: '#ff6b8a', fontWeight: 600, fontSize: '14px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' } as React.CSSProperties,
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
  const [events, setEvents] = useState<{ total: number; upcomingOpen: number; nextOpenDate: string | null } | null>(null)
  const [tab, setTab] = useState<'overview' | 'instances' | 'content'>('overview')

  // Publish/Deactivate panel state
  const [panel, setPanel] = useState<'none' | 'activate'>('none')
  const [pendingBcc, setPendingBcc] = useState(false)
  const [pendingBnt, setPendingBnt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function loadProduct() {
    if (!params?.id) return
    try {
      const res = await fetch(`/api/admin/products/${params.id}`, { cache: 'no-store' })
      if (res.status === 404) { setStatus('notfound'); return }
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setProduct(data.product)
      setEvents(data.events ?? null)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    loadProduct()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  function openActivatePanel() {
    if (!product) return
    setPendingBcc(product.visible_bcc)
    setPendingBnt(product.visible_bnt)
    setActionError(null)
    setPanel('activate')
  }

  async function handleActivate() {
    if (!product || busy) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleBcc: pendingBcc, visibleBnt: pendingBnt }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error || 'Could not publish this product. Please try again.')
        setBusy(false)
        return
      }
      setPanel('none')
      await loadProduct()
    } catch {
      setActionError('Something went wrong talking to the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate() {
    if (!product || busy) return
    if (!confirm(`Deactivate "${product.name}"? It will immediately disappear from all storefronts and become unbookable. Its schedule and Event Instances are kept as-is.`)) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/deactivate`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error || 'Could not deactivate this product. Please try again.')
        setBusy(false)
        return
      }
      await loadProduct()
    } catch {
      setActionError('Something went wrong talking to the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

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
              <div style={{ ...C.banner, maxWidth: '640px' }}>
                ✓ Draft product created{createdCount ? ` with ${createdCount} date${createdCount === '1' ? '' : 's'} generated` : ''}. It stays hidden from customers until activated.
              </div>
            )}

            <h1 style={{ fontWeight: 600, fontSize: '22px', margin: '0 0 2px' }}>{product.name}</h1>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 18px' }}>
              {product.slug} · status: {product.status}
            </p>

            <div style={C.tabBar}>
              <button style={C.tab(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
              <button style={C.tab(tab === 'instances')} onClick={() => setTab('instances')}>Schedule / Instances</button>
              <button style={C.tab(tab === 'content')} onClick={() => setTab('content')}>Content</button>
            </div>

            {tab === 'overview' && (
            <div style={C.narrow}>
              <div style={C.card}>
                <p style={{ ...C.label, color: '#EA003A', marginBottom: '14px' }}>Operational</p>
                <Field label="Status">{product.status}</Field>
                <Field label="Default price">{baht(product.default_price)}</Field>
                <Field label="Default start time">{hhmm(product.default_start_time)}</Field>
                <Field label="Visible on BCC">{product.visible_bcc ? 'Yes' : 'No'}</Field>
                <Field label="Visible on BNT">{product.visible_bnt ? 'Yes (not live yet — BNT storefront/checkout isn’t built)' : 'No'}</Field>

                {actionError && <div style={C.actionErr}>{actionError}</div>}

                {product.status === 'draft' && panel === 'none' && (
                  <button style={C.primaryBtn(false)} onClick={openActivatePanel}>Publish…</button>
                )}

                {product.status === 'draft' && panel === 'activate' && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>Publish this product</p>

                    {events && events.upcomingOpen === 0 && (
                      <div style={C.warn}>No upcoming open Event Instances yet — it will be Active but nothing will be bookable until dates are open.</div>
                    )}
                    {product.default_price == null && (
                      <div style={C.warn}>No default price set — instances without their own price override won&rsquo;t be bookable.</div>
                    )}

                    <p style={C.label}>Storefront visibility</p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button type="button" style={C.toggle(pendingBcc)} onClick={() => setPendingBcc((v) => !v)}>{pendingBcc ? '✓ ' : ''}Show on BCC</button>
                      <button type="button" style={C.toggle(pendingBnt)} onClick={() => setPendingBnt((v) => !v)}>{pendingBnt ? '✓ ' : ''}Show on BNT (not live yet)</button>
                    </div>
                    {!pendingBcc && (
                      <p style={{ ...C.hint, color: '#FFC400', margin: '0 0 8px' }}>
                        BCC is the only storefront checkout currently supports — publishing requires &ldquo;Show on BCC&rdquo;.
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                      <button style={C.primaryBtn(!pendingBcc || busy)} disabled={!pendingBcc || busy} onClick={handleActivate}>
                        {busy ? 'Publishing…' : 'Confirm Publish'}
                      </button>
                      <button style={C.ghostBtn} disabled={busy} onClick={() => { setPanel('none'); setActionError(null) }}>Cancel</button>
                    </div>
                  </div>
                )}

                {product.status === 'active' && (
                  <button style={C.dangerBtn} disabled={busy} onClick={handleDeactivate}>
                    {busy ? 'Deactivating…' : 'Deactivate'}
                  </button>
                )}
              </div>

              <div style={C.card}>
                <p style={{ ...C.label, color: '#EA003A', marginBottom: '14px' }}>Identity</p>
                <Field label="Product ID">{product.id}</Field>
                <Field label="Created">{new Date(product.created_at).toLocaleString()}</Field>
                <Field label="Updated">{product.updated_at ? new Date(product.updated_at).toLocaleString() : '—'}</Field>
              </div>
            </div>
            )}

            {tab === 'instances' && <InstancesPanel productId={params.id} />}

            {tab === 'content' && (
              <div style={C.contentWrap}>
                <ContentTab productId={params.id} />
              </div>
            )}
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
