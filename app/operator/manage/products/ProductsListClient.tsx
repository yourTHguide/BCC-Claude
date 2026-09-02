'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search, List, LayoutGrid, Package, ChevronRight } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import type { ProductListRow } from '@/lib/operator/products'

// Production lifecycle only ever reaches 'active' or 'draft' (see
// lib/operator/products.ts — no route anywhere sets 'archived'), so that's
// the only filter offered. STATUS_COLOR/STATUS_SOFT below still cover
// 'archived' defensively for display, in case the enum value is ever set
// directly — this just isn't a real, reachable filter state.
type StatusFilter = 'all' | 'active' | 'draft'
type StorefrontFilter = 'all' | 'bcc' | 'bnt'
type ViewMode = 'list' | 'grid'

const STATUS_COLOR: Record<ProductListRow['status'], string> = {
  active: T.statusGreen,
  draft: T.statusAmber,
  archived: T.textMuted,
}
const STATUS_SOFT: Record<ProductListRow['status'], string> = {
  active: T.statusGreenSoft,
  draft: T.statusAmberSoft,
  archived: T.chipBg,
}

const baht = (n: number | null) => (n == null ? '—' : `฿${n.toLocaleString()}`)
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : null)

function chipStyle(active: boolean) {
  return {
    fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '999px', border: 'none',
    cursor: 'pointer', color: active ? T.bg : T.textMuted, background: active ? T.accent : T.chipBg,
    flexShrink: 0,
  } as React.CSSProperties
}

// Storefront filter deliberately shows BCC/BNT only — those are the two
// real visible_bcc/visible_bnt columns that exist. No Flow Lab/YTG chips:
// there is no schema/data for either brand anywhere (SNX_PHASE2C
// Refinement 1 — this stays a storefront filter, not a canonical Brand
// model).
export default function ProductsListClient({ products }: { products: ProductListRow[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [storefront, setStorefront] = useState<StorefrontFilter>('all')
  const [view, setView] = useState<ViewMode>('list')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (storefront === 'bcc' && !p.visibleBcc) return false
      if (storefront === 'bnt' && !p.visibleBnt) return false
      if (q && !p.name.toLowerCase().includes(q) && !p.slug.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, query, status, storefront])

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={15} color={T.textFaint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          style={{
            width: '100%', padding: '10px 12px 10px 34px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
            background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '8px', paddingBottom: '2px' }}>
        {(['all', 'active', 'draft'] as StatusFilter[]).map((s) => (
          <button key={s} type="button" style={chipStyle(status === s)} onClick={() => setStatus(s)}>
            {s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
          {(['all', 'bcc', 'bnt'] as StorefrontFilter[]).map((s) => (
            <button key={s} type="button" style={chipStyle(storefront === s)} onClick={() => setStorefront(s)}>
              {s === 'all' ? 'All storefronts' : s.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0, background: T.chipBg, borderRadius: '8px', padding: '2px' }}>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            style={{ padding: '6px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'list' ? T.bgElevatedHover : 'transparent', color: view === 'list' ? T.text : T.textFaint }}
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            style={{ padding: '6px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'grid' ? T.bgElevatedHover : 'transparent', color: view === 'grid' ? T.text : T.textFaint }}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Package size={22} color={T.textFaint} style={{ marginBottom: '8px' }} />
          <p style={{ fontSize: '13px', color: T.textFaint, margin: 0 }}>No products match.</p>
        </div>
      )}

      {view === 'list' && filtered.map((p) => (
        <Link
          key={p.id}
          href={`/operator/manage/products/${p.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', marginBottom: '8px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          {p.coverUrl ? (
            <img src={p.coverUrl} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package size={18} color={T.textFaint} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: STATUS_COLOR[p.status], background: STATUS_SOFT[p.status] }}>
                {p.status}
              </span>
              <span style={{ fontSize: '11px', color: T.textMuted }}>{baht(p.defaultPrice)}</span>
              {hhmm(p.defaultStartTime) && <span style={{ fontSize: '11px', color: T.textMuted }}>· {hhmm(p.defaultStartTime)}</span>}
              {p.visibleBcc && <span style={{ fontSize: '10px', fontWeight: 600, color: T.textFaint }}>BCC</span>}
              {p.visibleBnt && <span style={{ fontSize: '10px', fontWeight: 600, color: T.textFaint }}>BNT</span>}
            </div>
          </div>
          <ChevronRight size={16} color={T.textFaint} style={{ flexShrink: 0 }} />
        </Link>
      ))}

      {view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/operator/manage/products/${p.id}`}
              style={{
                display: 'block', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius,
                overflow: 'hidden', textDecoration: 'none', color: T.text,
              }}
            >
              {p.coverUrl ? (
                <img src={p.coverUrl} alt="" style={{ width: '100%', height: '92px', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '92px', background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={20} color={T.textFaint} />
                </div>
              )}
              <div style={{ padding: '10px' }}>
                <p style={{ fontSize: '12.5px', fontWeight: 600, margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', color: STATUS_COLOR[p.status], background: STATUS_SOFT[p.status] }}>
                    {p.status}
                  </span>
                  <span style={{ fontSize: '10.5px', color: T.textMuted }}>{baht(p.defaultPrice)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
