'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import ScheduleEditor from './ScheduleEditor'
import ContentEditor from './ContentEditor'
import MediaEditor from './MediaEditor'
import { SectionListGroup, FocusedEditorChrome } from './sections/MobileSectionShell'
import { M } from './sections/styles'

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><p style={C.label}>{label}</p><p style={C.value}>{children}</p></div>)
}

const baht = (n: number | null) => (n == null ? 'Not set' : `฿${n.toLocaleString()}`)
const hhmmDisplay = (t: string | null) => (t ? t.slice(0, 5) : 'Not set')

function draftFromProduct(p: Product) {
  return {
    price: p.default_price != null ? String(p.default_price) : '',
    time: p.default_start_time ? p.default_start_time.slice(0, 5) : '',
    bcc: p.visible_bcc,
    bnt: p.visible_bnt,
  }
}

function ProductDetailInner() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const justCreated = search.get('created') === '1'
  const createdCount = search.get('count')

  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading')
  const [product, setProduct] = useState<Product | null>(null)
  const [events, setEvents] = useState<{ total: number; upcomingOpen: number; nextOpenDate: string | null } | null>(null)
  const [tab, setTab] = useState<'overview' | 'schedule' | 'content' | 'media'>('overview')

  // Publish/Deactivate panel state
  const [panel, setPanel] = useState<'none' | 'activate'>('none')
  const [pendingBcc, setPendingBcc] = useState(false)
  const [pendingBnt, setPendingBnt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Operational editing (default price/time, BCC/BNT visibility). Separate
  // from the activate/deactivate flow above — this PATCHes
  // /api/admin/products/[id] directly and never touches `status`.
  const [opDraft, setOpDraft] = useState({ price: '', time: '', bcc: false, bnt: false })
  const [opSaving, setOpSaving] = useState(false)
  const [opMsg, setOpMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Mobile-only: which single Operational field is focused (null = compact
  // summary list). Quick Facts (in the Content tab) can jump straight here
  // via onNavigate below.
  const [mobileOpField, setMobileOpField] = useState<'price' | 'time' | null>(null)

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

  // Re-sync the operational draft to the server-confirmed values every time
  // `product` changes — including right after a successful PATCH, which
  // calls loadProduct() and so lands here with the persisted values.
  useEffect(() => {
    if (!product) return
    setOpDraft(draftFromProduct(product))
  }, [product])

  const opDirty = product != null && (
    opDraft.price !== draftFromProduct(product).price ||
    opDraft.time !== draftFromProduct(product).time ||
    opDraft.bcc !== product.visible_bcc ||
    opDraft.bnt !== product.visible_bnt
  )

  // Back out of a mobile Price/Time focused editor WITHOUT saving — discard
  // whatever was typed by resetting the shared opDraft back to the
  // server-confirmed values, so an abandoned edit can never leak into a
  // later, unrelated save (e.g. tapping a visibility switch right after).
  function closeMobileOpField() {
    if (product) setOpDraft(draftFromProduct(product))
    setMobileOpField(null)
  }

  // Mobile-only: Storefront Visibility switches apply immediately (no
  // separate Save step — see CORE UX PRINCIPLE #8, switches are the one
  // exception to tap-then-save). Reads straight from `product`, never from
  // `opDraft`, so it can't be affected by an edit in progress elsewhere.
  async function toggleVisibilityNow(key: 'visible_bcc' | 'visible_bnt') {
    if (!product || opSaving) return
    const next = !product[key]
    if (key === 'visible_bcc' && product.status === 'active' && product.visible_bcc && !next) {
      const ok = confirm(
        `Turn off BCC visibility for "${product.name}"? It will immediately disappear from bkkclubcrawl.com and become unbookable there, even though it stays Active.`
      )
      if (!ok) return
    }
    setOpSaving(true)
    setOpMsg(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultPrice: product.default_price,
          defaultStartTime: product.default_start_time ? product.default_start_time.slice(0, 5) : null,
          visibleBcc: key === 'visible_bcc' ? next : product.visible_bcc,
          visibleBnt: key === 'visible_bnt' ? next : product.visible_bnt,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOpMsg({ ok: false, text: data.error || 'Could not save changes. Please try again.' })
        return
      }
      await loadProduct()
    } catch {
      setOpMsg({ ok: false, text: 'Server error. Please try again.' })
    } finally {
      setOpSaving(false)
    }
  }

  async function handleSaveOperational() {
    if (!product || opSaving || !opDirty) return

    // Turning OFF BCC visibility while the product is live immediately makes
    // it unbookable on the storefront — warn, same as the existing
    // Deactivate confirmation, before sending it.
    if (product.status === 'active' && product.visible_bcc && !opDraft.bcc) {
      const ok = confirm(
        `Turn off BCC visibility for "${product.name}"? It will immediately disappear from bkkclubcrawl.com and become unbookable there, even though it stays Active.`
      )
      if (!ok) return
    }

    setOpSaving(true)
    setOpMsg(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultPrice: opDraft.price === '' ? null : Number(opDraft.price),
          defaultStartTime: opDraft.time === '' ? null : opDraft.time,
          visibleBcc: opDraft.bcc,
          visibleBnt: opDraft.bnt,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOpMsg({ ok: false, text: data.error || 'Could not save changes. Please try again.' })
        return
      }
      setOpMsg({ ok: true, text: 'Saved.' })
      await loadProduct()
      setMobileOpField(null)
    } catch {
      setOpMsg({ ok: false, text: 'Server error. Please try again.' })
    } finally {
      setOpSaving(false)
    }
  }

  function openActivatePanel() {
    if (!product) return
    setPendingBcc(product.visible_bcc)
    setPendingBnt(product.visible_bnt)
    setActionError(null)
    setPanel('activate')
  }

  // Quick Facts (Content tab) is a shortcut into fields this page owns
  // across tabs — switch tab and, for Overview, jump straight to the
  // relevant focused editor instead of landing on the summary list.
  function handleNavigateFromQuickFacts(target: { tab: 'schedule' } | { tab: 'overview'; focus: 'price' | 'time' }) {
    setTab(target.tab)
    if (target.tab === 'overview') setMobileOpField(target.focus)
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ ...C.tabBar, flexWrap: 'wrap', overflowX: 'auto' }}>
                <button style={C.tab(tab === 'overview')} onClick={() => setTab('overview')}>Overview</button>
                <button style={C.tab(tab === 'schedule')} onClick={() => setTab('schedule')}>Schedule</button>
                <button style={C.tab(tab === 'content')} onClick={() => setTab('content')}>Content</button>
                <button style={C.tab(tab === 'media')} onClick={() => setTab('media')}>Media</button>
              </div>
              {/* Mobile already surfaces this as the "Preview Product" row inside
                  the Overview tab — avoid showing it twice / crowding the tab
                  bar into horizontal overflow on narrow screens. A wrapper
                  carries the desktop-only class: the Link's own inline
                  `display` style would otherwise always beat a class-based
                  `display: none`, media query or not. */}
              <div className="pe-desktop-only">
                <Link href={`/dashboard/products/${params.id}/preview`} style={{ ...C.ghostBtn, height: '34px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginBottom: '10px' }}>
                  Preview Event Page →
                </Link>
              </div>
            </div>
            <style>{`
              .pe-mobile-only { display: none; }
              @media (max-width: 768px) {
                .pe-desktop-only { display: none; }
                .pe-mobile-only { display: block; }
              }
            `}</style>

            {tab === 'overview' && (() => {
              const activateDeactivate = (
                <>
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
                </>
              )

              const identityCard = (
                // Informational system metadata, not something an admin operates
                // day-to-day — kept read-only and visually secondary to the
                // Operational controls (smaller type, muted border, no accent).
                <div style={{ ...C.card, padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ fontWeight: 600, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)', margin: '0 0 10px' }}>Identity</p>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', lineHeight: 1.9 }}>
                    <div>Product ID <span style={{ color: 'rgba(255,255,255,0.55)' }}>{product.id}</span></div>
                    <div>Created <span style={{ color: 'rgba(255,255,255,0.55)' }}>{new Date(product.created_at).toLocaleString()}</span></div>
                    <div>Updated <span style={{ color: 'rgba(255,255,255,0.55)' }}>{product.updated_at ? new Date(product.updated_at).toLocaleString() : '—'}</span></div>
                  </div>
                </div>
              )

              return (
              <div style={C.narrow}>
                {opMsg && (
                  <div style={{ ...(opMsg.ok ? C.banner : C.actionErr), margin: '0 0 14px' }}>{opMsg.ok ? '✓ ' : ''}{opMsg.text}</div>
                )}

                {/* ── Desktop: unchanged expanded form ── */}
                <div className="pe-desktop-only">
                  <div style={C.card}>
                    <p style={{ ...C.label, color: '#EA003A', marginBottom: '14px' }}>Operational</p>
                    <Field label="Status">{product.status}</Field>

                    <div style={{ marginBottom: '16px' }}>
                      <p style={C.label}>Default Price (THB)</p>
                      <input
                        style={{ height: '38px', width: '100%', maxWidth: '220px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', boxSizing: 'border-box' } as React.CSSProperties}
                        type="number"
                        min={1}
                        placeholder="e.g. 1200"
                        value={opDraft.price}
                        onChange={(e) => setOpDraft((v) => ({ ...v, price: e.target.value }))}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <p style={C.label}>Default Start Time</p>
                      <input
                        style={{ height: '38px', width: '100%', maxWidth: '220px', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', boxSizing: 'border-box' } as React.CSSProperties}
                        type="time"
                        value={opDraft.time}
                        onChange={(e) => setOpDraft((v) => ({ ...v, time: e.target.value }))}
                      />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <p style={C.label}>Storefront visibility</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" style={C.toggle(opDraft.bcc)} onClick={() => setOpDraft((v) => ({ ...v, bcc: !v.bcc }))}>
                          {opDraft.bcc ? '✓ ' : ''}Visible on BCC
                        </button>
                        <button type="button" style={C.toggle(opDraft.bnt)} onClick={() => setOpDraft((v) => ({ ...v, bnt: !v.bnt }))}>
                          {opDraft.bnt ? '✓ ' : ''}Visible on BNT
                        </button>
                      </div>
                      <p style={C.hint}>BNT storefront/checkout isn&rsquo;t built yet — this flag is stored but not enforced anywhere.</p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <button style={C.primaryBtn(opSaving || !opDirty)} disabled={opSaving || !opDirty} onClick={handleSaveOperational}>
                        {opSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>

                    {activateDeactivate}
                  </div>
                  {identityCard}
                </div>

                {/* ── Mobile: compact rows, switches apply instantly, Price/Time tap-to-edit ── */}
                <div className="pe-mobile-only">
                  {mobileOpField === null ? (
                    <>
                      <p style={M.groupHeading}>Operational</p>
                      <div style={M.listCard}>
                        <div style={{ ...M.row(true), cursor: 'default' }}>
                          <span style={M.rowLabel}>Status</span>
                          <span style={M.rowSummary}>{product.status.charAt(0).toUpperCase() + product.status.slice(1)}</span>
                        </div>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <p style={{ ...M.rowLabel, marginBottom: '10px' }}>Storefront Visibility</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>BCC</span>
                              <button type="button" disabled={opSaving} style={C.toggle(product.visible_bcc)} onClick={() => toggleVisibilityNow('visible_bcc')}>
                                {product.visible_bcc ? 'ON' : 'OFF'}
                              </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>BNT</span>
                              <button type="button" disabled={opSaving} style={C.toggle(product.visible_bnt)} onClick={() => toggleVisibilityNow('visible_bnt')}>
                                {product.visible_bnt ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          </div>
                          <p style={C.hint}>BNT storefront/checkout isn&rsquo;t built yet — stored but not enforced anywhere.</p>
                        </div>
                        <button type="button" style={M.row()} onClick={() => setMobileOpField('price')}>
                          <span style={M.rowLabel}>Default Price</span>
                          <span style={M.rowSummary}>{baht(product.default_price)}<span style={M.chevron}>›</span></span>
                        </button>
                        <button type="button" style={{ ...M.row(), borderBottom: 'none' }} onClick={() => setMobileOpField('time')}>
                          <span style={M.rowLabel}>Default Start Time</span>
                          <span style={M.rowSummary}>{hhmmDisplay(product.default_start_time)}<span style={M.chevron}>›</span></span>
                        </button>
                      </div>

                      <div style={{ ...M.listCard, marginTop: '4px' }}>
                        <Link href={`/dashboard/products/${params.id}/preview`} style={{ ...M.row(), textDecoration: 'none', borderBottom: 'none' }}>
                          <span style={M.rowLabel}>Preview Product</span>
                          <span style={M.chevron}>›</span>
                        </Link>
                      </div>

                      <div style={{ marginTop: '16px' }}>{activateDeactivate}</div>
                      <div style={{ marginTop: '16px' }}>{identityCard}</div>
                    </>
                  ) : (
                    <FocusedEditorChrome
                      title={mobileOpField === 'price' ? 'Default Price' : 'Default Start Time'}
                      onBack={closeMobileOpField}
                      onSave={handleSaveOperational}
                      saving={opSaving}
                    >
                      <div style={C.card}>
                        {mobileOpField === 'price' ? (
                          <>
                            <p style={C.label}>Default Price (THB)</p>
                            <input
                              style={{ height: '38px', width: '100%', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', boxSizing: 'border-box' } as React.CSSProperties}
                              type="number"
                              min={1}
                              placeholder="e.g. 1200"
                              autoFocus
                              value={opDraft.price}
                              onChange={(e) => setOpDraft((v) => ({ ...v, price: e.target.value }))}
                            />
                            <p style={C.hint}>Used whenever an Event Date has no price override. Leave empty to clear.</p>
                          </>
                        ) : (
                          <>
                            <p style={C.label}>Default Start Time</p>
                            <input
                              style={{ height: '38px', width: '100%', borderRadius: '8px', padding: '0 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '14px', boxSizing: 'border-box' } as React.CSSProperties}
                              type="time"
                              autoFocus
                              value={opDraft.time}
                              onChange={(e) => setOpDraft((v) => ({ ...v, time: e.target.value }))}
                            />
                            <p style={C.hint}>Used whenever an Event Date has no start-time override.</p>
                          </>
                        )}
                      </div>
                    </FocusedEditorChrome>
                  )}
                </div>
              </div>
              )
            })()}

            {tab === 'schedule' && (
              <div style={C.contentWrap}>
                <ScheduleEditor productId={params.id} />
              </div>
            )}

            {tab === 'content' && (
              <div style={C.contentWrap}>
                <ContentEditor
                  productId={params.id}
                  quickFactsSource={{
                    defaultPrice: product.default_price,
                    defaultStartTime: product.default_start_time,
                    nextOpenDate: events?.nextOpenDate ?? null,
                  }}
                  onNavigate={handleNavigateFromQuickFacts}
                />
              </div>
            )}

            {tab === 'media' && (
              <div style={C.contentWrap}>
                <MediaEditor productId={params.id} />
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
