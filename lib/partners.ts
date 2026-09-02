import 'server-only'

// SNX Phase 3C-2 — Partner domain layer, backed by the production
// `partners`/`partner_contacts`/`partner_locations`/`partner_deals` tables
// (Phase 3C-1, applied 2026-09-03). "PORT WITH STORAGE ADAPTATION" per the
// Phase 3C plan: Living OS's src/lib/partners.ts held the same canonical-
// Partner shape and resolvePartner() matching logic in an in-memory array
// hydrated from a JSON file; this is the same model and the same matching
// logic against real Postgres rows.
//
// Auth boundary (Phase 3C §5, enforced here at the function-signature
// level): every function that attributes an action to a person takes an
// explicit `actorUserId` parameter, supplied by the caller after resolving
// a real session (a future route handler's requireAdmin()/requireRole()) —
// never read from a generic `input`/`patch` object. `relationship_owner` is
// the one exception: it's an assignment (who this partner is assigned to),
// not an attribution of who performed the write, so it's a plain editable
// field on Partner/updatePartner.

import { getServiceSupabase } from '@/lib/supabase'
import { defaultDealVariables, type ProposalDealVariable } from '@/lib/proposals'

export type PartnerOrganizationType = 'hospitality-group' | 'venue' | 'brand' | 'agency' | 'individual' | 'other'
export type RelationshipStatus = 'prospect' | 'in-conversation' | 'proposal-pending' | 'active' | 'paused' | 'archived'
export type PartnerDealStatus = 'proposed' | 'informal' | 'signed' | 'expired'

export interface PartnerNote {
  date: string
  author?: string
  summary: string
  decisions?: string
  nextSteps?: string
}

export interface PartnerFileLink {
  label: string
  href?: string
}

export interface PartnerContact {
  id: string
  partnerId: string
  personId: string | null
  name: string
  titleOrRole: string | null
  email: string | null
  phone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PartnerLocation {
  id: string
  partnerId: string
  name: string
  kind: string | null
  address: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PartnerDeal {
  id: string
  partnerId: string
  locationId: string | null
  businessContexts: string[]
  product: string | null
  status: PartnerDealStatus
  terms: ProposalDealVariable[]
  agreedAt: string | null
  effectiveFrom: string | null
  effectiveUntil: string | null
  documentUrl: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface Partner {
  id: string
  displayName: string
  legalName: string | null
  aliases: string[]
  organizationType: PartnerOrganizationType | null
  relationshipStatus: RelationshipStatus
  relationshipOwner: string | null
  relationshipSummary: string | null
  reviewDate: string | null
  nextAction: string | null
  relationshipNotes: PartnerNote[]
  files: PartnerFileLink[]
  createdAt: string
  updatedAt: string
  /** Populated by getPartner(); empty on getPartners()'s list rows to avoid an N+1 join. */
  contacts: PartnerContact[]
  /** Populated by getPartner(); empty on getPartners()'s list rows to avoid an N+1 join. */
  locations: PartnerLocation[]
}

const PARTNER_FIELDS =
  'id, display_name, legal_name, aliases, organization_type, relationship_status, relationship_owner, relationship_summary, review_date, next_action, relationship_notes, files, created_at, updated_at'

function rowToPartner(row: any, contacts: PartnerContact[] = [], locations: PartnerLocation[] = []): Partner {
  return {
    id: row.id,
    displayName: row.display_name,
    legalName: row.legal_name,
    aliases: row.aliases ?? [],
    organizationType: row.organization_type,
    relationshipStatus: row.relationship_status,
    relationshipOwner: row.relationship_owner,
    relationshipSummary: row.relationship_summary,
    reviewDate: row.review_date,
    nextAction: row.next_action,
    relationshipNotes: row.relationship_notes ?? [],
    files: row.files ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contacts,
    locations,
  }
}

function rowToContact(row: any): PartnerContact {
  return {
    id: row.id,
    partnerId: row.partner_id,
    personId: row.person_id,
    name: row.name,
    titleOrRole: row.title_or_role,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToLocation(row: any): PartnerLocation {
  return {
    id: row.id,
    partnerId: row.partner_id,
    name: row.name,
    kind: row.kind,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToDeal(row: any): PartnerDeal {
  return {
    id: row.id,
    partnerId: row.partner_id,
    locationId: row.location_id,
    businessContexts: row.business_contexts ?? [],
    product: row.product,
    status: row.status,
    terms: row.terms ?? [],
    agreedAt: row.agreed_at,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    documentUrl: row.document_url,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Partner reads ─────────────────────────────────────────────────────────

export async function getPartners(filter?: { status?: RelationshipStatus; search?: string }): Promise<Partner[]> {
  const supabase = getServiceSupabase()
  let query = supabase.from('partners').select(PARTNER_FIELDS).order('created_at', { ascending: false })
  if (filter?.status) query = query.eq('relationship_status', filter.status)
  if (filter?.search?.trim()) query = query.ilike('display_name', `%${filter.search.trim()}%`)
  const { data, error } = await query
  if (error) {
    console.error('lib/partners getPartners: query error:', error)
    return []
  }
  return (data ?? []).map((row: any) => rowToPartner(row))
}

/** Single partner, joined with contacts and locations (a real join, not stored nested). */
export async function getPartner(id: string): Promise<Partner | null> {
  const supabase = getServiceSupabase()
  const [{ data: partnerRow, error: partnerError }, { data: contactRows }, { data: locationRows }] = await Promise.all([
    supabase.from('partners').select(PARTNER_FIELDS).eq('id', id).maybeSingle(),
    supabase.from('partner_contacts').select('*').eq('partner_id', id).order('created_at', { ascending: true }),
    supabase.from('partner_locations').select('*').eq('partner_id', id).order('name', { ascending: true }),
  ])
  if (partnerError) {
    console.error('lib/partners getPartner: query error:', partnerError)
    return null
  }
  if (!partnerRow) return null
  return rowToPartner(
    partnerRow,
    (contactRows ?? []).map(rowToContact),
    (locationRows ?? []).map(rowToLocation)
  )
}

// ── Partner writes ────────────────────────────────────────────────────────

export interface CreatePartnerInput {
  displayName: string
  legalName?: string
  aliases?: string[]
  organizationType?: PartnerOrganizationType
  relationshipStatus?: RelationshipStatus
  relationshipOwner?: string
  relationshipSummary?: string
  reviewDate?: string
  nextAction?: string
}

export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('partners')
    .insert({
      display_name: input.displayName.trim(),
      legal_name: input.legalName?.trim() || null,
      aliases: input.aliases?.map((a) => a.trim().toLowerCase()).filter(Boolean) ?? null,
      organization_type: input.organizationType ?? null,
      relationship_status: input.relationshipStatus ?? 'prospect',
      relationship_owner: input.relationshipOwner ?? null,
      relationship_summary: input.relationshipSummary?.trim() || null,
      review_date: input.reviewDate ?? null,
      next_action: input.nextAction?.trim() || null,
    })
    .select(PARTNER_FIELDS)
    .single()
  if (error || !data) {
    console.error('lib/partners createPartner: insert error:', error)
    throw new Error('Failed to create partner')
  }
  return rowToPartner(data)
}

export interface UpdatePartnerPatch {
  displayName?: string
  legalName?: string | null
  aliases?: string[]
  organizationType?: PartnerOrganizationType | null
  relationshipStatus?: RelationshipStatus
  /** Assignment, not attribution — see file header. */
  relationshipOwner?: string | null
  relationshipSummary?: string | null
  reviewDate?: string | null
  nextAction?: string | null
}

export async function updatePartner(id: string, patch: UpdatePartnerPatch): Promise<Partner> {
  const supabase = getServiceSupabase()
  const update: Record<string, unknown> = {}
  if (patch.displayName !== undefined) update.display_name = patch.displayName.trim()
  if (patch.legalName !== undefined) update.legal_name = patch.legalName
  if (patch.aliases !== undefined) update.aliases = patch.aliases.map((a) => a.trim().toLowerCase()).filter(Boolean)
  if (patch.organizationType !== undefined) update.organization_type = patch.organizationType
  if (patch.relationshipStatus !== undefined) update.relationship_status = patch.relationshipStatus
  if (patch.relationshipOwner !== undefined) update.relationship_owner = patch.relationshipOwner
  if (patch.relationshipSummary !== undefined) update.relationship_summary = patch.relationshipSummary
  if (patch.reviewDate !== undefined) update.review_date = patch.reviewDate
  if (patch.nextAction !== undefined) update.next_action = patch.nextAction

  const { data, error } = await supabase.from('partners').update(update).eq('id', id).select(PARTNER_FIELDS).single()
  if (error || !data) {
    console.error('lib/partners updatePartner: update error:', error)
    throw new Error('Failed to update partner')
  }
  return rowToPartner(data)
}

/** Appends a relationship note. Server stamps date/author — never trusts a client-supplied value for either (Phase 3C §5). */
export async function addPartnerNote(
  id: string,
  note: { summary: string; decisions?: string; nextSteps?: string },
  actorUserId: string
): Promise<Partner> {
  const supabase = getServiceSupabase()
  const { data: existing, error: readError } = await supabase.from('partners').select('relationship_notes').eq('id', id).maybeSingle()
  if (readError || !existing) {
    console.error('lib/partners addPartnerNote: read error:', readError)
    throw new Error('Failed to load partner for note append')
  }
  const notes: PartnerNote[] = existing.relationship_notes ?? []
  const entry: PartnerNote = {
    date: new Date().toISOString(),
    author: actorUserId,
    summary: note.summary.trim(),
    decisions: note.decisions?.trim() || undefined,
    nextSteps: note.nextSteps?.trim() || undefined,
  }
  const { data, error } = await supabase
    .from('partners')
    .update({ relationship_notes: [...notes, entry] })
    .eq('id', id)
    .select(PARTNER_FIELDS)
    .single()
  if (error || !data) {
    console.error('lib/partners addPartnerNote: update error:', error)
    throw new Error('Failed to add partner note')
  }
  return rowToPartner(data)
}

// ── Entity resolution ────────────────────────────────────────────────────
// PORT WITH STORAGE ADAPTATION from Living OS's resolvePartner(): the exact
// same exact -> alias -> substring matching logic, now run against one
// fetched candidate list instead of an in-memory array. This is what
// prevents a duplicate "SOHO Hospitality" from a spelling/capitalization
// variation.

export interface PartnerResolution {
  match?: Partner
  candidates: Partner[]
  ambiguous: boolean
}

export async function resolvePartner(query: string): Promise<PartnerResolution> {
  const needle = query.trim().toLowerCase()
  if (!needle) return { candidates: [], ambiguous: false }

  const all = await getPartners()
  const names = (partner: Partner) =>
    [partner.displayName, partner.legalName, ...(partner.aliases ?? [])].filter(Boolean).map((v) => (v as string).toLowerCase())

  const exact = all.filter((partner) => names(partner).includes(needle))
  if (exact.length === 1) return { match: exact[0], candidates: exact, ambiguous: false }
  if (exact.length > 1) return { candidates: exact, ambiguous: true }

  const partial = all.filter((partner) => names(partner).some((name) => name.includes(needle) || needle.includes(name)))
  if (partial.length === 1) return { match: partial[0], candidates: partial, ambiguous: false }
  return { candidates: partial, ambiguous: partial.length > 1 }
}

// ── Contacts ──────────────────────────────────────────────────────────────

export async function listPartnerContacts(partnerId: string): Promise<PartnerContact[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('partner_contacts').select('*').eq('partner_id', partnerId).order('created_at', { ascending: true })
  if (error) {
    console.error('lib/partners listPartnerContacts: query error:', error)
    return []
  }
  return (data ?? []).map(rowToContact)
}

export interface CreatePartnerContactInput {
  name: string
  titleOrRole?: string
  email?: string
  phone?: string
  notes?: string
}

export async function createPartnerContact(partnerId: string, input: CreatePartnerContactInput): Promise<PartnerContact> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('partner_contacts')
    .insert({
      partner_id: partnerId,
      name: input.name.trim(),
      title_or_role: input.titleOrRole?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error || !data) {
    console.error('lib/partners createPartnerContact: insert error:', error)
    throw new Error('Failed to create partner contact')
  }
  return rowToContact(data)
}

export interface UpdatePartnerContactPatch {
  name?: string
  titleOrRole?: string | null
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export async function updatePartnerContact(id: string, patch: UpdatePartnerContactPatch): Promise<PartnerContact> {
  const supabase = getServiceSupabase()
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.titleOrRole !== undefined) update.title_or_role = patch.titleOrRole
  if (patch.email !== undefined) update.email = patch.email
  if (patch.phone !== undefined) update.phone = patch.phone
  if (patch.notes !== undefined) update.notes = patch.notes

  const { data, error } = await supabase.from('partner_contacts').update(update).eq('id', id).select('*').single()
  if (error || !data) {
    console.error('lib/partners updatePartnerContact: update error:', error)
    throw new Error('Failed to update partner contact')
  }
  return rowToContact(data)
}

export async function deletePartnerContact(id: string): Promise<void> {
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('partner_contacts').delete().eq('id', id)
  if (error) {
    console.error('lib/partners deletePartnerContact: delete error:', error)
    throw new Error('Failed to delete partner contact')
  }
}

// ── Locations ─────────────────────────────────────────────────────────────

export async function listPartnerLocations(partnerId: string): Promise<PartnerLocation[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('partner_locations').select('*').eq('partner_id', partnerId).order('name', { ascending: true })
  if (error) {
    console.error('lib/partners listPartnerLocations: query error:', error)
    return []
  }
  return (data ?? []).map(rowToLocation)
}

export interface CreatePartnerLocationInput {
  name: string
  kind?: string
  address?: string
  notes?: string
}

export async function createPartnerLocation(partnerId: string, input: CreatePartnerLocationInput): Promise<PartnerLocation> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('partner_locations')
    .insert({
      partner_id: partnerId,
      name: input.name.trim(),
      kind: input.kind?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error || !data) {
    console.error('lib/partners createPartnerLocation: insert error:', error)
    // partner_locations_partner_name_uniq gives a clean signal for "this venue name already exists under this partner"
    throw new Error('Failed to create partner location')
  }
  return rowToLocation(data)
}

export interface UpdatePartnerLocationPatch {
  name?: string
  kind?: string | null
  address?: string | null
  notes?: string | null
}

export async function updatePartnerLocation(id: string, patch: UpdatePartnerLocationPatch): Promise<PartnerLocation> {
  const supabase = getServiceSupabase()
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name.trim()
  if (patch.kind !== undefined) update.kind = patch.kind
  if (patch.address !== undefined) update.address = patch.address
  if (patch.notes !== undefined) update.notes = patch.notes

  const { data, error } = await supabase.from('partner_locations').update(update).eq('id', id).select('*').single()
  if (error || !data) {
    console.error('lib/partners updatePartnerLocation: update error:', error)
    throw new Error('Failed to update partner location')
  }
  return rowToLocation(data)
}

/** Soft-hide/restore a venue — the retirement path a hard delete can't take (partner_deals' composite FK blocks it while referenced). */
export async function setPartnerLocationActive(id: string, isActive: boolean): Promise<PartnerLocation> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('partner_locations').update({ is_active: isActive }).eq('id', id).select('*').single()
  if (error || !data) {
    console.error('lib/partners setPartnerLocationActive: update error:', error)
    throw new Error('Failed to update partner location active state')
  }
  return rowToLocation(data)
}

// ── Deals ─────────────────────────────────────────────────────────────────

export async function listPartnerDeals(partnerId: string): Promise<PartnerDeal[]> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('partner_deals').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false })
  if (error) {
    console.error('lib/partners listPartnerDeals: query error:', error)
    return []
  }
  return (data ?? []).map(rowToDeal)
}

export async function getPartnerDeal(id: string): Promise<PartnerDeal | null> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('partner_deals').select('*').eq('id', id).maybeSingle()
  if (error) {
    console.error('lib/partners getPartnerDeal: query error:', error)
    return null
  }
  return data ? rowToDeal(data) : null
}

export interface CreatePartnerDealInput {
  locationId?: string | null
  businessContexts: string[]
  product?: string
  status?: PartnerDealStatus
  /** Omit to start from defaultDealVariables(). */
  terms?: ProposalDealVariable[]
  agreedAt?: string
  effectiveFrom?: string
  effectiveUntil?: string
  documentUrl?: string
  notes?: string
}

/**
 * Creates a Deal for a Partner. `location_id`, when supplied, is checked
 * against this partner up front as a friendly pre-check — the real
 * guarantee is partner_deals_location_partner_fkey (Phase 3C-1's composite
 * FK), which rejects the insert outright if it's ever wrong regardless of
 * this check.
 */
export async function createPartnerDeal(partnerId: string, input: CreatePartnerDealInput, actorUserId: string): Promise<PartnerDeal> {
  if (input.locationId) {
    const locations = await listPartnerLocations(partnerId)
    if (!locations.some((l) => l.id === input.locationId)) {
      throw new Error('createPartnerDeal: location does not belong to this partner')
    }
  }
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('partner_deals')
    .insert({
      partner_id: partnerId,
      location_id: input.locationId ?? null,
      business_contexts: input.businessContexts,
      product: input.product ?? null,
      status: input.status ?? 'proposed',
      terms: input.terms ?? defaultDealVariables(),
      agreed_at: input.agreedAt ?? null,
      effective_from: input.effectiveFrom ?? null,
      effective_until: input.effectiveUntil ?? null,
      document_url: input.documentUrl ?? null,
      notes: input.notes?.trim() || null,
      created_by: actorUserId,
    })
    .select('*')
    .single()
  if (error || !data) {
    console.error('lib/partners createPartnerDeal: insert error:', error)
    throw new Error('Failed to create partner deal')
  }
  return rowToDeal(data)
}

export async function updatePartnerDealTerms(id: string, terms: ProposalDealVariable[]): Promise<PartnerDeal> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('partner_deals').update({ terms }).eq('id', id).select('*').single()
  if (error || !data) {
    console.error('lib/partners updatePartnerDealTerms: update error:', error)
    throw new Error('Failed to update partner deal terms')
  }
  return rowToDeal(data)
}

/** Mark a Deal signed/informal/expired/proposed. actorUserId is recorded for parity with createPartnerDeal even though partner_deals has no per-status-change attribution column today — kept so a future audit column costs no signature change. */
export async function updatePartnerDealStatus(id: string, status: PartnerDealStatus, _actorUserId: string): Promise<PartnerDeal> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('partner_deals').update({ status }).eq('id', id).select('*').single()
  if (error || !data) {
    console.error('lib/partners updatePartnerDealStatus: update error:', error)
    throw new Error('Failed to update partner deal status')
  }
  return rowToDeal(data)
}
