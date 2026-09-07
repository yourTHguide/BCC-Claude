'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search, List, LayoutGrid, Handshake, ChevronRight, MapPin } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import type { PartnerListRow } from '@/lib/operator/partners'
import type { RelationshipStatus } from '@/lib/partners'

type StatusFilter = 'all' | RelationshipStatus
type ViewMode = 'list' | 'grid'

const STATUS_LABEL: Record<RelationshipStatus, string> = {
  prospect: 'Prospect',
  'in-conversation': 'In conversation',
  'proposal-pending': 'Proposal pending',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}
const STATUS_COLOR: Record<RelationshipStatus, string> = {
  prospect: T.statusBlue,
  'in-conversation': T.statusAmber,
  'proposal-pending': T.statusPurple,
  active: T.statusGreen,
  paused: T.textMuted,
  archived: T.textFaint,
}
const STATUS_SOFT: Record<RelationshipStatus, string> = {
  prospect: T.statusBlueSoft,
  'in-conversation': T.statusAmberSoft,
  'proposal-pending': T.statusPurpleSoft,
  active: T.statusGreenSoft,
  paused: T.chipBg,
  archived: T.chipBg,
}
const ALL_STATUSES: RelationshipStatus[] = ['prospect', 'in-conversation', 'proposal-pending', 'active', 'paused', 'archived']

function chipStyle(active: boolean) {
  return {
    fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '999px', border: 'none',
    cursor: 'pointer', color: active ? T.bg : T.textMuted, background: active ? T.accent : T.chipBg,
    flexShrink: 0, whiteSpace: 'nowrap' as const,
  }
}

function contextChipStyle() {
  return {
    fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px',
    color: T.textMuted, background: T.chipBg, whiteSpace: 'nowrap' as const,
  }
}

// Business-context filter options are derived entirely from real
// business_contexts values present on this partner's deals — never a
// hardcoded BEST/BCC/YTG/Flow Lab list (Phase 3B §5). A partner with no
// deals yet contributes nothing here, which is correct: "which SNX business
// this relationship touches" is evidenced by an actual deal, not asserted.
export default function PartnerDirectoryClient({ partners }: { partners: PartnerListRow[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [context, setContext] = useState<string | 'all'>('all')
  const [view, setView] = useState<ViewMode>('list')

  const availableContexts = useMemo(() => {
    const set = new Set<string>()
    for (const p of partners) for (const c of p.businessContexts) set.add(c)
    return Array.from(set).sort()
  }, [partners])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return partners.filter((p) => {
      if (status !== 'all' && p.relationshipStatus !== status) return false
      if (context !== 'all' && !p.businessContexts.includes(context)) return false
      if (q && !p.displayName.toLowerCase().includes(q)) return false
      return true
    })
  }, [partners, query, status, context])

  if (partners.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Handshake size={24} color={T.textFaint} style={{ marginBottom: '10px' }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: T.textMuted, margin: '0 0 4px' }}>No partners yet</p>
        <p style={{ fontSize: '12.5px', color: T.textFaint, margin: 0 }}>Partners created elsewhere will appear here.</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={15} color={T.textFaint} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search partners…"
          style={{
            width: '100%', padding: '10px 12px 10px 34px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
            background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '8px', paddingBottom: '2px' }}>
        <button type="button" style={chipStyle(status === 'all')} onClick={() => setStatus('all')}>All statuses</button>
        {ALL_STATUSES.map((s) => (
          <button key={s} type="button" style={chipStyle(status === s)} onClick={() => setStatus(s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {availableContexts.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '8px', paddingBottom: '2px' }}>
          <button type="button" style={chipStyle(context === 'all')} onClick={() => setContext('all')}>All contexts</button>
          {availableContexts.map((c) => (
            <button key={c} type="button" style={chipStyle(context === c)} onClick={() => setContext(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
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
          <Handshake size={22} color={T.textFaint} style={{ marginBottom: '8px' }} />
          <p style={{ fontSize: '13px', color: T.textFaint, margin: 0 }}>No partners match.</p>
        </div>
      )}

      {view === 'list' && filtered.map((p) => (
        <Link
          key={p.id}
          href={`/operator/manage/partners/${p.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', marginBottom: '8px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Handshake size={17} color={T.textFaint} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: STATUS_COLOR[p.relationshipStatus], background: STATUS_SOFT[p.relationshipStatus] }}>
                {STATUS_LABEL[p.relationshipStatus]}
              </span>
              {p.businessContexts.map((c) => <span key={c} style={contextChipStyle()}>{c}</span>)}
              {p.locationCount > 0 && (
                <span style={{ fontSize: '11px', color: T.textMuted, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <MapPin size={11} /> {p.locationCount}
                </span>
              )}
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
              href={`/operator/manage/partners/${p.id}`}
              style={{
                display: 'block', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius,
                overflow: 'hidden', textDecoration: 'none', color: T.text, padding: '12px',
              }}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                <Handshake size={15} color={T.textFaint} />
              </div>
              <p style={{ fontSize: '12.5px', fontWeight: 600, margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</p>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', color: STATUS_COLOR[p.relationshipStatus], background: STATUS_SOFT[p.relationshipStatus] }}>
                  {STATUS_LABEL[p.relationshipStatus]}
                </span>
                {p.locationCount > 0 && (
                  <span style={{ fontSize: '10px', color: T.textMuted, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    <MapPin size={10} /> {p.locationCount}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
