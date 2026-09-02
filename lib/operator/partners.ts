import 'server-only'

// SNX Phase 3C-2 — operator read shapes for the (not-yet-built) Partner
// Directory and Partner Profile screens. Server-only reads, same pattern as
// lib/operator/products.ts/eventOps.ts: getServiceSupabase() directly, never
// from a 'use client' file. No pages exist yet (Phase 3D+) — these are pure
// read functions, callable and testable in isolation today.

import { getServiceSupabase } from '@/lib/supabase'
import { getPartner, listPartnerDeals, type Partner, type PartnerDeal, type RelationshipStatus } from '@/lib/partners'
import { proposalsForPartner, type Proposal } from '@/lib/proposals'

export interface PartnerListRow {
  id: string
  displayName: string
  relationshipStatus: RelationshipStatus
  organizationType: string | null
  /** Distinct business contexts touched by this partner's deals — derived, not stored (Phase 3B §5/§10: no brand-link table). */
  businessContexts: string[]
  locationCount: number
  createdAt: string
  updatedAt: string
}

/** List-row shape for the Partner Directory screen: search/filter over partners, with a derived business-context summary and location count in two queries total (not N+1). */
export async function getPartnersListForOperator(filter?: { status?: RelationshipStatus; search?: string }): Promise<PartnerListRow[]> {
  const supabase = getServiceSupabase()
  let query = supabase
    .from('partners')
    .select('id, display_name, relationship_status, organization_type, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (filter?.status) query = query.eq('relationship_status', filter.status)
  if (filter?.search?.trim()) query = query.ilike('display_name', `%${filter.search.trim()}%`)

  const { data: partnerRows, error } = await query
  if (error || !partnerRows) {
    if (error) console.error('lib/operator/partners getPartnersListForOperator: query error:', error)
    return []
  }
  const ids = partnerRows.map((p: any) => p.id)
  if (ids.length === 0) return []

  const [{ data: dealRows }, { data: locationRows }] = await Promise.all([
    supabase.from('partner_deals').select('partner_id, business_contexts').in('partner_id', ids),
    supabase.from('partner_locations').select('partner_id').eq('is_active', true).in('partner_id', ids),
  ])

  const contextsByPartner = new Map<string, Set<string>>()
  for (const row of dealRows ?? []) {
    const set = contextsByPartner.get((row as any).partner_id) ?? new Set<string>()
    for (const ctx of (row as any).business_contexts ?? []) set.add(ctx)
    contextsByPartner.set((row as any).partner_id, set)
  }
  const locationCountByPartner = new Map<string, number>()
  for (const row of locationRows ?? []) {
    const pid = (row as any).partner_id
    locationCountByPartner.set(pid, (locationCountByPartner.get(pid) ?? 0) + 1)
  }

  return partnerRows.map((row: any) => ({
    id: row.id,
    displayName: row.display_name,
    relationshipStatus: row.relationship_status,
    organizationType: row.organization_type,
    businessContexts: Array.from(contextsByPartner.get(row.id) ?? []),
    locationCount: locationCountByPartner.get(row.id) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export interface PartnerProfileForOperator {
  partner: Partner
  /** Resolved from admin_users.display_name when relationship_owner is set and resolvable; null otherwise (never shows a raw UUID to the operator). */
  relationshipOwnerName: string | null
  deals: PartnerDeal[]
  /** Every Working Draft and Finalized Version across every proposal "line" for this partner, newest first. */
  proposals: Proposal[]
}

/** The full aggregated shape the Partner Profile screen needs, in one call: partner + contacts + locations + deals + full proposal history. */
export async function getPartnerProfileForOperator(id: string): Promise<PartnerProfileForOperator | null> {
  const [partner, deals, proposals] = await Promise.all([getPartner(id), listPartnerDeals(id), proposalsForPartner(id)])
  if (!partner) return null

  let relationshipOwnerName: string | null = null
  if (partner.relationshipOwner) {
    const supabase = getServiceSupabase()
    const { data } = await supabase.from('admin_users').select('display_name').eq('user_id', partner.relationshipOwner).maybeSingle()
    relationshipOwnerName = (data as any)?.display_name ?? null
  }

  return { partner, relationshipOwnerName, deals, proposals }
}
