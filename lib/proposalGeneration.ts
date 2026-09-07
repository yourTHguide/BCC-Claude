import 'server-only'

// SNX Phase 3C-2 — adapted from Living OS (sanctuary-nexus)
// src/lib/server/proposalGeneration.ts. "PORT WITH ADAPTATION" per the
// Phase 3C plan: the orchestration SHAPE (generateProposalDraft/
// reviseProposalDraft returning {content, mode, note?}) is preserved
// exactly, but per this phase's explicit instruction, NO hosted AI
// transport client is implemented and NO network call is ever attempted —
// the reachable production path returns the proven deterministic fallback
// immediately. No AI SDK, no new env variable, no `hermes/api.ts`-style
// HTTP client exists in this repo yet.
//
// When a real provider is chosen later, the only change needed here is
// re-adding a try/callModel/catch around the deterministic fallback (as
// Living OS's original does) — this function's signature, return shape, and
// every caller stay exactly as they are today. That is the concrete proof
// the AI-provider decision was never a blocker to this foundation.

import {
  buildProposalUserPrompt,
  composeDeterministicDraft,
  type ProposalWriterInputs,
} from '@/lib/proposalWriter'
import type { ProposalWriterMode } from '@/lib/proposals'

export interface DraftResult {
  content: string
  mode: ProposalWriterMode
  note?: string
}

/**
 * Prepare a fresh draft. Phase 3C-2: deterministic only, always — see file
 * header. `buildProposalUserPrompt` is referenced (not called) here only to
 * keep it a live import for when a transport client is added; it is not
 * invoked without a provider to send it to.
 */
export async function generateProposalDraft(inputs: ProposalWriterInputs): Promise<DraftResult> {
  void buildProposalUserPrompt // keeps the prompt builder a live, type-checked import; unused until a provider exists
  return {
    content: composeDeterministicDraft(inputs),
    mode: 'deterministic',
  }
}

/**
 * Apply a natural-language revision to an existing draft (Request Changes).
 * Phase 3C-2: no deterministic revision logic exists (Living OS itself has
 * none either — a revision genuinely requires a model). With no provider
 * configured, the draft is left unchanged with an explanatory note, exactly
 * matching Living OS's own "model unavailable" fallback behavior for this
 * specific action.
 */
export async function reviseProposalDraft(
  _inputs: ProposalWriterInputs,
  currentDraft: string,
  _instruction: string
): Promise<DraftResult> {
  return {
    content: currentDraft,
    mode: 'deterministic',
    note: 'No AI provider is configured in this environment; draft left unchanged. Edit the draft directly instead.',
  }
}
