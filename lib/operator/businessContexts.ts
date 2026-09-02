// SNX Phase 3F — shared business-context label lookup. Single source of
// truth for the known-context {value, label} pairs the New Deal UI offers
// (ProposalSetupClient.tsx) and for turning a proposal's raw
// business_contexts slugs into human-readable labels anywhere they're shown
// to an operator or a partner (e.g. the Proposal Preview document).
//
// This is a UI convenience only -- business_contexts stays a plain TEXT[]
// with no DB enum (Phase 3B §5). humanizeBusinessContext() falls back to
// title-casing any slug not in this list, so a custom context (still
// supported by the domain/API model even though no UI control creates one
// today -- see ProposalSetupClient.tsx's own comment) never renders as a
// raw, unlabeled slug.

export const KNOWN_BUSINESS_CONTEXTS: { value: string; label: string }[] = [
  { value: 'best-nightlife', label: 'BEST Nightlife' },
  { value: 'bkk-club-crawl', label: 'Bangkok Club Crawl' },
  { value: 'your-thailand-guide', label: 'Your Thailand Guide' },
  { value: 'flow-lab', label: 'Flow Lab' },
  { value: 'sanctuary-nexus', label: 'Sanctuary Nexus' },
]

const LABEL_BY_VALUE = new Map(KNOWN_BUSINESS_CONTEXTS.map((c) => [c.value, c.label]))

/** Human-readable label for one business-context slug. Unknown slugs are title-cased from their hyphens rather than shown raw. */
export function humanizeBusinessContext(value: string): string {
  const known = LABEL_BY_VALUE.get(value)
  if (known) return known
  return value
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Human-readable, comma-separated label list for a proposal's business_contexts. */
export function humanizeBusinessContexts(values: string[]): string {
  return values.map(humanizeBusinessContext).join(', ')
}
