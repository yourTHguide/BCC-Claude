// SNX Phase 3C-2 — ported from Living OS (sanctuary-nexus)
// src/lib/proposalWriter.ts. Pure functions, no storage/network dependency —
// "PORT UNCHANGED" per the Phase 3C plan, with one necessary typing
// adaptation: Living OS's single `business`/`businessLabel` (one venture per
// proposal) is replaced with this repo's `businessContexts: string[]`
// (Phase 3B §5 — a proposal can carry one or more SNX business/venture
// context tags at once). Every prompt/composer function that referenced
// businessLabel now joins businessContexts for display. No other logic
// changed.
//
// Proposal Writer — turns four structured inputs into an external business
// proposal:
//   1. SNX Partnership Framework     (who we are / philosophy)
//   2. SNX Proposal Writing Standard (tone / rules)
//   3. Product Profile               (the product's reusable facts, optional)
//   4. Partner + Deal Context        (this specific proposal)
//
// Exposes prompt builders for genuine model drafting/revision (unused until
// a hosted AI provider is connected — see lib/proposalGeneration.ts), and a
// high-quality deterministic composer used as the ONLY reachable path in
// Phase 3C-2. Both preserve the partner's exact commercial figures and never
// invent missing information (unknowns stay TBD). Pure + client-safe.
//
// Second adaptation, caused by this repo's corrected Draft/Finalized
// proposal lifecycle: `version` is now `number | null` (Living OS's Proposal
// always had a real version number the moment it existed, so this field was
// always a number). A Working Draft has no formal version yet — the
// composed content must never claim one prematurely, so both prompt/composer
// functions below omit the "Version: vN" line entirely when `version` is
// null, and only stamp a real version number into rendered content once a
// row is actually finalized.

import type { PartnershipFramework } from '@/lib/partnershipFramework'
import type { ProposalWritingStandard } from '@/lib/proposalWritingStandard'
import type { ProposalDealVariable } from '@/lib/proposals'

// No Product Profile registry exists in this repo yet (Living OS's
// productProfiles.ts is a reusable-knowledge module scoped to its own
// ventures, not ported here — out of scope for Phase 3C-2, not mentioned in
// the implementation plan). This is the minimal shape proposalWriter.ts
// actually reads; callers may pass one later once such a registry exists —
// today every caller in this repo passes `undefined`.
export interface ProductProfile {
  version: string
  product: string
  whatItIs: string
  targetAudience: string
  positioning: string
  operatingModel: string
  typicalGroupProfile: string
  whatWeBringToVenues: string[]
}

export interface ProposalWriterInputs {
  framework: PartnershipFramework
  writingStandard: ProposalWritingStandard
  productProfile?: ProductProfile
  partnerDisplayName: string
  businessContexts: string[]
  product?: string
  venues: string[]
  relationshipSummary?: string
  dealVariables: ProposalDealVariable[]
  contextForProposal?: string
  writingDirection?: string
  /** null = still a Working Draft, no formal version exists yet — composed content must not claim one. */
  version: number | null
  proposalDate: string
}

const TBD = 'To be confirmed'

function businessLabel(businessContexts: string[]): string {
  return businessContexts.length ? businessContexts.join(' / ') : 'Sanctuary Nexus'
}

function dealVariableLines(dealVariables: ProposalDealVariable[]): string {
  if (dealVariables.length === 0) return '- (none entered)'
  return dealVariables
    .map((variable) => `- ${variable.label}: ${variable.value?.trim() ? variable.value.trim() : `${TBD} (TBD)`}`)
    .join('\n')
}

/** The structured, factual context block shared by drafting and revision prompts. */
export function buildInputContextBlock(inputs: ProposalWriterInputs): string {
  const { framework, productProfile, partnerDisplayName, businessContexts, product, venues, relationshipSummary } = inputs
  const lines: string[] = []

  lines.push('### Sanctuary Nexus Partnership Framework (internal — translate, do not paste verbatim)')
  lines.push(framework.intro)
  for (const section of framework.sections) lines.push(`${section.heading}: ${section.body.join(' ')}`)
  lines.push('')

  if (productProfile) {
    lines.push(`### Product Profile — ${productProfile.product} (facts, reusable)`)
    lines.push(`What it is: ${productProfile.whatItIs}`)
    lines.push(`Target audience: ${productProfile.targetAudience}`)
    lines.push(`Positioning: ${productProfile.positioning}`)
    lines.push(`Operating model: ${productProfile.operatingModel}`)
    lines.push(`Typical group profile: ${productProfile.typicalGroupProfile}`)
    lines.push(`What we bring to venues: ${productProfile.whatWeBringToVenues.join('; ')}`)
    lines.push('')
  }

  lines.push('### Partner + Deal Context (specific to THIS proposal)')
  lines.push(`Partner: ${partnerDisplayName}`)
  lines.push(`Business / product: ${businessLabel(businessContexts)}${product ? ` — ${product}` : ''}`)
  if (venues.length) lines.push(`Venues in scope: ${venues.join(', ')}`)
  if (relationshipSummary) lines.push(`Relationship so far: ${relationshipSummary}`)
  lines.push('Commercial terms (use these EXACT figures; do not alter or invent; keep TBD where TBD):')
  lines.push(dealVariableLines(inputs.dealVariables))
  if (inputs.contextForProposal?.trim()) {
    lines.push('')
    lines.push('Context for proposal (interpret into external business language; do NOT copy verbatim):')
    lines.push(inputs.contextForProposal.trim())
  }
  return lines.join('\n')
}

export function buildProposalSystemPrompt(inputs: ProposalWriterInputs): string {
  const { writingStandard, writingDirection } = inputs
  return [
    'You are the Sanctuary Nexus Proposal Writer. Write a polished EXTERNAL partnership proposal that can be sent directly to the partner\'s executive — not internal notes.',
    '',
    'Writing standard (default tone):',
    writingStandard.defaultDirection.map((line) => `- ${line}`).join('\n'),
    '',
    'Avoid:',
    writingStandard.avoid.map((line) => `- ${line}`).join('\n'),
    '',
    'Principles:',
    writingStandard.principles.map((line) => `- ${line}`).join('\n'),
    '',
    `Structure the proposal roughly in this priority order (use Markdown headings): ${writingStandard.structure.join(' → ')}.`,
    '',
    'Hard rules:',
    '- Use the partner\'s exact commercial figures. Never change, round, or invent numbers or terms.',
    '- Where a term is marked TBD / To be confirmed, keep it explicitly as \'To be confirmed\'. Never fabricate it.',
    '- Translate internal Sanctuary Nexus philosophy into external business language; never paste it verbatim.',
    '- Interpret the \'Context for proposal\' to shape tone and emphasis; do not copy it in verbatim.',
    '- Be concise and scannable. Output Markdown only — no preamble, no explanation of what you did.',
    writingDirection?.trim() ? `\nAdditional writing direction from the user (lightly overrides the default tone): ${writingDirection.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildProposalUserPrompt(inputs: ProposalWriterInputs): string {
  const versionLabel = inputs.version != null ? `version ${inputs.version}` : 'a working draft'
  return [
    `Write ${versionLabel} of the partnership proposal for ${inputs.partnerDisplayName}. Date: ${inputs.proposalDate.slice(0, 10)}.`,
    '',
    buildInputContextBlock(inputs),
    '',
    'Now write the full external proposal in Markdown.',
  ].join('\n')
}

export function buildRevisionSystemPrompt(inputs: ProposalWriterInputs): string {
  return [
    'You are the Sanctuary Nexus Proposal Writer revising an EXISTING external proposal.',
    'Apply ONLY the requested change. Preserve all unaffected sections and wording as-is.',
    'Do not change any commercial figure or term unless the instruction explicitly says to.',
    'Never invent facts. Keep anything marked \'To be confirmed\' as-is unless told otherwise.',
    'Return the full revised proposal in Markdown only — no commentary.',
    '',
    'For reference, the underlying inputs are:',
    buildInputContextBlock(inputs),
  ].join('\n')
}

export function buildRevisionUserPrompt(currentDraft: string, instruction: string): string {
  return [
    'Current proposal draft:',
    '---',
    currentDraft,
    '---',
    '',
    `Requested change: ${instruction}`,
    '',
    'Return the full revised proposal.',
  ].join('\n')
}

/** Extract the model's text content from an OpenAI-compatible completion response. */
export function extractCompletionContent(data: unknown): string {
  if (typeof data === 'string') return data
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>
  if (typeof record.content === 'string') return record.content
  const choices = record.choices
  if (!Array.isArray(choices)) return ''
  return choices
    .map((choice) => {
      if (!choice || typeof choice !== 'object') return ''
      const c = choice as Record<string, unknown>
      const message = c.message
      if (message && typeof message === 'object' && typeof (message as Record<string, unknown>).content === 'string') {
        return (message as Record<string, string>).content
      }
      return typeof c.text === 'string' ? c.text : ''
    })
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Deterministic fallback composer — a genuinely sendable external proposal
 * when no AI provider is configured/available. Not a verbatim dump of the
 * framework: it composes concise external prose from the product profile +
 * framework and lays out the partner's exact commercial terms.
 */
export function composeDeterministicDraft(inputs: ProposalWriterInputs): string {
  const { productProfile, partnerDisplayName, businessContexts, product, venues, dealVariables } = inputs
  const label = businessLabel(businessContexts)
  const productLine = product ? `${label} — ${product}` : label
  const lines: string[] = []

  lines.push(`# Partnership Proposal — ${partnerDisplayName}`)
  lines.push('')
  lines.push(`**For:** ${productLine}  `)
  lines.push(`**Prepared by:** Sanctuary Nexus Co., Ltd.  `)
  lines.push(`**Date:** ${inputs.proposalDate.slice(0, 10)}  `)
  if (inputs.version != null) lines.push(`**Version:** v${inputs.version}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## Partnership opportunity')
  lines.push('')
  lines.push(
    `We'd love to formalise a partnership between ${partnerDisplayName} and ${productLine}. ` +
      (inputs.relationshipSummary ? `${inputs.relationshipSummary} ` : '') +
      "This proposal sets out how we'd work together and the terms we've discussed."
  )
  lines.push('')

  if (productProfile) {
    lines.push(`## About ${product ?? label}`)
    lines.push('')
    lines.push(productProfile.whatItIs)
    lines.push('')
    lines.push(`**Who we bring:** ${productProfile.targetAudience}`)
    lines.push('')
    lines.push(`**How it works:** ${productProfile.operatingModel}`)
    lines.push('')
    lines.push('## What we bring to your venues')
    lines.push('')
    for (const item of productProfile.whatWeBringToVenues) lines.push(`- ${item}`)
    lines.push('')
  } else {
    lines.push('## About Sanctuary Nexus')
    lines.push('')
    lines.push(inputs.framework.intro)
    lines.push('')
  }

  lines.push('## Proposed collaboration')
  lines.push('')
  if (venues.length) {
    lines.push(`We'd route our hosted guests across your venues — ${venues.join(', ')} — as part of the night.`)
  } else {
    lines.push("We'd route our hosted guests to your venue as part of the night.")
  }
  lines.push('')

  lines.push('## Commercial & partnership terms')
  lines.push('')
  if (dealVariables.length === 0) {
    lines.push('_Terms to be agreed together._')
  } else {
    for (const variable of dealVariables) {
      const value = variable.value?.trim()
      lines.push(`- **${variable.label}:** ${value ? value : `${TBD} *(TBD)*`}`)
    }
  }
  lines.push('')

  const open = dealVariables.filter((variable) => !variable.value?.trim())
  if (open.length > 0) {
    lines.push('### To confirm together')
    lines.push('')
    for (const variable of open) lines.push(`- ${variable.label} — ${TBD}`)
    lines.push('')
  }

  if (productProfile) {
    lines.push('## Operating model')
    lines.push('')
    lines.push(productProfile.typicalGroupProfile)
    lines.push('')
  }

  lines.push('## Review & next steps')
  lines.push('')
  lines.push(
    "We'd propose confirming the open terms above, agreeing a start, and setting a simple review rhythm so the partnership keeps improving. We're glad to adjust anything here to fit how you like to work."
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('_This is a working proposal. Nothing here is a binding commitment until agreed in writing by both parties._')
  lines.push('')

  return lines.join('\n')
}
