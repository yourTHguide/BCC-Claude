// SNX Phase 3C-2 — ported unchanged from Living OS (sanctuary-nexus)
// src/lib/partnershipFramework.ts. Pure content module, no storage
// dependency, no schema knowledge at all — genuinely a straight port.
//
// Sanctuary Nexus Partnership Framework — Layer 1.
//
// There is ONE partnership framework for the whole ecosystem, owned centrally
// here. It carries who Sanctuary Nexus is, how it works with partners, and
// what partners can expect. Business/product specifics and commercial terms
// are Layer 2 — the dynamic deal variables a Proposal supplies at generation
// time (lib/proposals.ts's ProposalDealVariable[]).
//
// The framework is versioned. Each generated Proposal stamps
// framework_version so a later edit here never silently rewrites an old
// proposal.
//
// Living OS's legacy v1 direct-renderer (renderProposalDraft/
// RenderProposalInput, keyed off its own Partner/PartnerBusinessLink shape)
// is NOT ported here — it's dead code in Living OS's own current v2 flow,
// superseded by proposalWriter.ts's composeDeterministicDraft(), which is
// what generateProposalDraft() actually calls as its fallback. Only the
// framework data + getPartnershipFramework() (what v2 actually consumes) are
// ported.

export interface PartnershipFrameworkSection {
  heading: string
  body: string[]
}

export interface PartnershipFramework {
  version: string
  updated: string
  title: string
  intro: string
  sections: PartnershipFrameworkSection[]
}

export const PARTNERSHIP_FRAMEWORK: PartnershipFramework = {
  version: '1.0.0',
  updated: '2026-08',
  title: 'Sanctuary Nexus Partnership Framework',
  intro:
    "Sanctuary Nexus Co., Ltd. builds long-term relationships, not one-off deals. A proposal is one artifact inside a longer partnership. This framework states who we are and how we work; the specifics of any single partnership are agreed together, in the deal terms that follow.",
  sections: [
    {
      heading: 'Who Sanctuary Nexus is',
      body: [
        'Sanctuary Nexus is the operating ecosystem behind a family of experience ventures — beginning with Best Nightlife Thailand and its Bangkok Club Crawl. We observe demand across the ecosystem, and route the right people to the right experience at the right time.',
        "We own the relationship with our members and audience; our ventures execute the experiences. A partner plugs into a living audience, not a cold list.",
      ],
    },
    {
      heading: 'Our partnership philosophy',
      body: [
        "Relationships before transactions. We invest in understanding a partner's room, brand and goals before proposing anything.",
        'Community before products. We bring an engaged community to a venue and design experiences the community actually wants.',
        "Route, don't overwhelm. We send the right guests, on the right nights, in a way that protects a venue's atmosphere and standards.",
      ],
    },
    {
      heading: 'How we work together',
      body: [
        'One point of contact and one clear owner on our side for the relationship.',
        'Clear, written terms before anything goes live — nothing important is left to memory.',
        'A regular review rhythm so the partnership keeps improving instead of drifting.',
      ],
    },
    {
      heading: 'What partners can expect',
      body: [
        'Qualified, well-briefed guests who respect the room.',
        "Co-created promotion that reflects the partner's brand, not just ours.",
        'Honest reporting on what worked, and a standing invitation to shape what comes next.',
      ],
    },
  ],
}

export function getPartnershipFramework(): PartnershipFramework {
  return {
    ...PARTNERSHIP_FRAMEWORK,
    sections: PARTNERSHIP_FRAMEWORK.sections.map((section) => ({ ...section, body: [...section.body] })),
  }
}
