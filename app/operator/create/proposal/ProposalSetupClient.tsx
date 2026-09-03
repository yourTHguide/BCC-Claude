'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Check } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import { KNOWN_BUSINESS_CONTEXTS } from '@/lib/operator/businessContexts'
import type { ProposalDealVariable } from '@/lib/dealVariables'
import { nightlifeDealVariables } from '@/lib/proposalProfiles/venueNightlifePartnership'
import type { RelationshipStatus, PartnerDeal, PartnerLocation } from '@/lib/partners'

type PartnerRow = { id: string; displayName: string; relationshipStatus: RelationshipStatus }

// Phase 3E refinement: the New Partner form is deliberately minimal — this
// workflow optimizes for starting a proposal quickly, not for completing the
// full Partner record. Organization type and relationship status are NOT
// collected here; they're left to their schema/domain defaults (organization
// type stays null, relationship status defaults to 'prospect' — see
// createPartner() in lib/partners.ts, unchanged) and can be set later via
// Manage → Partner. No field is removed from the schema or domain model,
// only from this one entry point's UI.

// Phase 3F correction — Deal-first workflow: the real SNX lifecycle is
// Partner -> Opportunity/Deal -> optionally Proposal. A Proposal is NOT
// required for every Deal — a small partner can go straight from
// terms-agreed to an Active Deal with no Proposal ever created, and that's
// a first-class path, not a shortcut. So Step 2 here is the real Deal
// workspace (business context, what's being discussed, and the actual
// commercial terms — all of it belongs to partner_deals, not to a Proposal
// that may never exist), and Step 3 (Proposal title + Generate Draft) is
// reached only if the operator explicitly chooses to formalize the Deal
// into a Proposal after saving it.
//
// Known business-context values are a UI convenience only — a fixed list of
// {value, label} pairs for the common cases, using exactly the canonical
// strings Phase 3B established (no DB enum, no schema change: the underlying
// column is still a plain TEXT[] with no value-list CHECK). Shared with the
// Proposal Preview screen (lib/operator/businessContexts.ts) so a slug reads
// the same label everywhere it's shown to an operator.
const KNOWN_CONTEXTS = KNOWN_BUSINESS_CONTEXTS

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
  background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { ...eyebrow(T.textFaint), display: 'block', marginBottom: '5px' }
const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '9px', borderRadius: T.radiusSm, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${active ? T.accent : T.border}`, background: active ? T.accentSoft : T.bgElevated,
  color: active ? T.accentText : T.textMuted, textAlign: 'center',
})
const contextChipStyle = (active: boolean): React.CSSProperties => ({
  padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${active ? T.accent : T.border}`, background: active ? T.accentSoft : T.bgElevated,
  color: active ? T.accentText : T.textMuted, whiteSpace: 'nowrap',
})
const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: '100%', padding: '11px', borderRadius: T.radiusSm, border: 'none', fontSize: '13.5px', fontWeight: 700,
  cursor: disabled ? 'default' : 'pointer', background: disabled ? T.chipBg : T.accent, color: disabled ? T.textFaint : T.bg,
})
// Only the Deal-saved branch row (Done for now / Create Proposal) uses
// flex: 1 — it's the one place two buttons share a row.
const branchPrimaryBtn: React.CSSProperties = { ...primaryBtn(false), width: undefined, flex: 1 }
const branchSecondaryBtn: React.CSSProperties = {
  flex: 1, padding: '11px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, fontSize: '13.5px', fontWeight: 600,
  cursor: 'pointer', background: T.bgElevated, color: T.text,
}

function SectionCard({ title, done, children }: { title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '15px 16px', marginBottom: '12px' }}>
      <p style={{ ...eyebrow(T.textFaint), marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {done && <Check size={12} color={T.statusGreen} />} {title}
      </p>
      {children}
    </div>
  )
}

export default function ProposalSetupClient({ partners }: { partners: PartnerRow[] }) {
  const router = useRouter()

  // Step 1 — Partner
  const [partnerTab, setPartnerTab] = useState<'existing' | 'new'>(partners.length > 0 ? 'existing' : 'new')
  const [search, setSearch] = useState('')
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; displayName: string } | null>(null)
  const [newPartner, setNewPartner] = useState({ displayName: '', legalName: '', relationshipSummary: '' })
  const [creatingPartner, setCreatingPartner] = useState(false)

  // Step 2 — Deal (the real workspace: context, what's being discussed, and
  // commercial terms — all partner_deals fields, not Proposal fields)
  const [existingDeals, setExistingDeals] = useState<PartnerDeal[] | null>(null)
  const [locations, setLocations] = useState<PartnerLocation[]>([])
  const [dealTab, setDealTab] = useState<'existing' | 'new'>('new')
  const [selectedDeal, setSelectedDeal] = useState<PartnerDeal | null>(null)
  const [newDeal, setNewDeal] = useState<{ businessContexts: string[]; product: string; locationId: string; terms: ProposalDealVariable[] }>({
    businessContexts: [], product: '', locationId: '', terms: nightlifeDealVariables(),
  })
  const [creatingDeal, setCreatingDeal] = useState(false)

  // Branch after a Deal is selected/saved: stay ("Done for now" — the
  // first-class small-partner path, no Proposal) or continue to Step 3
  // ("Create Proposal" — the optional formalization path).
  const [wantsProposal, setWantsProposal] = useState(false)

  // Step 3 — Proposal-only (title + Generate Draft). Deal terms are never
  // asked for again here — the Working Draft inherits them server-side from
  // the Deal itself (lib/proposals.ts createProposal()).
  const [title, setTitle] = useState('')
  const [creatingProposal, setCreatingProposal] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const filteredPartners = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return partners
    return partners.filter((p) => p.displayName.toLowerCase().includes(q))
  }, [partners, search])

  useEffect(() => {
    if (!selectedPartner) return
    setExistingDeals(null)
    setSelectedDeal(null)
    setWantsProposal(false)
    setDealTab('new')
    ;(async () => {
      const [dealsRes, partnerRes] = await Promise.all([
        fetch(`/api/admin/partners/${selectedPartner.id}/deals`),
        fetch(`/api/admin/partners/${selectedPartner.id}`),
      ])
      const dealsData = await dealsRes.json().catch(() => ({}))
      const partnerData = await partnerRes.json().catch(() => ({}))
      setExistingDeals(dealsData.deals ?? [])
      setLocations(partnerData.partner?.locations ?? [])
      if ((dealsData.deals ?? []).length > 0) setDealTab('existing')
    })()
  }, [selectedPartner])

  async function handleCreatePartner() {
    if (!newPartner.displayName.trim() || creatingPartner) return
    setCreatingPartner(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: newPartner.displayName,
          legalName: newPartner.legalName || undefined,
          // organizationType/relationshipStatus intentionally omitted — the
          // API route's own defaults apply (null / 'prospect'), unchanged.
          relationshipSummary: newPartner.relationshipSummary || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not create partner.')
        return
      }
      setSelectedPartner({ id: data.partner.id, displayName: data.partner.displayName })
    } finally {
      setCreatingPartner(false)
    }
  }

  // V1 only offers the known-context toggle chips (below) -- no free-text
  // custom-context control. See the "Which business context?" field's own
  // comment for why, and for confirmation nothing about the underlying
  // model changed.
  function toggleKnownContext(v: string) {
    setNewDeal((d) => ({
      ...d,
      businessContexts: d.businessContexts.includes(v) ? d.businessContexts.filter((x) => x !== v) : [...d.businessContexts, v],
    }))
  }

  function setDealTermValue(key: string, value: string) {
    setNewDeal((d) => ({ ...d, terms: d.terms.map((t) => (t.key === key ? { ...t, value } : t)) }))
  }

  async function handleSaveDeal() {
    if (!selectedPartner || newDeal.businessContexts.length === 0 || creatingDeal) return
    setCreatingDeal(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/partners/${selectedPartner.id}/deals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessContexts: newDeal.businessContexts,
          product: newDeal.product || undefined,
          // status intentionally omitted — the API route's own default
          // applies ('discussing'), unchanged from lib/partners.ts. Saving
          // a Deal here does not require or imply a Proposal.
          locationId: newDeal.locationId || undefined,
          terms: newDeal.terms,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not save the deal.')
        return
      }
      setSelectedDeal(data.deal)
      setWantsProposal(false)
    } finally {
      setCreatingDeal(false)
    }
  }

  function handleChangeDeal() {
    setSelectedDeal(null)
    setWantsProposal(false)
  }

  function handleDoneForNow() {
    if (!selectedPartner) return
    router.push(`/operator/manage/partners/${selectedPartner.id}`)
  }

  async function handleCreateProposal() {
    if (!selectedPartner || !selectedDeal || !title.trim() || creatingProposal) return
    setCreatingProposal(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: selectedPartner.id,
          dealId: selectedDeal.id,
          businessContexts: selectedDeal.businessContexts,
          product: selectedDeal.product ?? undefined,
          title: title.trim(),
          // dealVariables intentionally omitted — createProposal() inherits
          // the Deal's current terms server-side via dealId, never trusting
          // a client-echoed snapshot (lib/proposals.ts).
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not create the proposal draft.')
        return
      }
      router.push(`/operator/create/proposal/${data.proposal.id}`)
    } finally {
      setCreatingProposal(false)
    }
  }

  return (
    <div>
      {/* Step 1 — Partner */}
      <SectionCard title="1 · Partner" done={Boolean(selectedPartner)}>
        {selectedPartner ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{selectedPartner.displayName}</p>
            <button type="button" onClick={() => { setSelectedPartner(null); handleChangeDeal() }} style={{ fontSize: '11.5px', color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Change
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <button type="button" style={tabStyle(partnerTab === 'existing')} onClick={() => setPartnerTab('existing')}>Existing Partner</button>
              <button type="button" style={tabStyle(partnerTab === 'new')} onClick={() => setPartnerTab('new')}>New Partner</button>
            </div>

            {partnerTab === 'existing' && (
              <div>
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Search size={14} color={T.textFaint} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partners…" style={{ ...fieldStyle, paddingLeft: '30px' }} />
                </div>
                {filteredPartners.length === 0 && <p style={{ fontSize: '12.5px', color: T.textFaint, margin: 0 }}>No partners match.</p>}
                {filteredPartners.slice(0, 8).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPartner({ id: p.id, displayName: p.displayName })}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: '6px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: '13px', cursor: 'pointer' }}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            )}

            {partnerTab === 'new' && (
              <div style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Partner / Company Name *</label>
                  <input style={fieldStyle} value={newPartner.displayName} onChange={(e) => setNewPartner((s) => ({ ...s, displayName: e.target.value }))} placeholder="e.g. Soho Hospitality" />
                </div>
                <div>
                  <label style={labelStyle}>Legal Name</label>
                  <input style={fieldStyle} value={newPartner.legalName} onChange={(e) => setNewPartner((s) => ({ ...s, legalName: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Quick Note</label>
                  <textarea
                    style={{ ...fieldStyle, minHeight: '60px', resize: 'vertical' }}
                    value={newPartner.relationshipSummary}
                    onChange={(e) => setNewPartner((s) => ({ ...s, relationshipSummary: e.target.value }))}
                    placeholder="e.g. Hospitality group we work with across several venues"
                  />
                </div>
                <button type="button" disabled={!newPartner.displayName.trim() || creatingPartner} style={primaryBtn(!newPartner.displayName.trim() || creatingPartner)} onClick={handleCreatePartner}>
                  {creatingPartner ? 'Creating…' : 'Create Partner'}
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Step 2 — Deal: the real workspace (context, what's being discussed,
          commercial terms). Saving here is already a valid Deal/Opportunity
          record — it does not require or create a Proposal. */}
      {selectedPartner && (
        <SectionCard title="2 · Deal" done={Boolean(selectedDeal)}>
          {selectedDeal ? (
            wantsProposal ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {selectedDeal.businessContexts.map((c) => (
                    <span key={c} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{c}</span>
                  ))}
                </div>
                <button type="button" onClick={handleChangeDeal} style={{ fontSize: '11.5px', color: T.textMuted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Change
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} color={T.statusGreen} /> Deal saved
                </p>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', margin: '0 0 4px' }}>
                  {selectedDeal.businessContexts.map((c) => (
                    <span key={c} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{c}</span>
                  ))}
                </div>
                {selectedDeal.product && <p style={{ fontSize: '12.5px', color: T.textMuted, margin: '0 0 12px' }}>{selectedDeal.product}</p>}
                <p style={{ fontSize: '12px', color: T.textFaint, margin: '0 0 12px' }}>
                  This is already a valid Opportunity/Deal record. A Proposal is optional — most small partners don't need one.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" style={branchSecondaryBtn} onClick={handleDoneForNow}>Done for now</button>
                  <button type="button" style={branchPrimaryBtn} onClick={() => setWantsProposal(true)}>Create Proposal</button>
                </div>
              </div>
            )
          ) : existingDeals === null ? (
            <p style={{ fontSize: '12.5px', color: T.textFaint, margin: 0 }}>Loading…</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {/* Always clickable — zero existing deals is a real, valid state
                    with its own empty-state UI below, not a reason to disable
                    the tab itself. */}
                <button type="button" style={tabStyle(dealTab === 'existing')} onClick={() => setDealTab('existing')}>
                  Existing Deal {existingDeals.length > 0 ? `(${existingDeals.length})` : ''}
                </button>
                <button type="button" style={tabStyle(dealTab === 'new')} onClick={() => setDealTab('new')}>New Deal</button>
              </div>

              {dealTab === 'existing' && (
                <div>
                  {existingDeals.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '18px 0' }}>
                      <p style={{ fontSize: '12.5px', color: T.textFaint, margin: '0 0 10px' }}>No existing deals yet</p>
                      <button type="button" onClick={() => setDealTab('new')} style={{ fontSize: '12px', fontWeight: 600, color: T.accentText, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        Create a new deal
                      </button>
                    </div>
                  )}
                  {existingDeals.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDeal(d)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: '6px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.bg, color: T.text, cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '3px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{d.status}</span>
                        {d.businessContexts.map((c) => <span key={c} style={{ fontSize: '10px', color: T.textFaint }}>{c}</span>)}
                      </div>
                      {d.product && <p style={{ fontSize: '12px', margin: 0, color: T.textMuted }}>{d.product}</p>}
                      {d.locationId && (
                        <p style={{ fontSize: '11px', margin: '2px 0 0', color: T.textFaint }}>
                          {locations.find((l) => l.id === d.locationId)?.name ?? 'Location'}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {dealTab === 'new' && (
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Which business context? *</label>
                    {/* V1: only the known-context toggle chips. The free-text
                        "+ Add custom context" control was removed from this
                        operator-facing UI -- it read as too easy to confuse
                        with Deal Terms. Nothing about the underlying model
                        changed: business_contexts is still a plain TEXT[]
                        with no DB enum, and the API already accepts any
                        string array -- a custom-context control can be
                        reintroduced here later with no backend change. */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {KNOWN_CONTEXTS.map((kc) => (
                        <button key={kc.value} type="button" onClick={() => toggleKnownContext(kc.value)} style={contextChipStyle(newDeal.businessContexts.includes(kc.value))}>
                          {kc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>What are we discussing?</label>
                    <input style={fieldStyle} value={newDeal.product} onChange={(e) => setNewDeal((s) => ({ ...s, product: e.target.value }))} placeholder="e.g. BCC venue partnership" />
                  </div>
                  {locations.length > 0 && (
                    <div>
                      <label style={labelStyle}>Location — optional</label>
                      <select style={fieldStyle} value={newDeal.locationId} onChange={(e) => setNewDeal((s) => ({ ...s, locationId: e.target.value }))}>
                        <option value="">Whole relationship</option>
                        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Deal terms — fill in what's agreed so far, optional</label>
                    <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '2px 12px' }}>
                      {newDeal.terms.map((v, i) => (
                        <div key={v.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
                          <span style={{ fontSize: '11.5px', color: T.textMuted, flex: '0 0 42%' }}>{v.label}{v.required ? ' *' : ''}</span>
                          <input
                            value={v.value ?? ''}
                            onChange={(e) => setDealTermValue(v.key, e.target.value)}
                            placeholder="TBD"
                            style={{ ...fieldStyle, flex: 1, padding: '6px 9px', fontSize: '12px' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <button type="button" disabled={newDeal.businessContexts.length === 0 || creatingDeal} style={primaryBtn(newDeal.businessContexts.length === 0 || creatingDeal)} onClick={handleSaveDeal}>
                    {creatingDeal ? 'Saving…' : 'Save Deal'}
                  </button>
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {/* Step 3 — Proposal only (reached only by explicit "Create Proposal"
          choice above). No Deal Variables here — the Working Draft inherits
          them server-side from the Deal (lib/proposals.ts createProposal()). */}
      {selectedPartner && selectedDeal && wantsProposal && (
        <SectionCard title="3 · Create the Working Draft">
          <div style={{ display: 'grid', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Proposal title *</label>
              <input style={fieldStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${selectedPartner.displayName} partnership proposal`} />
            </div>
            <button type="button" disabled={!title.trim() || creatingProposal} style={primaryBtn(!title.trim() || creatingProposal)} onClick={handleCreateProposal}>
              {creatingProposal ? 'Generating…' : 'Generate Draft'}
            </button>
            <p style={{ fontSize: '11px', color: T.textFaint, margin: 0, textAlign: 'center' }}>
              Draft will use AI if available, otherwise the deterministic fallback.
            </p>
          </div>
        </SectionCard>
      )}

      {error && <p style={{ fontSize: '12.5px', color: T.statusRed, margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}
