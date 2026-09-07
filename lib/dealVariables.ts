// SNX Phase 3C-2, extracted Phase 3F — the ProposalDealVariable shape and
// its pure helper functions, split out of lib/proposals.ts specifically so
// a client component can use them. lib/proposals.ts starts with
// `import 'server-only'`, which poisons the *entire* module for client
// bundling — even though these particular functions are genuinely pure
// (no DB, no fetch, no server-only dependency at all; PORT UNCHANGED from
// Living OS's src/lib/proposals.ts). ProposalSetupClient.tsx's Step 2 (the
// real Deal workspace, Phase 3F) needs defaultDealVariables() to seed its
// own commercial-terms inputs client-side, which is what forced this split.
//
// lib/proposals.ts re-exports everything from here unchanged, so every
// existing server-side `from '@/lib/proposals'` import keeps working
// without modification — this file is the new canonical home, not a
// parallel copy.

/**
 * A single dynamic deal variable. Unknown commercial terms stay visible as
 * TBD. The exact shape `partner_deals.terms` and `proposals.deal_terms_snapshot`
 * both store as JSONB.
 */
export interface ProposalDealVariable {
  key: string
  label: string
  value?: string
  /** Whether this variable is required before a proposal can be finalized. */
  required?: boolean
}

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
