# SNX Phase 3C — Partner + Proposal Production Foundation: Implementation Plan

Date: 2026-09-03
Status: **plan only.** No SQL, no code, no migrations, no commits. Nothing in this document has been applied anywhere.
Builds on: `SNX_PHASE3A_PARTNER_PROPOSAL_AUDIT.md` (accepted), `SNX_PHASE3B_PARTNER_PROPOSAL_ARCHITECTURE.md` rev. 2 (approved — schema, freeze semantics, PDF storage all final), and the Living OS AI-layer audit (accepted). Uses this repo's real conventions, confirmed by reading `lib/operator/products.ts`, `lib/admin-auth.ts`, `lib/media.ts`, `app/api/admin/products/route.ts`, and `supabase/migrations/20260819180419_phase4c_storage_bucket_product_media.sql` directly rather than assuming a pattern.

**AI decision for this phase, restated:** preserve `writer_mode = 'ai' | 'deterministic'` and the full provider-agnostic orchestration shape. **No hosted provider is connected in Phase 3C.** When unconfigured, the flow always resolves to the proven deterministic fallback — not an error, not a blocked action. Connecting a real provider later is a small, isolated follow-up (§4), not a redesign.

---

## 1. Database foundation

Five tables, exactly as finalized in Phase 3B rev. 2. No new tables, no changes to the approved column set — this section plans the *migration artifact*, not new architecture.

### Tables and their triggers

All five tables (`partners`, `partner_contacts`, `partner_locations`, `partner_deals`, `proposals`) get the existing shared `set_updated_at()` trigger function (already defined in production, reused unchanged — no new function). `proposals` additionally gets the new **freeze trigger** (below). No other table needs a custom trigger.

### Indexes, by table

| Table | Index | Purpose |
|---|---|---|
| `partners` | functional B-tree on `lower(display_name)` | fast candidate lookup for `resolvePartner()` |
| `partners` | GIN on `aliases` | fast alias-match candidate lookup for `resolvePartner()` |
| `partners` | B-tree on `relationship_owner` | FK lookup, "my partners" views |
| `partners` | B-tree on `relationship_status` | list-page status filter |
| `partner_contacts` | B-tree on `partner_id` | "contacts for this partner" |
| `partner_locations` | *(none beyond the constraints below)* | `UNIQUE(partner_id, name)` already leads with `partner_id`, so it doubles as the "locations for this partner" lookup index — no redundant index needed |
| `partner_deals` | B-tree on `partner_id` | "deals for this partner" — **not** already covered by `UNIQUE(id, partner_id)`, since that constraint leads with `id`, not `partner_id` |
| `partner_deals` | B-tree on `location_id` | "deals at this location" |
| `partner_deals` | GIN on `business_contexts` | containment/overlap queries, see Phase 3B §5 |
| `partner_deals` | B-tree on `status` | status-filtered views |
| `proposals` | B-tree on `partner_id` | "proposals for this partner" |
| `proposals` | B-tree on `deal_id` | "proposals from this deal" |
| `proposals` | GIN on `business_contexts` | same as above |
| `proposals` | B-tree on `status` | status-filtered views |
| `proposals` | *(none beyond)* | `UNIQUE(series_id, version)` already leads with `series_id`, so "all versions of this proposal" is already indexed — no redundant index needed |

### Integrity constraints

- **Partner ↔ Location:** `partner_locations` gets `UNIQUE(id, partner_id)` (composite, alongside the existing PK on `id`). `partner_deals.location_id` is constrained by a composite FK to `partner_locations(id, partner_id)` jointly with `partner_deals.partner_id` — the exact mechanism finalized in Phase 3B §3/§4. `NULL` `location_id` bypasses the check (default `MATCH SIMPLE`); a non-null one is now structurally guaranteed to belong to the same partner.
- **Partner ↔ Deal ↔ Proposal:** same pattern — `partner_deals` gets `UNIQUE(id, partner_id)`; `proposals.deal_id` is constrained by a composite FK to `partner_deals(id, partner_id)` jointly with `proposals.partner_id`.
- **On-delete behavior:** both composite FKs default to `NO ACTION` — hard-deleting a referenced `partner_locations`/`partner_deals` row is blocked; retirement goes through `is_active = false` / `status = 'expired'` instead, per Phase 3B §4.
- **Series/version identity:** `proposals.series_id UUID NOT NULL` (no default — always application-supplied), `UNIQUE(series_id, version)`.
- **`business_contexts`:** `TEXT[] NOT NULL` on both `partner_deals` and `proposals`, with `CHECK (cardinality(business_contexts) > 0)` — shape-only, no value-list `CHECK`, per Phase 3B §5.

### RLS

All five tables: `ENABLE ROW LEVEL SECURITY`, zero policies — service-role-only, identical posture to every existing table in this schema. No new policy anywhere in this migration.

### The approved/frozen proposal immutability trigger

One `BEFORE UPDATE` trigger on `proposals`, engaging whenever `OLD.status IN ('approved','exported','sent')`:

- **Rejects any change** to: `partner_id`, `deal_id`, `series_id`, `version`, `business_contexts`, `product`, `title`, `framework_version`, `writing_standard_version`, `product_profile_version`, `proposal_date`, `deal_terms_snapshot`, `context_for_proposal`, `writing_direction`, `draft_content`, `approved_content`, `approved_at`, `approved_by`.
- **Allows:** `status` (forward-only: `approved → exported → sent`, plus `archived` reachable from any frozen status as terminal housekeeping — never backward, never skipped), `pdf_storage_path`, `pdf_generated_at`, `updated_at`.
- The transition **into** `approved` itself (`OLD.status` not yet frozen) is unrestricted, since that single update is exactly what sets `approved_content`/`approved_at`/`approved_by`/`status` together.

This is the exact behavior finalized in Phase 3B §7 — this section plans its migration placement, not new logic.

### Migration sequencing within this one artifact

A single additive migration file is sufficient (matches this repo's existing style — e.g. `supabase/migrations/20260819000001_phase4a_auth_rls.sql` bundles a table + RLS + policy + trigger in one file). Internal order: create tables (partners → partner_contacts/partner_locations, both depending on partners → partner_deals, depending on partners+partner_locations → proposals, depending on partners+partner_deals) → composite uniques → composite FKs → indexes → RLS enable → `set_updated_at` triggers → freeze trigger. Nothing in this migration touches any existing table, column, view, or policy — it is purely additive.

---

## 2. Proposal PDF storage

**Bucket:** new, **private** bucket `proposal-pdfs` — same creation mechanism as the existing `product-media` bucket migration, with `public = false` (not `true`) and `allowed_mime_types = ARRAY['application/pdf']`. Because `storage.objects` already has RLS enabled with zero policies project-wide (confirmed by the existing `product-media` migration's own comment), a private bucket with no policy is automatically service-role-only — no new policy needed, consistent with every other table.

**Canonical path:** `{partner_id}/{series_id}/v{version}.pdf` — deterministic and collision-proof, since `(series_id, version)` is already the DB-enforced unique identity of a proposal version. New module `lib/proposalPdfStorage.ts` (mirrors `lib/media.ts`'s role for `product-media`) owns the bucket name constant and the path-building function — `storage_path` stays the only persisted identifier, exactly like `product_media.storage_path`.

**Generation (write-once):** on the `generate-pdf` action (§3), gated on `status ∈ {approved, exported, sent}` exactly as today:
1. If `proposals.pdf_storage_path` is already set, **do nothing** — return the existing path/metadata. No re-render, no overwrite.
2. Otherwise, render via the unchanged `buildProposalDocument()` + `renderProposalPdf()` pipeline from the frozen `approved_content`, upload to the bucket at the canonical path, and set `pdf_storage_path`/`pdf_generated_at` (the one write these two columns ever get, in practice, per proposal version).

**Retrieval:** an authenticated operator route reads `pdf_storage_path` off the proposal row and requests a short-lived signed URL (proposed default: 5 minutes) from Supabase Storage for that exact path — never a stored/persisted public URL. `lib/proposalPdfStorage.ts` owns this too (`getProposalPdfSignedUrl(path, ttlSeconds?)`).

**Enforced write-once, in practice:** because generation is idempotent (step 1 above) and the field pair is excluded from the freeze trigger only so this one write can happen post-approval — not so it can be repeatedly overwritten — the exact bytes generated the first time are what every later "View/Download PDF" resolves to, even if `buildProposalDocument()`/`renderProposalPdf()`'s code changes later. A genuine re-render requires Create Version (§3), never an overwrite of an existing artifact.

---

## 3. Production data layer

Three tiers, matching how this repo already separates concerns (confirmed by reading `lib/operator/products.ts` against `app/api/admin/products/route.ts`):

- **Domain/core** (`lib/partners.ts`, `lib/proposals.ts`, plus the ported proposal-writing modules) — storage-adapted ports of Living OS's own `src/lib/partners.ts`/`src/lib/proposals.ts`. Unlike `lib/operator/products.ts` (whose writes are thin CRUD, left inline in the admin route), Partner/Proposal writes carry real, proven business logic — entity resolution, deal-variable merging, version lineage, freeze validation — worth centralizing once, exactly because Living OS already proves it's worth centralizing once. Both Server Components and API routes import from here.
- **Operator reads** (`lib/operator/partners.ts`, `lib/operator/proposals.ts`) — thin, list/profile-shaped read helpers for Server Components, following the exact existing pattern of `lib/operator/products.ts`/`lib/operator/eventOps.ts`.
- **Admin write routes** (`app/api/admin/partners/**`, `app/api/admin/proposals/**`) — `requireRole(['owner','admin'])` + call into the domain tier, following the existing `app/api/admin/products/route.ts` shape (auth first, then service-role client, then `NextResponse.json`).

### Partner data

`lib/partners.ts` (ported/adapted from Living OS `src/lib/partners.ts`):
- `getPartners(filter?: { status?, search? })` — list/search
- `getPartner(id)` — single partner, joined with contacts + active locations
- `createPartner(input, actorUserId)`
- `updatePartner(id, patch, actorUserId)`
- `resolvePartner(query)` — ported entity-resolution (exact → alias → substring)
- `addPartnerNote(id, note, actorUserId)` — appends to `relationship_notes` JSONB, **server** stamps `{author: actorUserId, date: now()}`, never trusts a client-supplied author/date
- Contacts: `listPartnerContacts(partnerId)`, `createPartnerContact(partnerId, input)`, `updatePartnerContact(id, patch)`, `deletePartnerContact(id)`
- Locations: `listPartnerLocations(partnerId)`, `createPartnerLocation(partnerId, input)`, `updatePartnerLocation(id, patch)`, `setPartnerLocationActive(id, isActive)` (soft-delete path, no hard-delete function exposed)
- Deals: `listPartnerDeals(partnerId)`, `getPartnerDeal(id)`, `createPartnerDeal(partnerId, input, actorUserId)` (validates `location_id` belongs to `partnerId` at the app layer too, as a friendly pre-check ahead of the DB constraint), `updatePartnerDealTerms(id, terms)`, `updatePartnerDealStatus(id, status, actorUserId)` (the "mark signed/expired" action)
- Deal-variable helpers ported unchanged in shape: `defaultDealVariables()`, `mergeDealVariables()`, `missingRequiredVariables()` — operate on `partner_deals.terms`/`proposals.deal_terms_snapshot` JSONB instead of an in-memory array field

`lib/operator/partners.ts`:
- `getPartnersListForOperator()` — list-row shape for the Partner Directory screen (name, status, business-context summary derived from deals/proposals, location count, last-contact date)
- `getPartnerProfileForOperator(id)` — the full aggregated shape the Partner Profile screen needs (partner + contacts + locations + deals + proposal summaries) in one call

### Proposal data

`lib/proposals.ts` (ported/adapted from Living OS `src/lib/proposals.ts`):
- `getProposals(filter?)`
- `proposalsForPartner(partnerId)`
- `proposalsForSeries(seriesId)` — replaces Living OS's `latestProposalForLine`, now keyed on the stable `series_id`
- `latestVersionForSeries(seriesId)`
- `getProposal(id)`
- `createProposal(input, actorUserId)` — new `series_id`, `version = 1`, calls `generateProposalDraft()`
- `createProposalVersion(existingId, actorUserId)` — copies `series_id`, `version = latest + 1`, seeds `draft_content` from the prior version's final content, status resets to `draft`
- `updateProposalDraft(id, draftContent)` — app-layer rejects if already frozen (mirrors, doesn't replace, the DB trigger)
- `requestProposalChanges(id, instruction, actorUserId)` — calls `reviseProposalDraft()`
- `regenerateProposalDraft(id, actorUserId)` — calls `generateProposalDraft()` again against the same stored inputs
- `updateProposalDealVariables(id, variables)` — pre-approval only
- `approveProposal(id, actorUserId)` — sets `approved_content`/`approved_at`/`approved_by = actorUserId`/`status = 'approved'`; `actorUserId` must come from a resolved `requireAdmin()` session, never accepted from the request body (§5)
- `generateProposalPdf(id)` — the write-once action from §2
- `getProposalPdfSignedUrl(id)` — the retrieval helper from §2
- `markProposalSent(id, actorUserId)` — `exported → sent`, a pure status transition (§6 — no email/delivery integration)

`lib/operator/proposals.ts`:
- `getProposalHistoryForOperator(seriesId)` — version list for the Partner Profile's "Proposals" section

---

## 4. Living OS ports — exact classification

| Living OS source | Classification | Notes |
|---|---|---|
| `src/lib/partners.ts` (types, `createPartner`, etc.) | **PORT WITH STORAGE ADAPTATION** | In-memory array → Postgres queries; field set unchanged per Phase 3B |
| `resolvePartner()` | **PORT WITH STORAGE ADAPTATION** | Matching logic (exact → alias → substring) unchanged; array scan → SQL query using the `lower(display_name)`/GIN-`aliases` indexes from §1 |
| `defaultDealVariables()` / `mergeDealVariables()` / `missingRequiredVariables()` | **PORT UNCHANGED** | Pure functions over the `ProposalDealVariable[]` shape — genuinely indifferent to where the JSON came from |
| `src/lib/proposalWriter.ts` prompt builders (`buildProposalSystemPrompt`, `buildProposalUserPrompt`, `buildRevisionSystemPrompt`, `buildRevisionUserPrompt`) | **PORT UNCHANGED** | Pure functions of a `ProposalWriterInputs` object |
| `composeDeterministicDraft()` | **PORT UNCHANGED** | The proven fallback — no provider awareness at all |
| `generateProposalDraft()` / `reviseProposalDraft()` (orchestration) | **PORT WITH ADAPTATION** | See below — one small, deliberate addition, not a redesign |
| `src/lib/proposalDocument.ts` (`buildProposalDocument`, `parseBlocks`, `proposalPdfFilename`) | **PORT UNCHANGED** | Pure functions over a `Proposal`-shaped object; storage-ignorant by design — the caller (§2/§3) now uploads the output, these functions never did and still don't |
| `src/lib/server/proposalPdf.ts` (`renderProposalPdf`) | **PORT UNCHANGED** | `pdfkit` rendering, no storage awareness |
| `src/lib/hermes/api.ts` transport pattern (env-configured base URL + model, OpenAI-chat-completions shape, `auth.bearer` slot) | **PORT WITH ADAPTATION — DEFERRED, NOT BUILT IN 3C** | See below |
| `src/lib/server/partnerInterpret.ts` | **DO NOT PORT IN 3C** | Real, proven ASSIST-tier logic (free-text → partner-fields extraction with AI+heuristic fallback) but not required for the 5-table foundation or the mockup's V1 flows — a natural 3F+/later addition, not a blocker |
| `hermes/cortex.ts`, `hermes/orchestrator.ts`, `hermes/specialistContext.ts`, `hermes/authorityContext.ts`, `hermes/types.ts` | **DO NOT PORT** | Confirmed by import inspection: none of this is used by the proposal drafting path at all |
| Local owner session, `.sanctuary/*` JSON/SQLite stores, `AnimalId`/wildlife roster | **DO NOT PORT** | Already resolved by this repo's real `admin_users`/Supabase Auth (§5) |
| `HERMES_API`/`NEXT_PUBLIC_HERMES_API` default `http://127.0.0.1:11434/v1`, `HERMES_MODEL` default `gemma4:latest`, `PROPOSAL_MODEL_TIMEOUT_MS` default `180_000` | **DO NOT PORT — VALUES** | Never carried over as defaults, per your explicit instruction; the *pattern* (configurable base URL + model + timeout) is fine, the *values* are local-only artifacts |

### The one adaptation to `generateProposalDraft()`/`reviseProposalDraft()`

Living OS's `callModel()` unconditionally attempts a network call to `HERMES_API` (or its local default) on every draft/revision, catching the resulting error when nothing is there. For production, add a cheap upfront check — **is a provider actually configured?** — and skip straight to the deterministic composer when it isn't, rather than attempting (and always failing) a fetch to nowhere on every single proposal. This makes the deterministic path the *fast, expected* default in Phase 3C, not a caught-exception path every time. Concretely: a single new optional env var name is reserved now (proposed: `PROPOSAL_AI_API_KEY`, no `NEXT_PUBLIC_` prefix, server-only) — **unset in Phase 3C, on purpose.** When unset, `generateProposalDraft`/`reviseProposalDraft` return `{content: composeDeterministicDraft(...), mode: 'deterministic'}` immediately.

**This means the AI transport client file itself (`hermes/api.ts`'s equivalent) does not need to exist yet.** There is nothing to point it at. Building it now would be speculative work against an unmade provider decision. When a provider is eventually chosen, the follow-up is: write one new transport module, wire the real `auth.bearer` header (dead code in Living OS — never actually used anywhere in that repo either, confirmed in the prior audit), and change the upfront check in `generateProposalDraft`/`reviseProposalDraft` from "is the key set → skip" to "is the key set → call the real client." **Nothing else changes** — not the schema, not the freeze trigger, not `writer_mode`'s values, not any route, not any UI. This is the concrete proof that the provider decision was never a blocker to the foundation.

---

## 5. Authentication / human approval

No new auth work. `lib/admin-auth.ts`'s existing `getAdminUser()` (Server Components) / `requireAdmin()` / `requireRole(allowed)` (route handlers) are reused exactly as Products/Event Operations/Calendar/Check-in already use them — this repo already solved the identity problem Living OS never had.

- **Write-route gate:** every Partner/Deal/Proposal write route uses `requireRole(['owner','admin'])` — the same gate already used for `/api/admin/products`. Partner/commercial data is administrative, not day-of operational data a `staff`/host role needs to touch (unlike check-in), so `staff` is excluded, consistent with the existing Stage 9j role model.
- **`relationship_owner`** (on `partners`) — settable to any `admin_users.user_id` via the partner create/update route; this is a label/assignment, not itself a permission gate — it does not need to equal the authenticated actor.
- **`created_by`** (on `partner_deals`) — always set from the authenticated session's `admin.userId` at insert time. **Never accepted from the request body** — even if a client sends one, the route ignores it and uses the resolved session identity.
- **`approved_by`** (on `proposals`) — same rule, at its single most important point: `approveProposal()` sets it from `requireAdmin()`'s resolved identity, never from client input, never left null, never set to a system/service actor.
- **AI/system code never approves anything.** `generateProposalDraft`/`reviseProposalDraft` have no identity, no session, and no code path that calls `approveProposal()` or `updatePartnerDealStatus(..., 'signed', ...)` — those are reachable *only* through the authenticated route handlers in §3. This holds by construction in this repo (there is no Hermes/service-to-service caller in scope at all for Phase 3C), not merely by convention.

---

## 6. Mockup interpretation

The attached "Partner & Proposal — V1 (Current Capabilities)" mockup is the primary UX reference for hierarchy and screen composition. Mapped to the approved architecture:

| Mockup screen | Maps to | Notes |
|---|---|---|
| Partner Directory | `/operator/manage/partners` | Search, status filter chips, business-context chips **read as dynamic examples of `business_contexts` values in actual use, not a fixed set** — no enum, no Brand table, per Phase 3B §5 |
| Partner Profile | `/operator/manage/partners/[id]` | Overview/Locations/Contacts/Deals/Proposals — tabs or sections over the one aggregated `getPartnerProfileForOperator()` read; "+ New Deal"/"+ New Proposal" as inline actions, not sub-routes, matching Phase 3B §9 |
| Deal Details | inline expansion/panel on the Profile page, not a separate route | `partner_deals` is lightweight by design (Phase 3B §6 decision) — a dedicated route per deal is over-scoped, same judgment already applied to Event Operations |
| New Proposal (Setup → Draft → Review steps) | `/operator/create/proposal?partnerId=…` (or `?proposalId=…` to resume/review an existing one) | One client screen with internal step state, directly mirroring Living OS's `ProposalBuilder.tsx` structure — not three separate routes |
| Approved & PDF | same screen, `approved`/`exported`/`sent` state | "View/Download PDF" → `getProposalPdfSignedUrl()`; "Create New Version (V2)" → `createProposalVersion()` |

**Explicitly not carried over, even though visible in the mockup:**
- The canonical bottom nav stays **Home · Manage · Create · Quest · More** — the mockup's own header/branding is illustrative, not a nav change.
- Business-context chips (BEST/BCC/YTG/Flow Lab/SNX) are rendered from whatever values actually exist in `business_contexts` on real rows — never a hardcoded chip list, never a DB enum.
- No canonical People system, no comments/annotations on a proposal, no e-signature, no communications timeline, no proposal section-builder schema, no automatic agreement → live-event activation — all explicitly out of scope per Phase 3B's V1/V2 boundary, unchanged by this mockup.
- **"Send to Partner"** — the mockup shows this as a button. It is built (in 3G, §7) as `markProposalSent()`: a pure status transition (`exported → sent`) the operator clicks *after* delivering the PDF themselves (WhatsApp, email, in person). It does **not** trigger any actual email/message send — no send integration exists or is being added merely because the mockup shows a button with that label.

---

## 7. Implementation phases

Six slices, not five — the user's sketch's 3F is split into a proposal-authoring slice and a lower-risk PDF/lifecycle slice, since PDF generation depends on approval working first and has a meaningfully different risk profile (Storage bucket + signed URLs vs. pure Postgres CRUD). Every slice is strictly additive: no existing table, route, or file is modified, so **every slice carries zero risk to `/dashboard`, Stripe, checkout, or the booking/check-in flow** by construction — stated once here rather than repeated per row, except where a slice's own verification should explicitly re-confirm it.

| Slice | Files created/changed | Schema touched | Existing systems at risk | Verification required | Rollback boundary |
|---|---|---|---|---|---|
| **3C-1 — Schema + Storage** | One new migration file (§1); one new Storage bucket migration (§2) | **Yes — additive only.** 5 new tables, 1 new bucket, 0 changes to existing tables/columns/policies | None — no existing table is touched, no existing RLS policy is touched | Migration applies cleanly to a fresh copy of the schema; `\d` each new table matches the approved column/constraint list; confirm RLS is enabled with zero policies on all 5; confirm the freeze trigger rejects a hand-crafted `UPDATE` to `approved_content` on a `status='approved'` row and allows one to `pdf_storage_path`; confirm the bucket is `public=false` | Drop the 5 new tables + trigger function + bucket. Nothing else references them yet (no app code exists), so this is a clean, total revert |
| **3C-2 — Server data layer + Living OS ports** | New: `lib/partners.ts`, `lib/proposals.ts`, `lib/proposalWriter.ts`, `lib/proposalDocument.ts`, `lib/proposalPdf.ts`, `lib/proposalGeneration.ts`, `lib/proposalPdfStorage.ts`, `lib/operator/partners.ts`, `lib/operator/proposals.ts` | No | None — pure library code, not imported by any existing route or page yet | Type-checks; a scratch script (not committed) exercises `createPartner`→`resolvePartner`→`createPartnerDeal`→`createProposal`→`approveProposal`→`generateProposalPdf` end-to-end against a real (non-production) Supabase target; confirm the write-once PDF rule holds on a second `generateProposalPdf()` call; confirm `generateProposalDraft()` returns `mode:'deterministic'` with `PROPOSAL_AI_API_KEY` unset | Delete the new `lib/` files. Nothing in the existing app imports them, so this is a clean, total revert |
| **3D — Manage → Partner Directory/Profile (read-only)** | New: `app/operator/manage/partners/page.tsx`, `app/operator/manage/partners/[id]/page.tsx`; new nav entry under Manage | No | None — read-only Server Component pages, no new write route yet | Visual check against the mockup's Directory/Profile screens with seeded test data; confirm empty states render correctly with zero partners (matches the existing "calm empty state, never fabricate data" pattern already used elsewhere in `/operator`); confirm no client-side/anon Supabase read is introduced (service-role only, from Server Components, per the standing `/operator` security boundary) | Remove the two new page files and the nav entry. Nothing else depends on them |
| **3E — Partner writes: contacts/locations/deals** | New: `app/api/admin/partners/route.ts` (+ `[id]/route.ts`, `[id]/contacts/route.ts` + `[contactId]/route.ts`, `[id]/locations/route.ts` + `[locationId]/route.ts`, `[id]/deals/route.ts` + `[dealId]/route.ts`); new client action-panel components on the Profile page (mirrors Phase 2C/2D's Server Component + client action-panel split) | No | None — new routes only, `requireRole` gated, no existing route touched | Manual test: create a partner, add a contact, add a location, add a deal referencing that location, confirm the row appears correctly; **deliberately attempt** to create a deal with a `location_id` belonging to a different partner and confirm it's rejected (proves the composite FK is real, not just documented); confirm `created_by` is always the logged-in admin regardless of request body tampering | Remove the new route files and action-panel components. The 5 tables stay empty/unused if nothing wrote to them yet, or contain only test data that can be truncated — no cross-table dependency outside this feature |
| **3F — Create → Proposal workflow (author/review/approve)** | New: `app/api/admin/proposals/route.ts` + `[id]/route.ts` (the multi-action `PATCH`, mirroring Living OS's single-endpoint-with-`action`-field convention); `app/operator/create/proposal/page.tsx` + client Proposal Builder component (mirrors `ProposalBuilder.tsx`'s structure); wiring the existing "Coming next" Create-hub card | No | None — the highest-*novelty* slice (freeze/version mechanics exercised for real for the first time against live Postgres) but zero risk to any existing system; the freeze trigger itself was already verified in 3C-1 | End-to-end manual test: Setup → Generate Draft (confirm deterministic mode, since no provider is configured) → Request Changes → Regenerate → Approve; **deliberately attempt** to edit `draft_content` on the now-approved row via a direct update and confirm the DB trigger rejects it, not just the app layer; Create Version and confirm the new row shares `series_id` with `version` incremented | Remove the new route/page/component files and unwire the Create-hub card back to "Coming next." Any test proposal rows can be deleted directly (nothing else references `proposals` yet) |
| **3G — PDF storage + lifecycle** | New: PDF generate/retrieve wiring in the proposal `PATCH`/`GET` routes from 3F; "View/Download PDF," "Mark as Sent," "Create New Version" buttons on the Proposal Builder screen | No | None | Generate a PDF for an approved proposal, confirm the file lands at the exact `{partner_id}/{series_id}/v{version}.pdf` path; call generate again and confirm it's a no-op returning the same artifact (the write-once rule, exercised for real); confirm the signed URL expires after its TTL; confirm `Mark as Sent` only changes `status`, triggers no email; confirm the bucket rejects a non-PDF upload attempt (`allowed_mime_types` enforcement) | Remove the PDF-related route additions and buttons; the bucket and any test objects in it can be emptied independently of every other slice |

**Sequencing dependency, stated plainly:** 3C-1 must land before 3C-2 (code needs tables to query). 3C-2 must land before 3D/3E/3F (UI/routes need the data layer). 3D (read) is deliberately sequenced before 3E (write) — the same "read view before write actions" order already used for Phase 2A/2B/2C. 3F depends on 3E only loosely (a proposal can technically be created against a partner with no deals yet, per Phase 3B's nullable `deal_id`), but building Partner writes first means there's something real to attach a proposal to when testing 3F. 3G strictly depends on 3F (there's nothing to generate a PDF from until approval exists).

No step in this plan has been executed. This is a sequencing and file-manifest proposal, not a work log.
