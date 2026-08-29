// Temporary Preview-only visual-QA scaffolding for the New in Bangkok
// Lovable port (Stages 3A/3B). This is NOT a storefront resolver and does
// NOT touch resolveStorefront() (lib/storefront.ts) — that function and
// real production hostname routing are completely unaffected by this file.
//
// Vercel serves a feature-branch Preview deployment from a *.vercel.app
// hostname that resolveStorefront() correctly does not recognize as BNT (a
// blanket "*.vercel.app -> bnt" rule would misclassify every OTHER Preview
// deployment this app will ever have). This narrow, dual-keyed check lets a
// small, explicit set of routes render their BNT variant on THIS ONE
// branch's Preview specifically, so New in Bangkok's ported presentation
// page and the sibling pages its own header/footer link to (Home, About)
// can be visually reviewed together without the visitor crossing into BCC
// content mid-navigation. True only when BOTH hold simultaneously:
//   1. VERCEL_ENV === 'preview' — never true in Production, where Vercel
//      always sets this to 'production'.
//   2. VERCEL_GIT_COMMIT_REF === this exact branch name — never true for
//      any other branch's Preview build, including main's own.
// Real production hostnames (bestnightlifethailand.com, bkkclubcrawl.com)
// never depend on this — they already resolve correctly via
// resolveStorefront() alone. DELETE this file and its call sites once
// visual QA on this branch is done, before merging to main.
const QA_BRANCH = 'claude/new-in-bangkok-lovable-port'

export function isNibPreviewQaBranch(): boolean {
  return process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === QA_BRANCH
}
