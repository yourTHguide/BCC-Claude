import 'server-only'

// SNX Phase 3C-2 — Proposal domain layer, backed by the production
// `proposals` table (Phase 3C-1, applied 2026-09-03). "PORT WITH STORAGE
// ADAPTATION" for the CRUD/lineage logic per the Phase 3C plan: Living OS's
// src/lib/proposals.ts held the same shapes in an in-memory array hydrated
// from a JSON file; this is the same domain model against real Postgres
// rows. The deal-variable helpers below are the one piece that is genuinely
// unchanged logic, not just re-hosted (see their own comments).
//
// Working Draft / Finalized Version lifecycle (this repo's correction,
// applied in the Phase 3C-1 schema): a row is a Working Draft
// (`version IS NULL`, freely editable — createProposal/updateProposalDraft/
// updateProposalDealVariables all just UPDATE this same row) or a
// permanently frozen Finalized Version (`version IS NOT NULL`, assigned
// exactly once by a future Finalize & Generate PDF action — see the
// deliberately-unimplemented boundary marker near the bottom of this file).
// NOTHING in this file ever assigns or increments `version`.

import { getServiceSupabase } from '@/lib/supabase'
import { getPartnershipFramework } from '@/lib/partnershipFramework'
import { getProposalWritingStandard } from '@/lib/proposalWritingStandard'
import { generateProposalDraft, reviseProposalDraft } from '@/lib/proposalGeneration'
import type { ProposalWriterInputs } from '@/lib/proposalWriter'
import { getPartner, getPartnerDeal } from '@/lib/partners'
import { buildProposalDocument } from '@/lib/proposalDocument'
import { renderProposalPdf } from '@/lib/proposalPdf'
import { proposalPdfStoragePath, uploadProposalPdf, getSignedProposalPdfUrl } from '@/lib/proposalPdfStorage'

export type ProposalStatus = 'draft' | 'review' | 'approved' | 'exported' | 'sent' | 'archived'
export type ProposalWriterMode = 'ai' | 'deterministic'

/**
 * A single dynamic deal variable. Unknown commercial terms stay visible as
 * TBD. PORT UNCHANGED from Living OS's src/lib/proposals.ts
 * ProposalDealVariable — the exact shape `partner_deals.terms` and
 * `proposals.deal_terms_snapshot` both store as JSONB.
 */
export interface ProposalDealVariable {
  key: string
  label: string
  value?: string
  /** Whether this variable is required before a proposal can be finalized. */
  required?: boolean
}

export interface Proposal {
  id: string
  partnerId: string
  dealId: string | null
  seriesId: string
  /** null = Working Draft. Non-null = permanently frozen Finalized Version. */
  version: number | null
  draftRevision: number
  businessContexts: string[]
  product: string | null
  title: string
  status: ProposalStatus
  frameworkVersion: string
  writingStandardVersion: string | null
  productProfileVersion: string | null
  proposalDate: string
  dealTermsSnapshot: ProposalDealVariable[]
  contextForProposal: string | null
  writingDirection: string | null
  writerMode: ProposalWriterMode | null
  draftContent: string | null
  approvedContent: string | null
  approvedAt: string | null
  approvedBy: string | null
  pdfStoragePath: string | null
  pdfGeneratedAt: string | null
  createdAt: string
  updatedAt: string
}

const PROPOSAL_FIELDS =
  'id, partner_id, deal_id, series_id, version, draft_revision, business_contexts, product, title, status, framework_version, writing_standard_version, product_profile_version, proposal_date, deal_terms_snapshot, context_for_proposal, writing_direction, writer_mode, draft_content, approved_content, approved_at, approved_by, pdf_storage_path, pdf_generated_at, created_at, updated_at'

function rowToProposal(row: any): Proposal {
  return {
    id: row.id,
    partnerId: row.partner_id,
    dealId: row.deal_id,
    seriesId: row.series_id,
    version: row.version,
    draftRevision: row.draft_revision,
    businessContexts: row.business_contexts ?? [],
    product: row.product,
    title: row.title,
    status: row.status,
    frameworkVersion: row.framework_version,
    writingStandardVersion: row.writing_standard_version,
    productProfileVersion: row.product_profile_version,
    proposalDate: row.proposal_date,
    dealTermsSnapshot: row.deal_terms_snapshot ?? [],
    contextForProposal: row.context_for_proposal,
    writingDirection: row.writing_direction,
    writerMode: row.writer_mode,
    draftContent: row.draft_content,
    approvedContent: row.approved_content,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    pdfStoragePath: row.pdf_storage_path,
    pdfGeneratedAt: row.pdf_generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** The editable draft content. */
export function proposalDraftContent(proposal: Proposal): string {
  return proposal.draftContent ?? ''
}

/** The content to freeze/print: the approved copy once finalized, else the current draft. */
export function proposalFinalContent(proposal: Proposal): string {
  return proposal.approvedContent ?? proposal.draftContent ?? ''
}

// ── Deal-variable helpers ──────────────────────────────────────────────
// PORT UNCHANGED from Living OS's src/lib/proposals.ts — pure functions over
// the ProposalDealVariable[] shape, genuinely indifferent to where the JSON
// came from. One typing adaptation: Living OS's missingRequiredVariables()
// took a whole Proposal and read `proposal.dealVariables`; this repo has
// TWO places this shape lives (`partner_deals.terms` and
// `proposals.dealTermsSnapshot`), so it now takes the variable array
// directly — the minimal adaptation the Phase 3C plan pre-authorized.

/**
 * The standard commercial deal variables a partnership must settle. Every
 * value is intentionally BLANK — these are the terms that must be agreed
 * with the partner and must never be invented. Required ones block a Deal's
 * terms (or a proposal's snapshot of them) from being treated as complete.
 */
export function defaultDealVariables(): ProposalDealVariable[] {
  return [
    { key: 'commission', label: 'Commission / revenue share', required: true },
    { key: 'entry-terms', label: 'Entry / free-drink terms', required: false },
    { key: 'minimum-spend', label: 'Minimum spend', required: false },
    { key: 'guaranteed-traffic', label: 'Guaranteed traffic / group sizes', required: false },
    { key: 'operating-rules', label: 'Venue operating rules', required: false },
    { key: 'contract-period', label: 'Contract period', required: true },
    { key: 'exclusivity', label: 'Exclusivity', required: false },
  ]
}

/** Merge provided variable values over the standard template, keeping labels/required. */
export function mergeDealVariables(
  template: ProposalDealVariable[],
  provided: Array<{ key: string; value?: string }> | undefined
): ProposalDealVariable[] {
  if (!provided || provided.length === 0) return template.map((variable) => ({ ...variable }))
  const byKey = new Map(provided.map((item) => [item.key, item.value]))
  const merged = template.map((variable) =>
    byKey.has(variable.key) ? { ...variable, value: byKey.get(variable.key)?.trim() || undefined } : { ...variable }
  )
  // Preserve any extra provided variables not in the template.
  for (const item of provided) {
    if (!template.some((variable) => variable.key === item.key)) {
      merged.push({ key: item.key, label: item.key, value: item.value?.trim() || undefined })
    }
  }
  return merged
}

/** Required variables that are still blank — must be surfaced before finalization. */
export function missingRequiredVariables(variables: ProposalDealVariable[]): ProposalDealVariable[] {
  return variables.filter((variable) => variable.required && !variable.value?.trim())
}

// ── Reads ───────────────────────────────────────────────────────────────

export async function getProposals(filter?: { status?: ProposalStatus; partnerId?: string }): Promise<Proposal[]> {
  const supabase = getServiceSupabase()
  let query = supabase.from('proposals').select(PROPOSAL_FIELDS).order('created_at', { ascending: false })
  if (filter?.status) query = query.eq('status', filter.status)
  if (filter?.partnerId) query = query.eq('partner_id', filter.partnerId)
  const { data, error } = await query
  if (error) {
    console.error('lib/proposals getProposals: query error:', error)
    return []
  }
  return (data ?? []).map(rowToProposal)
}

export async function proposalsForPartner(partnerId: string): Promise<Proposal[]> {
  return getProposals({ partnerId })
}

/** Every Working Draft and Finalized Version sharing one lineage, newest first. */
export async function proposalsForSeries(seriesId: string): Promise<Proposal[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_FIELDS)
    .eq('series_id', seriesId)
    .order('version', { ascending: false, nullsFirst: true })
  if (error) {
    console.error('lib/proposals proposalsForSeries: query error:', error)
    return []
  }
  return (data ?? []).map(rowToProposal)
}

/** The highest-numbered Finalized Version in a series, or null if none has ever been finalized. */
export async function latestVersionForSeries(seriesId: string): Promise<Proposal | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_FIELDS)
    .eq('series_id', seriesId)
    .not('version', 'is', null)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('lib/proposals latestVersionForSeries: query error:', error)
    return null
  }
  return data ? rowToProposal(data) : null
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('proposals').select(PROPOSAL_FIELDS).eq('id', id).maybeSingle()
  if (error) {
    console.error('lib/proposals getProposal: query error:', error)
    return null
  }
  return data ? rowToProposal(data) : null
}

// ── Working Draft writes ─────────────────────────────────────────────────
// None of the functions below ever touch `version` — every one is a plain
// INSERT (the very first draft) or UPDATE of the current Working Draft row.
// proposals_lifecycle_invariant and the at-most-one-draft-per-series partial
// unique index (Phase 3C-1) are the database-level backstop; the app-layer
// checks here (status/version guards) are the friendly first line.

export interface CreateProposalInput {
  partnerId: string
  dealId?: string | null
  businessContexts: string[]
  product?: string
  title: string
  /** Omit to start from defaultDealVariables(). */
  dealVariables?: ProposalDealVariable[]
  contextForProposal?: string
  writingDirection?: string
  venues?: string[]
}

/** Create the very first Working Draft of a new proposal "line". Mints a new series_id; version stays NULL. */
export async function createProposal(input: CreateProposalInput): Promise<Proposal> {
  const partner = await getPartner(input.partnerId)
  if (!partner) throw new Error(`createProposal: partner ${input.partnerId} not found`)

  const framework = getPartnershipFramework()
  const writingStandard = getProposalWritingStandard()
  const dealVariables = input.dealVariables ?? defaultDealVariables()
  const proposalDate = new Date().toISOString().slice(0, 10)

  const writerInputs: ProposalWriterInputs = {
    framework,
    writingStandard,
    productProfile: undefined,
    partnerDisplayName: partner.displayName,
    businessContexts: input.businessContexts,
    product: input.product,
    venues: input.venues ?? partner.locations.filter((l) => l.isActive).map((l) => l.name),
    relationshipSummary: partner.relationshipSummary ?? undefined,
    dealVariables,
    contextForProposal: input.contextForProposal,
    writingDirection: input.writingDirection,
    version: null,
    proposalDate,
  }
  const draft = await generateProposalDraft(writerInputs)

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      partner_id: input.partnerId,
      deal_id: input.dealId ?? null,
      series_id: crypto.randomUUID(),
      version: null,
      business_contexts: input.businessContexts,
      product: input.product ?? null,
      title: input.title,
      status: 'draft',
      framework_version: framework.version,
      writing_standard_version: writingStandard.version,
      product_profile_version: null,
      proposal_date: proposalDate,
      deal_terms_snapshot: dealVariables,
      context_for_proposal: input.contextForProposal ?? null,
      writing_direction: input.writingDirection ?? null,
      writer_mode: draft.mode,
      draft_content: draft.content,
    })
    .select(PROPOSAL_FIELDS)
    .single()

  if (error || !data) {
    console.error('lib/proposals createProposal: insert error:', error)
    throw new Error('Failed to create proposal draft')
  }
  return rowToProposal(data)
}

/**
 * "Create New Draft from V1" (or any other Finalized Version). Only valid
 * from an already-frozen row (app-layer check; the DB has no direct
 * constraint forcing this since a Working Draft simply has nothing to
 * branch from). Same series_id; a brand-new row, version NULL. draft_content
 * seeds from the source version's frozen content; deal variables are
 * re-merged from the partner's CURRENT deal terms (if dealId is supplied) so
 * a new round reflects any commercial changes since the prior version,
 * rather than silently reusing stale figures.
 */
export async function createDraftFromFinalizedVersion(sourceProposalId: string): Promise<Proposal> {
  const source = await getProposal(sourceProposalId)
  if (!source) throw new Error(`createDraftFromFinalizedVersion: proposal ${sourceProposalId} not found`)
  if (source.version === null) {
    throw new Error('createDraftFromFinalizedVersion: source proposal is still a Working Draft, not a Finalized Version')
  }

  // Friendly pre-check for the DB's own at-most-one-open-draft-per-series
  // partial unique index (idx_proposals_one_draft_per_series) — the index is
  // the real guarantee; this just gives a clear error instead of a raw
  // Postgres unique-violation.
  const seriesRows = await proposalsForSeries(source.seriesId)
  const openDraft = seriesRows.find((p) => p.version === null)
  if (openDraft) {
    throw new Error(`createDraftFromFinalizedVersion: series ${source.seriesId} already has an open Working Draft (${openDraft.id}) — finalize or continue that one first`)
  }

  // Re-merge the partner's CURRENT deal terms (if this line has a linked
  // Deal) onto the frozen version's snapshot as the template, so a new round
  // starts from any commercial changes made since the prior version rather
  // than silently reusing stale figures. Labels/required flags come from the
  // frozen snapshot; values come from the live deal.
  let dealTermsSnapshot = source.dealTermsSnapshot
  if (source.dealId) {
    const deal = await getPartnerDeal(source.dealId)
    if (deal) dealTermsSnapshot = mergeDealVariables(source.dealTermsSnapshot, deal.terms)
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      partner_id: source.partnerId,
      deal_id: source.dealId,
      series_id: source.seriesId,
      version: null,
      business_contexts: source.businessContexts,
      product: source.product,
      title: source.title,
      status: 'draft',
      framework_version: source.frameworkVersion,
      writing_standard_version: source.writingStandardVersion,
      product_profile_version: source.productProfileVersion,
      proposal_date: new Date().toISOString().slice(0, 10),
      deal_terms_snapshot: dealTermsSnapshot,
      context_for_proposal: source.contextForProposal,
      writing_direction: source.writingDirection,
      writer_mode: source.writerMode,
      draft_content: proposalFinalContent(source),
    })
    .select(PROPOSAL_FIELDS)
    .single()

  if (error || !data) {
    console.error('lib/proposals createDraftFromFinalizedVersion: insert error:', error)
    throw new Error('Failed to create new draft from finalized version')
  }
  return rowToProposal(data)
}

function assertStillDraft(proposal: Pick<Proposal, 'version'>, action: string) {
  if (proposal.version !== null) {
    throw new Error(`${action}: proposal is already a finalized version (frozen) — create a new Working Draft to keep editing`)
  }
}

/** Manual edit of the draft's content. Same row, no version change — draft_revision auto-advances via the DB trigger. */
export async function updateProposalDraft(id: string, draftContent: string): Promise<Proposal> {
  const existing = await getProposal(id)
  if (!existing) throw new Error(`updateProposalDraft: proposal ${id} not found`)
  assertStillDraft(existing, 'updateProposalDraft')

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('proposals')
    .update({ draft_content: draftContent })
    .eq('id', id)
    .select(PROPOSAL_FIELDS)
    .single()
  if (error || !data) {
    console.error('lib/proposals updateProposalDraft: update error:', error)
    throw new Error('Failed to update proposal draft')
  }
  return rowToProposal(data)
}

/** Update the deal-variable snapshot on a Working Draft (commercial-term edits while drafting). Same row, no version change. */
export async function updateProposalDealVariables(id: string, variables: ProposalDealVariable[]): Promise<Proposal> {
  const existing = await getProposal(id)
  if (!existing) throw new Error(`updateProposalDealVariables: proposal ${id} not found`)
  assertStillDraft(existing, 'updateProposalDealVariables')

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('proposals')
    .update({ deal_terms_snapshot: variables })
    .eq('id', id)
    .select(PROPOSAL_FIELDS)
    .single()
  if (error || !data) {
    console.error('lib/proposals updateProposalDealVariables: update error:', error)
    throw new Error('Failed to update proposal deal variables')
  }
  return rowToProposal(data)
}

/**
 * Regenerate the draft from scratch against the same stored inputs (AI if
 * configured, deterministic otherwise — Phase 3C-2: always deterministic).
 * Same row, no version change.
 */
export async function regenerateProposalDraft(id: string): Promise<Proposal> {
  const existing = await getProposal(id)
  if (!existing) throw new Error(`regenerateProposalDraft: proposal ${id} not found`)
  assertStillDraft(existing, 'regenerateProposalDraft')
  const partner = await getPartner(existing.partnerId)
  if (!partner) throw new Error(`regenerateProposalDraft: partner ${existing.partnerId} not found`)

  const writerInputs: ProposalWriterInputs = {
    framework: getPartnershipFramework(),
    writingStandard: getProposalWritingStandard(),
    productProfile: undefined,
    partnerDisplayName: partner.displayName,
    businessContexts: existing.businessContexts,
    product: existing.product ?? undefined,
    venues: partner.locations.filter((l) => l.isActive).map((l) => l.name),
    relationshipSummary: partner.relationshipSummary ?? undefined,
    dealVariables: existing.dealTermsSnapshot,
    contextForProposal: existing.contextForProposal ?? undefined,
    writingDirection: existing.writingDirection ?? undefined,
    version: null,
    proposalDate: existing.proposalDate,
  }
  const draft = await generateProposalDraft(writerInputs)
  return updateProposalDraft(id, draft.content)
}

/** Apply a natural-language revision instruction (Request Changes). Same row, no version change. */
export async function requestProposalChanges(id: string, instruction: string): Promise<Proposal> {
  const existing = await getProposal(id)
  if (!existing) throw new Error(`requestProposalChanges: proposal ${id} not found`)
  assertStillDraft(existing, 'requestProposalChanges')
  const partner = await getPartner(existing.partnerId)
  if (!partner) throw new Error(`requestProposalChanges: partner ${existing.partnerId} not found`)

  const writerInputs: ProposalWriterInputs = {
    framework: getPartnershipFramework(),
    writingStandard: getProposalWritingStandard(),
    productProfile: undefined,
    partnerDisplayName: partner.displayName,
    businessContexts: existing.businessContexts,
    product: existing.product ?? undefined,
    venues: partner.locations.filter((l) => l.isActive).map((l) => l.name),
    relationshipSummary: partner.relationshipSummary ?? undefined,
    dealVariables: existing.dealTermsSnapshot,
    contextForProposal: existing.contextForProposal ?? undefined,
    writingDirection: existing.writingDirection ?? undefined,
    version: null,
    proposalDate: existing.proposalDate,
  }
  const revised = await reviseProposalDraft(writerInputs, proposalDraftContent(existing), instruction)
  return updateProposalDraft(id, revised.content)
}

// ── Finalize & Generate PDF (Phase 3F/3G) ─────────────────────────────────
// The ONLY function in this file that ever assigns `version`. Implements the
// algorithm settled in the Phase 3C-2 boundary comment (see git history for
// the original text) exactly: capture a snapshot, render + upload the PDF
// from that snapshot only, then one atomic conditional Postgres write.
// `proposals_lifecycle_invariant` (Phase 3C-1) rejects any attempt to set
// `version` without approved_content/approved_at/approved_by/
// pdf_storage_path/pdf_generated_at all present in the same statement, so
// the final UPDATE below cannot partially succeed at the database level.

export interface FinalizeProposalResult {
  proposal: Proposal
  /** True when this call did not itself perform the finalize — the proposal was already a Finalized Version (either a genuine retry, or a concurrent request won the race). Never a failure. */
  alreadyFinalized: boolean
}

/**
 * Finalize & Generate PDF: turns the current Working Draft into a
 * permanently frozen, numbered Finalized Version with a durable PDF.
 * Idempotent — calling this again on an already-finalized proposal returns
 * that same finalized row rather than erroring.
 */
export async function finalizeProposal(id: string, actorUserId: string): Promise<FinalizeProposalResult> {
  const existing = await getProposal(id)
  if (!existing) throw new Error(`finalizeProposal: proposal ${id} not found`)

  // Idempotent short-circuit: already a Finalized Version (a genuine retry
  // from the UI, or this exact call racing a concurrent one that already won).
  if (existing.version !== null) {
    return { proposal: existing, alreadyFinalized: true }
  }

  const partner = await getPartner(existing.partnerId)
  if (!partner) throw new Error(`finalizeProposal: partner ${existing.partnerId} not found`)

  // 1. Capture the exact snapshot to freeze. Nothing below this line ever
  // re-reads draft_content, deal_terms_snapshot, or any other mutable source
  // — the PDF and the frozen row must reflect this moment, not whatever the
  // draft has become by the time rendering/upload finishes.
  const capturedRevision = existing.draftRevision
  const capturedContent = existing.draftContent ?? ''

  const latest = await latestVersionForSeries(existing.seriesId)
  const nextVersion = (latest?.version ?? 0) + 1

  // 2. Render the PDF from exactly that snapshot.
  const document = buildProposalDocument({ ...existing, approvedContent: capturedContent }, partner.displayName)
  const pdfBuffer = await renderProposalPdf(document)

  // 3. Upload first (write-once, revision-keyed path — a retry at the same
  // captured revision safely reuses whatever is already there).
  const path = proposalPdfStoragePath(existing.partnerId, existing.seriesId, existing.id, capturedRevision)
  await uploadProposalPdf(path, pdfBuffer)

  // 4. The one atomic Postgres write, conditioned on nothing having changed
  // since the snapshot was captured.
  const supabase = getServiceSupabase()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('proposals')
    .update({
      version: nextVersion,
      approved_content: capturedContent,
      approved_at: nowIso,
      approved_by: actorUserId,
      pdf_storage_path: path,
      pdf_generated_at: nowIso,
      status: 'exported',
    })
    .eq('id', id)
    .is('version', null)
    .eq('draft_revision', capturedRevision)
    .select(PROPOSAL_FIELDS)
    .maybeSingle()

  if (error) {
    console.error('lib/proposals finalizeProposal: update error:', error)
    throw new Error('Failed to finalize proposal')
  }

  if (data) {
    return { proposal: rowToProposal(data), alreadyFinalized: false }
  }

  // Zero rows matched the WHERE clause — re-read to tell apart the two
  // possible causes rather than guessing.
  const reread = await getProposal(id)
  if (reread && reread.version !== null) {
    // A concurrent finalize already won this exact race — idempotent success.
    return { proposal: reread, alreadyFinalized: true }
  }
  // The draft changed mid-render (a new edit bumped draft_revision past what
  // was captured). No version was assigned; nothing was frozen; the orphaned
  // PDF upload at the old revision's path is harmless and unreferenced.
  throw new Error('The draft changed since it was last previewed. Preview it again before finalizing.')
}

/** Signed URL to view or download a Finalized Version's durable PDF. Throws if this proposal has no PDF yet (still a Working Draft). */
export async function getProposalPdfUrl(id: string, opts?: { download?: boolean | string }): Promise<string> {
  const proposal = await getProposal(id)
  if (!proposal) throw new Error(`getProposalPdfUrl: proposal ${id} not found`)
  if (!proposal.pdfStoragePath) throw new Error('getProposalPdfUrl: this proposal has not been finalized yet')
  return getSignedProposalPdfUrl(proposal.pdfStoragePath, opts)
}
