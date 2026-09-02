import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronLeft, Handshake, MapPin, Users, Briefcase, FileText, StickyNote, BadgeCheck,
} from 'lucide-react'
import { getPartnerProfileForOperator } from '@/lib/operator/partners'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import type { RelationshipStatus, PartnerDealStatus } from '@/lib/partners'
import type { ProposalStatus } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

// Phase 3D: Partner Profile — fully read-only. No edit/create controls for
// contacts, locations, deals, or proposals — that's 3E (writes) and 3F
// (proposal workflow). This page reads the Phase 3C-2 domain layer only
// (getPartnerProfileForOperator); it introduces no new query shape of its
// own beyond that one call, and no write route.

const RELATIONSHIP_STATUS_LABEL: Record<RelationshipStatus, string> = {
  prospect: 'Prospect',
  'in-conversation': 'In conversation',
  'proposal-pending': 'Proposal pending',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}
const RELATIONSHIP_STATUS_COLOR: Record<RelationshipStatus, string> = {
  prospect: T.statusBlue, 'in-conversation': T.statusAmber, 'proposal-pending': T.statusPurple,
  active: T.statusGreen, paused: T.textMuted, archived: T.textFaint,
}
const RELATIONSHIP_STATUS_SOFT: Record<RelationshipStatus, string> = {
  prospect: T.statusBlueSoft, 'in-conversation': T.statusAmberSoft, 'proposal-pending': T.statusPurpleSoft,
  active: T.statusGreenSoft, paused: T.chipBg, archived: T.chipBg,
}
const ORG_TYPE_LABEL: Record<string, string> = {
  'hospitality-group': 'Hospitality group', venue: 'Venue', brand: 'Brand', agency: 'Agency', individual: 'Individual', other: 'Organization',
}
const DEAL_STATUS_LABEL: Record<PartnerDealStatus, string> = { proposed: 'Proposed', informal: 'Informal', signed: 'Signed', expired: 'Expired' }
const DEAL_STATUS_COLOR: Record<PartnerDealStatus, string> = { proposed: T.statusBlue, informal: T.statusAmber, signed: T.statusGreen, expired: T.textFaint }
const DEAL_STATUS_SOFT: Record<PartnerDealStatus, string> = { proposed: T.statusBlueSoft, informal: T.statusAmberSoft, signed: T.statusGreenSoft, expired: T.chipBg }
const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: 'Draft', review: 'Review', approved: 'Approved', exported: 'Exported', sent: 'Sent', archived: 'Archived',
}
const PROPOSAL_STATUS_COLOR: Record<ProposalStatus, string> = {
  draft: T.statusAmber, review: T.statusBlue, approved: T.statusPurple, exported: T.statusGreen, sent: T.statusGreen, archived: T.textFaint,
}
const PROPOSAL_STATUS_SOFT: Record<ProposalStatus, string> = {
  draft: T.statusAmberSoft, review: T.statusBlueSoft, approved: T.statusPurpleSoft, exported: T.statusGreenSoft, sent: T.statusGreenSoft, archived: T.chipBg,
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SectionLabel({ children, mt = 20 }: { children: React.ReactNode; mt?: number }) {
  return <p style={{ ...eyebrow(T.textFaint), margin: `${mt}px 0 9px` }}>{children}</p>
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: '12.5px', color: T.textFaint, margin: '0 0 4px' }}>{text}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '13px 14px', marginBottom: '8px' }}>{children}</div>
}

function StatusPill({ label, color, soft }: { label: string; color: string; soft: string }) {
  return <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color, background: soft, flexShrink: 0 }}>{label}</span>
}

export default async function PartnerProfilePage({ params }: { params: { id: string } }) {
  const profile = await getPartnerProfileForOperator(params.id)
  if (!profile) notFound()
  const { partner, relationshipOwnerName, deals, proposals } = profile

  const locationName = new Map(partner.locations.map((l) => [l.id, l.name]))

  return (
    <div style={{ padding: '20px 18px 40px' }}>
      <Link href="/operator/manage/partners" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Partners
      </Link>

      {/* Identity */}
      <div style={{ width: '48px', height: '48px', borderRadius: T.radiusSm, background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
        <Handshake size={20} color={T.textFaint} />
      </div>
      <h1 style={{ fontSize: '21px', fontWeight: 700, margin: '0 0 4px' }}>{partner.displayName}</h1>
      {partner.legalName && partner.legalName !== partner.displayName && (
        <p style={{ fontSize: '12.5px', color: T.textMuted, margin: '0 0 8px' }}>{partner.legalName}</p>
      )}

      {/* Overview */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '4px 0 14px' }}>
        <StatusPill label={RELATIONSHIP_STATUS_LABEL[partner.relationshipStatus]} color={RELATIONSHIP_STATUS_COLOR[partner.relationshipStatus]} soft={RELATIONSHIP_STATUS_SOFT[partner.relationshipStatus]} />
        {partner.organizationType && (
          <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>
            {ORG_TYPE_LABEL[partner.organizationType] ?? partner.organizationType}
          </span>
        )}
      </div>

      {partner.relationshipSummary && (
        <p style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.55, margin: '0 0 14px' }}>{partner.relationshipSummary}</p>
      )}

      <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '15px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px' }}>
        <div>
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '4px' }}>Owner</p>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{relationshipOwnerName ?? '—'}</p>
        </div>
        <div>
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '4px' }}>Review date</p>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{fmtDate(partner.reviewDate)}</p>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '4px' }}>Next action</p>
          <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{partner.nextAction ?? '—'}</p>
        </div>
      </div>

      {/* Locations */}
      <SectionLabel>Locations ({partner.locations.length})</SectionLabel>
      {partner.locations.length === 0 && <Empty text="No locations recorded." />}
      {partner.locations.map((loc) => (
        <Card key={loc.id}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={13} color={T.textFaint} /> {loc.name}
              </p>
              {loc.kind && <p style={{ fontSize: '11.5px', color: T.textMuted, margin: '0 0 2px' }}>{loc.kind}</p>}
              {loc.address && <p style={{ fontSize: '11.5px', color: T.textFaint, margin: 0 }}>{loc.address}</p>}
            </div>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', color: loc.isActive ? T.statusGreen : T.textFaint, background: loc.isActive ? T.statusGreenSoft : T.chipBg, flexShrink: 0 }}>
              {loc.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </Card>
      ))}

      {/* Contacts */}
      <SectionLabel>Contacts ({partner.contacts.length})</SectionLabel>
      {partner.contacts.length === 0 && <Empty text="No contacts recorded." />}
      {partner.contacts.map((c) => (
        <Card key={c.id}>
          <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={13} color={T.textFaint} /> {c.name}
          </p>
          {c.titleOrRole && <p style={{ fontSize: '11.5px', color: T.textMuted, margin: '0 0 4px' }}>{c.titleOrRole}</p>}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {c.email && <span style={{ fontSize: '11.5px', color: T.textFaint }}>{c.email}</span>}
            {c.phone && <span style={{ fontSize: '11.5px', color: T.textFaint }}>{c.phone}</span>}
          </div>
          {c.notes && <p style={{ fontSize: '11.5px', color: T.textMuted, margin: '6px 0 0', lineHeight: 1.5 }}>{c.notes}</p>}
        </Card>
      ))}

      {/* Deals */}
      <SectionLabel>Deals ({deals.length})</SectionLabel>
      {deals.length === 0 && <Empty text="No deals recorded." />}
      {deals.map((deal) => (
        <Card key={deal.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusPill label={DEAL_STATUS_LABEL[deal.status]} color={DEAL_STATUS_COLOR[deal.status]} soft={DEAL_STATUS_SOFT[deal.status]} />
              {deal.businessContexts.map((c) => (
                <span key={c} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{c}</span>
              ))}
            </div>
          </div>
          <p style={{ fontSize: '12.5px', color: T.textMuted, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Briefcase size={12} color={T.textFaint} />
            {deal.locationId ? (locationName.get(deal.locationId) ?? 'Location') : 'Whole relationship'}
            {deal.product ? ` · ${deal.product}` : ''}
          </p>
          {deal.terms.length > 0 && (
            <div style={{ marginBottom: '6px' }}>
              {deal.terms.map((t) => (
                <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '4px 0', borderTop: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: '11.5px', color: T.textMuted }}>{t.label}</span>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: t.value ? T.text : T.textFaint, textAlign: 'right' }}>{t.value ?? 'TBD'}</span>
                </div>
              ))}
            </div>
          )}
          {(deal.effectiveFrom || deal.effectiveUntil) && (
            <p style={{ fontSize: '11px', color: T.textFaint, margin: '0 0 4px' }}>
              {fmtDate(deal.effectiveFrom)} – {deal.effectiveUntil ? fmtDate(deal.effectiveUntil) : 'ongoing'}
            </p>
          )}
          {deal.notes && <p style={{ fontSize: '11.5px', color: T.textMuted, margin: '4px 0 0', lineHeight: 1.5 }}>{deal.notes}</p>}
        </Card>
      ))}

      {/* Proposals */}
      <SectionLabel>Proposals ({proposals.length})</SectionLabel>
      {proposals.length === 0 && <Empty text="No proposals yet." />}
      {proposals.map((p) => (
        <Card key={p.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
              <FileText size={13} color={T.textFaint} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
            </p>
            <StatusPill label={PROPOSAL_STATUS_LABEL[p.status]} color={PROPOSAL_STATUS_COLOR[p.status]} soft={PROPOSAL_STATUS_SOFT[p.status]} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color: p.version === null ? T.statusAmber : T.statusPurple, background: p.version === null ? T.statusAmberSoft : T.statusPurpleSoft }}>
              {p.version === null ? 'Working Draft' : `Version ${p.version}`}
            </span>
            {p.businessContexts.map((c) => (
              <span key={c} style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>{c}</span>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: T.textFaint, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{fmtDate(p.proposalDate)}</span>
            {p.pdfStoragePath && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: T.statusGreen }}>
                <BadgeCheck size={12} /> PDF available
              </span>
            )}
          </p>
        </Card>
      ))}

      {/* Relationship notes */}
      <SectionLabel>Relationship Notes ({partner.relationshipNotes.length})</SectionLabel>
      {partner.relationshipNotes.length === 0 && <Empty text="No notes yet." />}
      {[...partner.relationshipNotes].reverse().map((note, i) => (
        <Card key={i}>
          <p style={{ fontSize: '10.5px', color: T.textFaint, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <StickyNote size={11} /> {fmtDate(note.date)}
          </p>
          <p style={{ fontSize: '12.5px', color: T.text, margin: '0 0 4px', lineHeight: 1.5 }}>{note.summary}</p>
          {note.decisions && <p style={{ fontSize: '11.5px', color: T.textMuted, margin: '0 0 2px', lineHeight: 1.5 }}><strong>Decisions:</strong> {note.decisions}</p>}
          {note.nextSteps && <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0, lineHeight: 1.5 }}><strong>Next:</strong> {note.nextSteps}</p>}
        </Card>
      ))}
    </div>
  )
}
