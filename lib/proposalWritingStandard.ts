// SNX Phase 3C-2 — ported unchanged from Living OS (sanctuary-nexus)
// src/lib/proposalWritingStandard.ts. Pure content module.
//
// Sanctuary Nexus Proposal Writing Standard — centrally owned, versioned.
//
// This is the reusable writing/tone standard the Proposal Writer follows for
// EVERY external proposal: how proposals should sound, what to avoid, how to
// handle unknowns, and how to translate internal SNX philosophy into external
// business language.
//
// Each generated proposal stamps writing_standard_version; bump `version`
// here if the standard itself changes.

export interface ProposalWritingStandard {
  version: string
  defaultDirection: string[]
  avoid: string[]
  principles: string[]
  /** Priority order the external proposal should follow. */
  structure: string[]
}

export const PROPOSAL_WRITING_STANDARD: ProposalWritingStandard = {
  version: '1.0.0',
  defaultDirection: [
    'Professional, confident, warm, and collaborative.',
    'Commercially intelligent and concise.',
    'Relationship-oriented; premium but not corporate-stiff.',
    'Human rather than AI-generated; confident without overselling.',
  ],
  avoid: [
    'generic marketing language',
    'exaggerated or unsubstantiated claims',
    'unnecessary philosophy or internal jargon',
    'corporate jargon and aggressive sales language',
    'repetition',
    'invented facts, results, or commercial terms',
  ],
  principles: [
    'Lead with the partnership opportunity.',
    'Make partner value clear.',
    'Use concrete business language.',
    'Translate internal SNX philosophy into appropriate external language — do not paste it verbatim.',
    'Keep sections scannable.',
    "Make commercial terms precise, using the partner's own figures exactly.",
    'Never invent missing information — preserve TBD where information is unknown.',
  ],
  structure: [
    'Partnership Opportunity',
    'About Sanctuary Nexus / the relevant business',
    'About the product',
    'Proposed Collaboration',
    'What We Bring',
    'Partner Benefits',
    'Commercial / Partnership Terms',
    'Operating Model',
    'Review & Next Steps',
  ],
}

export function getProposalWritingStandard(): ProposalWritingStandard {
  return {
    ...PROPOSAL_WRITING_STANDARD,
    defaultDirection: [...PROPOSAL_WRITING_STANDARD.defaultDirection],
    avoid: [...PROPOSAL_WRITING_STANDARD.avoid],
    principles: [...PROPOSAL_WRITING_STANDARD.principles],
    structure: [...PROPOSAL_WRITING_STANDARD.structure],
  }
}
