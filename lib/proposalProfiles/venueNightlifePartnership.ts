// SNX Phase 4 — first Proposal Profile: Venue / Nightlife Partnership.
//
// A Proposal Profile is a purely application-level concept (no DB enum —
// see proposals.product_profile_version, a plain TEXT column that every
// caller in lib/proposals.ts previously wrote as null). It is the thing
// composeDeterministicDraft()'s own header anticipated but that never got
// built: "No Product Profile registry exists in this repo yet... callers may
// pass one later once such a registry exists." This file is that registry's
// first entry.
//
// Reference implementation: the real SOHO Hospitality Group × Bangkok Club
// Crawl partnership proposal PDF (10 August 2026). Its structure, term set,
// and language are generalized here — nothing below is hardcoded to SOHO or
// to Bangkok Club Crawl specifically; the section order, deal-variable
// template, and composed copy apply to any venue/nightlife partnership, and
// "About the Experience" content is looked up per-product (see
// NIGHTLIFE_PRODUCT_CONTENT) so a different product (BEST Nightlife, a
// future New in Bangkok / Single Meet Club entry, or an unrecognized one)
// renders its own accurate description instead of borrowing BCC's.
//
// Deliberately separate from lib/proposalWriter.ts's composeDeterministicDraft
// (the pre-existing generic fallback composer) and from lib/proposalGeneration.ts
// (the AI/deterministic orchestration boundary) — neither file is modified by
// this profile. lib/proposals.ts resolves a profile via resolveProposalProfile()
// and, when one applies, calls composeVenueNightlifePartnershipDraft() directly
// instead of generateProposalDraft(); when no profile applies (defensive
// fallback — unreachable today, since this is the only profile and it
// resolves for every non-empty businessContexts array) the existing generic
// path is untouched.

import type { ProposalWriterInputs, ProductProfile } from '@/lib/proposalWriter'
import type { ProposalDealVariable } from '@/lib/dealVariables'
import { humanizeBusinessContexts } from '@/lib/operator/businessContexts'

export const VENUE_NIGHTLIFE_PARTNERSHIP_PROFILE_KEY = 'venue-nightlife-partnership'
export const VENUE_NIGHTLIFE_PARTNERSHIP_PROFILE_VERSION = '1.0.0'

// ── Deal Variables — nightlife term set (locked) ───────────────────────────
//
// Unlike lib/dealVariables.ts's defaultDealVariables() (every value blank —
// "must never be invented"), the nightlife profile's STANDARD terms ship
// with real default values: these are Sanctuary Nexus's own standing
// operating terms, not invented facts about a specific partner, so showing
// them by default (still fully editable) is correct here. The OPTIONAL
// commercial terms below stay blank by design — they're venue-specific and
// must never be pre-filled with a typical range.

export function nightlifeDealVariables(): ProposalDealVariable[] {
  return [
    { key: 'guest-entry', label: 'Guest entry', value: 'Free entry for our guests' },
    { key: 'welcome-benefit', label: 'Guest welcome benefit', value: '1 welcome shot per guest' },
    { key: 'host-benefit', label: 'Host benefit', value: '1 complimentary drink per host' },
    { key: 'minimum-guest-purchase', label: 'Minimum guest purchase', value: 'Minimum 1 drink per guest' },
    { key: 'minimum-group-size', label: 'Minimum group size', value: '5 guests' },
    { key: 'venue-stay-duration', label: 'Venue stay duration', value: 'Approximately 1–1.5 hours per venue for moving/route-based events' },
    { key: 'review-cadence', label: 'Review cadence', value: 'Monthly' },
    { key: 'contract-period', label: 'Contract period', value: 'Ongoing' },
    { key: 'exclusivity', label: 'Exclusivity', value: 'Non-exclusive unless separately agreed' },
    // Optional — venue-specific, intentionally blank until agreed.
    { key: 'commission', label: 'Commission / revenue share' },
    { key: 'guest-bill-discount', label: 'Guest bill discount' },
    { key: 'bottle-service-commission', label: 'Bottle-service commission' },
    { key: 'operating-rules', label: 'Operating rules' },
  ]
}

// ── Product content seam ────────────────────────────────────────────────
//
// "About the Experience" must describe the actual product being discussed,
// not be hardcoded to one. Keyed by business-context slug (the same slugs
// KNOWN_BUSINESS_CONTEXTS/ProposalSetupClient already use) so it stays in
// sync with whatever the operator selected in Step 2. A context with no
// entry here (or a future product not yet added) falls back to
// genericNightlifeProductContent() rather than silently borrowing another
// product's description.

interface NightlifeProductContent {
  whatItIs: string
  targetAudience: string
  operatingModel: string
  whatWeBringToVenues: string[]
}

const NIGHTLIFE_PRODUCT_CONTENT: Record<string, NightlifeProductContent> = {
  'bkk-club-crawl': {
    whatItIs:
      'Bangkok Club Crawl is a hosted nightlife experience operated by Best Nightlife Thailand. Guests join a planned route and move through selected venues with a local host who manages timing, group flow, and the guest experience throughout the night.',
    targetAudience:
      'Travellers, expats, solo guests, couples, and small groups who want a social night out without arriving cold at each venue.',
    operatingModel:
      'A Bangkok Club Crawl host remains responsible for guiding the group, managing timing, and helping guests move between venues smoothly.',
    whatWeBringToVenues: [
      'Hosted guest groups managed by a local Bangkok Club Crawl host',
      'A planned nightlife route that can include multiple partner venues',
      'Guests who are briefed before arrival and guided through the night',
      'Additional venue visits from crawl guests',
      'A clear point of coordination from the Bangkok Club Crawl side',
      'Monthly review so both sides can adjust based on real performance',
    ],
  },
  'best-nightlife': {
    whatItIs:
      'Best Nightlife Thailand curates and hosts nightlife experiences for travellers, expats, and locals across Bangkok, connecting guests with venues that fit the night they are looking for.',
    targetAudience:
      'Travellers, expats, and locals looking for a curated, well-organised night out rather than a cold walk-in.',
    operatingModel:
      'A Best Nightlife Thailand host or coordinator remains the point of contact for the group, managing timing and guest experience.',
    whatWeBringToVenues: [
      'Hosted or referred guests briefed before arrival',
      'A clear point of coordination from the Best Nightlife Thailand side',
      'Guests guided toward the venue as part of a planned night',
      'Regular review so both sides can adjust based on real performance',
    ],
  },
}

function genericNightlifeProductContent(label: string): NightlifeProductContent {
  return {
    whatItIs: `${label} is a hosted nightlife experience. Guests join a planned night out and move through selected venues with a local host who manages timing, group flow, and the guest experience throughout the night.`,
    targetAudience:
      'Travellers, expats, solo guests, couples, and small groups who want a social night out without arriving cold at each venue.',
    operatingModel: `A ${label} host remains responsible for guiding the group, managing timing, and helping guests move between venues smoothly.`,
    whatWeBringToVenues: [
      'Hosted guest groups managed by a local host',
      'A planned route that can include multiple partner venues',
      'Guests who are briefed before arrival and guided through the night',
      'Additional venue visits from hosted guests',
      'A clear point of coordination from our side',
      'Monthly review so both sides can adjust based on real performance',
    ],
  }
}

function productLabel(businessContexts: string[], product?: string): string {
  if (product?.trim()) return product.trim()
  return humanizeBusinessContexts(businessContexts) || 'This partnership'
}

/** Builds the ProductProfile the nightlife composer reads. businessContexts drives which product content is used — free-text `product` only affects display labels, never which "About the Experience" copy loads. */
export function buildNightlifeProductProfile(businessContexts: string[], product?: string): ProductProfile {
  const label = productLabel(businessContexts, product)
  const content = businessContexts.map((c) => NIGHTLIFE_PRODUCT_CONTENT[c]).find(Boolean) ?? genericNightlifeProductContent(label)
  return {
    version: VENUE_NIGHTLIFE_PARTNERSHIP_PROFILE_VERSION,
    product: label,
    whatItIs: content.whatItIs,
    targetAudience: content.targetAudience,
    positioning: content.whatItIs,
    operatingModel: content.operatingModel,
    typicalGroupProfile: content.operatingModel,
    whatWeBringToVenues: content.whatWeBringToVenues,
  }
}

export interface ResolvedProposalProfile {
  key: string
  productProfile: ProductProfile
}

/**
 * Selects which Proposal Profile applies. Today venue-nightlife-partnership
 * is the only one that exists (Phase 4 scope: "Build only Venue / Nightlife
 * Partnership V1"), so every proposal with at least one business context
 * resolves to it. When a second profile is built later, this function
 * becomes the real selection point (e.g. branching on businessContexts or an
 * explicit profile field) instead of every caller deciding for itself.
 */
export function resolveProposalProfile(businessContexts: string[], product?: string): ResolvedProposalProfile | null {
  if (businessContexts.length === 0) return null
  return {
    key: VENUE_NIGHTLIFE_PARTNERSHIP_PROFILE_KEY,
    productProfile: buildNightlifeProductProfile(businessContexts, product),
  }
}

// ── Composer ────────────────────────────────────────────────────────────
//
// Locked section order (Phase 4 handoff, matching the SOHO × BCC reference
// PDF): Cover -> Partnership Opportunity -> About the Experience ->
// Proposed Collaboration -> What We Bring -> Group Flow / Operating Model ->
// Commercial & Partnership Terms -> Monthly Review -> Next Steps.
//
// Term rendering rule: a populated term (default or operator-entered) shows;
// a blank OPTIONAL term is omitted entirely — no "TBD" filler rows. This is
// the opposite of proposalWriter.ts's composeDeterministicDraft(), which
// always renders every deal variable with a TBD placeholder — that
// composer is untouched; this is a deliberately different, profile-specific
// rendering rule, not a bug relative to it.

function businessLabel(businessContexts: string[]): string {
  return humanizeBusinessContexts(businessContexts) || 'Sanctuary Nexus'
}

/** "A" / "A and B" / "A, B, and C" — reads naturally in prose, unlike a bare comma join. */
function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

export function composeVenueNightlifePartnershipDraft(inputs: ProposalWriterInputs): string {
  const { productProfile, partnerDisplayName, businessContexts, product, venues, dealVariables } = inputs
  const label = businessLabel(businessContexts)
  const productLine = product ? `${label} — ${product}` : label
  const aboutHeading = product ?? label
  const lines: string[] = []

  // Cover
  lines.push(`# Partnership Proposal — ${partnerDisplayName}`)
  lines.push('')
  lines.push(`**For:** ${productLine}  `)
  lines.push(`**Prepared by:** Sanctuary Nexus Co., Ltd.  `)
  lines.push(`**Date:** ${inputs.proposalDate.slice(0, 10)}  `)
  if (inputs.version != null) lines.push(`**Version:** v${inputs.version}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Partnership opportunity
  lines.push('## Partnership opportunity')
  lines.push('')
  lines.push(
    `${label} would like to formalize a practical venue partnership with ${partnerDisplayName}` +
      (venues.length ? `, beginning with selected nights across ${joinWithAnd(venues)}.` : '.') +
      ` ${label} brings hosted guests through partner venues as part of a planned nightlife route, while ${partnerDisplayName} gains additional guest visits on agreed nights.`
  )
  lines.push('')
  lines.push('The partnership should remain flexible, easy to operate, and reviewed regularly based on actual group flow, venue feedback, and route performance.')
  lines.push('')

  // About the Experience
  if (productProfile) {
    lines.push(`## About ${aboutHeading}`)
    lines.push('')
    lines.push(productProfile.whatItIs)
    lines.push('')
    lines.push(`**Who we bring:** ${productProfile.targetAudience}`)
    lines.push('')
  }

  // Proposed collaboration
  lines.push('## Proposed collaboration')
  lines.push('')
  if (venues.length) {
    lines.push(`We propose including selected ${partnerDisplayName} venues as part of ${label} routes, starting with:`)
    lines.push('')
    for (const venue of venues) lines.push(`- ${venue}`)
    lines.push('')
  } else {
    lines.push(`We propose including ${partnerDisplayName} as part of ${label} routes.`)
    lines.push('')
  }
  lines.push(
    `${label} may bring guests to ${partnerDisplayName} on more than one visit in a night, depending on the route, timing, guest profile, and what works best operationally for the venue. This should begin as a clear working partnership: confirm the terms, test selected nights, review the real results, and improve from there.`
  )
  lines.push('')

  // What we bring
  if (productProfile) {
    lines.push('## What we bring')
    lines.push('')
    for (const item of productProfile.whatWeBringToVenues) lines.push(`- ${item}`)
    lines.push('')
    lines.push(
      `${label} does not guarantee traffic. Attendance depends on confirmed bookings, seasonality, date, weather, marketing performance, and normal nightlife demand.`
    )
    lines.push('')
  }

  // Group flow / operating model
  if (productProfile) {
    lines.push('## Group flow & operating model')
    lines.push('')
    lines.push(productProfile.operatingModel)
    lines.push('')
    lines.push('The venue team should not need to manage the group beyond normal guest service and any agreed entry or drink arrangements.')
    lines.push('')
  }

  // Commercial & partnership terms — populated terms only, no TBD filler.
  lines.push('## Commercial & partnership terms')
  lines.push('')
  const populated = dealVariables.filter((v) => v.value?.trim())
  if (populated.length === 0) {
    lines.push('_Terms to be agreed together._')
  } else {
    for (const variable of populated) lines.push(`- **${variable.label}:** ${variable.value!.trim()}`)
    lines.push('')
    lines.push('Any term not listed above should be treated as not yet agreed.')
  }
  lines.push('')

  // Monthly review
  lines.push('## Monthly review')
  lines.push('')
  lines.push('We recommend a regular review during the early partnership period, covering:')
  lines.push('')
  lines.push(`- Number of nights/events involving ${partnerDisplayName}'s venues`)
  lines.push('- Headcount and group flow')
  lines.push('- Timing and route fit')
  lines.push('- Venue feedback')
  lines.push('- Host feedback')
  lines.push('- Guest behaviour and operational fit')
  lines.push('- Commercial performance where measurable')
  lines.push('- Any changes needed to terms, timing, or operating rules')
  lines.push('')
  lines.push('This keeps the partnership grounded in actual performance rather than assumptions.')
  lines.push('')

  // Next steps
  lines.push('## Next steps')
  lines.push('')
  lines.push(
    `Upon confirming the terms above, both teams can begin with selected nights and review performance on the agreed cadence. We're happy to refine the final details together so this works clearly for ${partnerDisplayName}, ${label}, and the guests moving through the venues.`
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('_This is a working proposal. Nothing here is a binding commitment until agreed in writing by both parties._')
  lines.push('')

  return lines.join('\n')
}
