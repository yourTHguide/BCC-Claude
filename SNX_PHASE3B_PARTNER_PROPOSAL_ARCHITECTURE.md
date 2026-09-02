# SNX Phase 3B — Partner + Proposal Production Architecture

Date: 2026-09-03 (rev. 2 — architecture correction pass)
Status: **architecture proposal only.** No code, no SQL, no migration, no schema change, no commit. Nothing in this document has been applied anywhere.
Depends on: `SNX_PHASE3A_PARTNER_PROPOSAL_AUDIT.md` (accepted), the rev. 1 five-table foundation (approved), and direct re-reading of the real Living OS source at `/Users/guide/Desktop/Ox/sanctuary-nexus`.
Conventions carried forward from this repo's actual production schema (`supabase-schema.sql`, `supabase/migrations/*`): `UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `TIMESTAMPTZ DEFAULT NOW()`, enums as `TEXT CHECK (...)` not Postgres native enums, `updated_at` via the existing shared `set_updated_at()` trigger function, RLS enabled with **zero policies** (service-role-only access), JSONB reserved for genuinely unstructured/variable-shape data, heavy/content columns kept in adjacent tables rather than bloating a hot-path row (mirrors `products` vs. `product_content`), and — new in this pass — the private, service-role-only Storage bucket pattern this repo does not yet have an example of but `product-media`'s public bucket establishes the sibling convention for (canonical path as identity, access derived at read time, never persisted as a permanent URL).

**Rev. 2 changes only** (all seven of your correction items). Sections not touched by a correction are unchanged from rev. 1 and not reproduced in full commentary here — only where a correction's ripple effect required an edit (e.g. every mention of "brand").

---

## 1. What is being preserved, unchanged in mechanism

| Proven capability | Living OS source | Production adaptation |
|---|---|---|
| Canonical Partner record | `partners.ts` | `partners` table, same fields |
| Entity resolution / duplicate prevention | `resolvePartner()` | Same matching logic, ported to query `partners` instead of an in-memory array |
| Deal/context variables | `ProposalDealVariable[]`, `defaultDealVariables()`, `mergeDealVariables()`, `missingRequiredVariables()` | Same shape, JSONB on `partner_deals.terms`, snapshotted onto `proposals.deal_terms_snapshot` |
| Proposal draft generation | `generateProposalDraft()` | Unchanged — reads Framework + Writing Standard + Product Profile + Partner/Deal Context, writes `proposals.draft_content` |
| **AI-assisted drafting with deterministic fallback** | `proposalGeneration.ts` | **Restored in this pass — see §8.** Both modes preserved; `writer_mode = 'ai' \| 'deterministic'` unchanged. Provider-agnostic interface, never blocks proposal creation on AI availability. |
| Proposal versioning | `nextProposalVersion()`, one row per version | Kept flat, one row per version — **hardened in this pass with `series_id`, see §3/§6.** |
| Approval / frozen-version protection | `PATCH action=approve`, 409 on mutating a frozen version | Same rule, **substantially widened in this pass — see §6** (full substantive field set, not just `approved_content`) |
| Approved PDF export | `buildProposalDocument()` + `renderProposalPdf()`, gated on `status ∈ {approved,exported,sent}` | Same gating, same metadata-stripping boundary — **now written to durable Storage in this pass, see §7**, not regenerated on demand |

---

## 2. Canonical object model

Unchanged from rev. 1, with one terminology correction: everywhere rev. 1 said "SNX brand" as an attribute of a Deal or Proposal, read **"business context(s)"** — see §5. The object model itself (Partner / Location / Deal / Proposal, four objects) is unchanged and remains approved.

---

## 3. Corrected minimum Supabase schema

Still five tables: `partners`, `partner_contacts`, `partner_locations`, `partner_deals`, `proposals`. `partners` and `partner_contacts` are **unchanged from rev. 1** (reproduced below only for completeness). `partner_locations`, `partner_deals`, and `proposals` all changed.

### `partners` — unchanged

`id`, `display_name`, `legal_name`, `aliases TEXT[]`, `organization_type`, `relationship_status`, `relationship_owner → admin_users(user_id)`, `relationship_summary`, `review_date`, `next_action`, `relationship_notes JSONB`, `files JSONB`, `created_at`, `updated_at`. No change. Per your approved decision, `relationship_notes` stays JSONB in V1, and **the server write path — never the client — stamps `{author, date}` on every entry it appends**, so authorship/timestamp integrity doesn't depend on trusting whatever the UI sends.

### `partner_contacts` — unchanged

`id`, `partner_id → partners(id) ON DELETE CASCADE`, `person_id UUID` (reserved, no FK, unpopulated in V1), `name`, `title_or_role`, `email`, `phone`, `notes`, `created_at`, `updated_at`. No change.

### `partner_locations` — one addition

Same as rev. 1 (`id`, `partner_id`, `name`, `kind`, `address`, `notes`, `is_active`, timestamps, `UNIQUE(partner_id, name)`), **plus**:

| Column addition | Type | Purpose |
|---|---|---|
| — | `UNIQUE (id, partner_id)` (composite, in addition to the existing PK on `id` alone) | Required as the **target** of the composite foreign key from `partner_deals` in §4 — Postgres can only FK-reference a column set that carries a unique constraint, and `id` alone doesn't carry `partner_id` alongside it. This constraint costs nothing operationally (every row already satisfies it trivially, since `id` alone is already unique) — its only purpose is to make the cross-table integrity check in §4 possible. |

### `partner_deals` — `brand` replaced, integrity FK added

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `partner_id` | `UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE` | |
| `location_id` | `UUID` | nullable — see the composite FK below for how it's actually constrained |
| ~~`brand`~~ → **`business_contexts`** | `TEXT[] NOT NULL, CHECK (cardinality(business_contexts) > 0)` | **Replaces the rejected fixed `brand` enum — see §5.** |
| `product` | `TEXT` | optional, unchanged — a single specific product name when the deal concerns one; distinct from `business_contexts`, which can carry multiple simultaneous context tags at any granularity (see §5) |
| `status` | `TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','informal','signed','expired'))` | unchanged |
| `terms` | `JSONB NOT NULL DEFAULT '[]'::jsonb` | unchanged |
| `agreed_at`, `effective_from`, `effective_until` | `DATE` | unchanged |
| `document_url` | `TEXT` | unchanged |
| `notes` | `TEXT` | unchanged |
| `created_by` | `UUID REFERENCES admin_users(user_id)` | unchanged |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | unchanged |

- **New:** `UNIQUE (id, partner_id)` (composite) — the FK target `proposals` needs, mirroring the same pattern as `partner_locations`.
- **New:** the single-column `location_id → partner_locations(id)` reference from rev. 1 is **replaced** by a composite foreign key: `FOREIGN KEY (location_id, partner_id) REFERENCES partner_locations (id, partner_id)`. Because `location_id` is nullable, the constraint is simply not checked when it's `NULL` (Postgres's default `MATCH SIMPLE` behavior) — a deal with no location is unaffected. When `location_id` **is** set, this is what makes it structurally impossible to reference a location belonging to a different partner: the pair `(location_id, partner_id)` must exist together as a real row in `partner_locations`, so a Deal for Partner A can never point at a Location under Partner B. See §4 for why this uses default `NO ACTION` rather than `ON DELETE SET NULL`.

### `proposals` — `brand` replaced, `series_id` added, integrity FK added, PDF storage corrected

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK DEFAULT gen_random_uuid()` | |
| `partner_id` | `UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE` | |
| `deal_id` | `UUID` | nullable, unchanged decision — see the composite FK below for how it's constrained |
| **`series_id`** | **`UUID NOT NULL`** (no default — always supplied explicitly by the app, see §6) | **New.** The stable lineage identifier — one `series_id` per proposal "line," shared by every version of it. |
| `version` | `INTEGER NOT NULL DEFAULT 1` | now monotonic per `series_id`, not per `(partner_id, business_contexts, product)` — see §6 |
| ~~`brand`~~ → **`business_contexts`** | `TEXT[] NOT NULL, CHECK (cardinality(business_contexts) > 0)` | same correction as `partner_deals` |
| `product`, `title` | `TEXT` | unchanged (`title` `NOT NULL`) |
| `status` | `TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','exported','sent','archived'))` | unchanged values; **mutability after freeze is now explicitly scoped, see §6** |
| `framework_version`, `writing_standard_version`, `product_profile_version`, `proposal_date`, `deal_terms_snapshot`, `context_for_proposal`, `writing_direction` | unchanged types | unchanged |
| `writer_mode` | `TEXT CHECK (writer_mode IN ('ai','deterministic'))` | unchanged — this column is exactly why the type already supported AI-assisted drafting; rev. 1's text mistakenly recommended never reaching the `'ai'` value in V1, which this pass reverses (§8) |
| `draft_content`, `approved_content`, `approved_at` | unchanged types | unchanged |
| `approved_by` | `UUID REFERENCES admin_users(user_id)` | unchanged |
| ~~`pdf_href`~~ → **`pdf_storage_path`** | **`TEXT`** | **Replaces the rev. 1 placeholder that implied a permanent URL. Holds a Storage object path, not a URL — see §7.** |
| `pdf_generated_at` | `TIMESTAMPTZ` | unchanged |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | unchanged |

- **Changed uniqueness:** ~~`UNIQUE(partner_id, brand, product, version)`~~ → **`UNIQUE(series_id, version)`**. See §6 for why the old key was insufficient and how this preserves the flat-version architecture while hardening identity.
- **New composite FK:** `FOREIGN KEY (deal_id, partner_id) REFERENCES partner_deals (id, partner_id)` — same `MATCH SIMPLE`-on-NULL behavior as the `partner_deals`↔`partner_locations` FK above: `deal_id` stays nullable and unconstrained when absent, per your approved decision, but the moment it **is** set, the referenced Deal is structurally guaranteed to belong to the same Partner as the Proposal.

### RLS — unchanged

All five tables: RLS enabled, zero policies, service-role-only. Unchanged from rev. 1.

---

## 4. Corrected relationships / cardinality

```
partners (1) ──< partner_contacts (many)
partners (1) ──< partner_locations (many)
partners (1) ──< partner_deals (many)
partner_locations (1) ──< partner_deals (0..many)   -- location, when set, MUST belong to the same partner
                                                      -- (composite FK: location_id+partner_id → partner_locations.id+partner_id)
partners (1) ──< proposals (many)
partner_deals (1) ──< proposals (0..many)            -- deal, when set, MUST belong to the same partner
                                                      -- (composite FK: deal_id+partner_id → partner_deals.id+partner_id)
proposals series (1) ──< proposals versions (many)   -- one series_id, many version rows; UNIQUE(series_id, version)
admin_users (1) ──< partners (0..many)                via relationship_owner
admin_users (1) ──< partner_deals (0..many)           via created_by
admin_users (1) ──< proposals (0..many)               via approved_by
```

**On delete behavior for the two new composite FKs:** neither specifies `ON DELETE SET NULL`. A composite FK with `ON DELETE SET NULL` sets *every* referencing column to `NULL` on delete (in the Postgres versions this repo targets) — but `partner_deals.partner_id` and `proposals.partner_id` are `NOT NULL`, so that would make the delete itself fail with a constraint violation, not degrade gracefully. Rather than lean on a version-specific column-level `SET NULL` behavior, both composite FKs default to `NO ACTION`: **you cannot hard-delete a `partner_locations` or `partner_deals` row that's still referenced.** This isn't a gap — both tables already have a designed-in soft-delete path for exactly this situation (`partner_locations.is_active = false`, `partner_deals.status = 'expired'`), which is the intended way to retire a location or deal without breaking history that points at it.

---

## 5. `business_contexts` — replacing the rejected `brand` enum

**Type:** `TEXT[] NOT NULL`, with a `CHECK (cardinality(business_contexts) > 0)` — no `CHECK (... IN (...))` on the *values*. That's the deliberate trade-off: a value-list `CHECK` would silently recreate the fixed-enum problem you rejected (extending it still needs a migration). The only DB-enforced rule is *shape* (must be non-empty), not *content*.

**What goes in it:** one or more free-form tags at whatever granularity is useful — brand-level (`best-nightlife`, `your-thailand-guide`, `flow-lab`, `cozy-nest`, `sanctuary-nexus`) and/or finer product-level tags (`bkk-club-crawl`) can coexist in the same array, and a single Deal or Proposal can carry more than one when it genuinely spans contexts (e.g. a general venue relationship that benefits both `best-nightlife` and `flow-lab` at once). This is distinct from — not a replacement for — the existing `product` column: `product` is a single specific product name when a Deal/Proposal is about exactly one; `business_contexts` is the (possibly multi-valued) set of SNX ventures/areas it's recorded under.

**Validating known values without a migration:** enforcement that a tag is a "real" known context is an **application-layer** concern — a maintained allow-list in code (naturally kept in sync with Living OS's existing `OperatingBusinessId` values plus any finer product-level tags this repo wants to recognize), extendable by a code change, never a database migration. This is exactly the property you asked for: *future contexts without DB migrations.*

**No Brand table in V1**, confirmed — nothing here creates a row-per-brand object with its own attributes; it's a tag list, not an entity.

**Indexing and query semantics:**
- Index: `GIN` on `business_contexts`, one per table (`partner_deals`, `proposals`). A plain B-tree can't do array-containment lookups efficiently; GIN is Postgres's standard index type for array/JSONB containment and is the correct choice here regardless of expected table size.
- **"All deals under `best-nightlife`":** containment query, `business_contexts @> ARRAY['best-nightlife']` — uses the GIN index directly.
- **"All deals touching any of these contexts":** overlap query, `business_contexts && ARRAY['best-nightlife','flow-lab']` — also GIN-accelerated.
- Avoid the reversed form `'best-nightlife' = ANY(business_contexts)` for anything that needs to use the index efficiently — `@>`/`&&` are the operators the GIN opclass actually accelerates.
- Exact-array-equality lookups (`business_contexts = ARRAY[...]`) are rarely useful here and aren't a target use case — containment/overlap are.

---

## 6. Fixed proposal version lineage — `series_id`

**Why `(partner_id, brand, product, version)` (or its `business_contexts` equivalent) was insufficient:** it infers a version line's identity from descriptive fields that can legitimately drift between versions — a later version might correct the `product` field, or `business_contexts` might be widened from one tag to two mid-negotiation. Using mutable-ish fields as part of the uniqueness key for "which line is this a version of" was fragile even before this pass; making `business_contexts` an array made it structurally awkward too (array equality in a multi-column `UNIQUE` is legal in Postgres but is exactly the kind of implicit, easy-to-break identity this fix removes).

**The fix:** `series_id UUID NOT NULL`, with **no database default**. It's always supplied explicitly by the application:
- **Initial draft:** generate a new `series_id`, insert with `version = 1`.
- **Create Version:** copy the *same* `series_id` from the version being branched, insert a new row with `version` incremented.

`UNIQUE(series_id, version)` replaces the old key and is what actually enforces "no two rows can claim to be the same version number of the same line" **at the database level** — the exact concurrency/identity hardening you asked for, independent of `product`/`business_contexts` ever changing between versions.

**This preserves the flat one-row-per-version architecture exactly as approved** — there is still no `proposal_versions` child table, no parent `proposals` header row. Every version is still a complete, independent top-level row in `proposals`, exactly matching Living OS's own `create-version` behavior (a full new record, not a child of anything). `series_id` is the one addition: an explicit, stable identifier for "which line," replacing an *inferred* one. Fetching a proposal's full history is `SELECT * FROM proposals WHERE series_id = $1 ORDER BY version`; the latest version is the same query with `ORDER BY version DESC LIMIT 1` — a direct, simpler replacement for Living OS's `latestProposalForLine()`.

---

## 7. Strengthened freeze semantics

The freeze now protects the **substantive proposal**, not just `approved_content`. A version is "frozen" once its `status` has ever reached `approved` (i.e. the check is `OLD.status IN ('approved','exported','sent')` — once true for a row, it stays true for that row's entire remaining lifecycle).

**Immutable once frozen** (any attempted change to any of these, once `OLD.status` is in the frozen set, is rejected at the database level):

`partner_id`, `deal_id`, `series_id`, `version`, `business_contexts`, `product`, `title`, `framework_version`, `writing_standard_version`, `product_profile_version`, `proposal_date`, `deal_terms_snapshot`, `context_for_proposal`, `writing_direction`, `draft_content`, `approved_content`, `approved_at`, `approved_by`.

That's every column that describes *what was approved and by whom*, exactly per your list, plus `series_id`/`version` (which must never change under any circumstance — including this one) and `approved_at`/`approved_by` (set once, at the moment the row *enters* the frozen state, and immutable thereafter alongside everything else).

**Mutable after freeze — the controlled post-approval lifecycle, and only this:**
- `status` — but not to anything: only forward through `approved → exported → sent`, never backward to `draft`/`review`, and never skipped. (`archived` is reachable as a terminal housekeeping state from any already-frozen status, since it represents "no longer active," not a content change.)
- `pdf_storage_path`, `pdf_generated_at` — see §8. These are the two fields explicitly carved out because generating the durable PDF artifact necessarily happens *after* approval, as a distinct step.
- `updated_at` — the trigger-maintained bookkeeping column, always current.

**Where the transition itself fits:** the *moment* a version moves from `draft`/`review` into `approved` (i.e. `OLD.status` is **not yet** in the frozen set) is unrestricted — that single update is expected to set `approved_content`, `approved_at`, `approved_by`, and `status` all together. The freeze trigger only engages looking forward from that point, not on the transition that creates it.

---

## 8. Durable PDF storage

**Fields:** `pdf_storage_path TEXT` (nullable) + `pdf_generated_at TIMESTAMPTZ` (nullable) on `proposals`, replacing rev. 1's `pdf_href`. No permanent URL is ever stored.

**Bucket:** a **new, private** Storage bucket — proposed name `proposal-pdfs` — distinct from the existing `product-media` bucket, which is deliberately public-read for storefront images. Proposal PDFs are confidential partner-facing commercial documents and must never be publicly reachable; the bucket should have no public-read grant, service-role access only, matching the RLS posture of every table in this document.

**Path convention:** `{partner_id}/{series_id}/v{version}.pdf` — deterministic, collision-proof (a version is already unique per `series_id` by the §6 constraint), and mirrors `product_media.storage_path`'s existing principle: **the path is the canonical identifier; a URL is only ever derived from it at read time, never persisted.** For a private bucket, "derived at read time" means a short-lived signed URL generated on demand by an authenticated server route — not a public URL, but the same never-persist-a-permanent-link discipline `product_media` already established.

**When a PDF is generated:** on the existing `generate-pdf` action, gated exactly as today — only when `status ∈ {approved, exported, sent}`, rendered from the frozen `approved_content` via the unchanged `buildProposalDocument()`/`renderProposalPdf()` pipeline. The render output is uploaded to the bucket at the deterministic path above, and `pdf_storage_path`/`pdf_generated_at` are set on the row (this is exactly the "controlled post-approval lifecycle change" §7 carves out of the freeze trigger).

**How a frozen PDF is retrieved:** an authenticated operator route reads `pdf_storage_path` off the proposal row, requests a short-lived signed URL from Supabase Storage for that path, and redirects/streams it to the requester. The file itself never has a durable public address; only a proposal-holder with a valid, time-boxed link ever gets bytes.

**Does regeneration create or replace an artifact? Neither — `generate-pdf` is write-once per proposal version.** If `pdf_storage_path` is already set on a proposal row, calling `generate-pdf` again does **not** re-render or overwrite the stored object — it simply returns the existing artifact. This is the direct implementation of your critical principle: *the exact approved/sent artifact must remain retrievable even if PDF rendering logic changes later.* If `buildProposalDocument()`/`renderProposalPdf()` is fixed or improved later, re-running it against an already-`sent` proposal must never silently swap the file a partner already has in hand for a differently-rendered one of the same content. If a genuine re-render is ever needed, the correct path is the same one already established for every other kind of change to a frozen version: **Create Version** — a new row, a new `series_id`-linked version, a fresh approval, and its own independently generated PDF. `pdf_storage_path`/`pdf_generated_at` are deliberately *outside* the immutable-field list in §7 (so the write-once-at-generation-time action is legal at the DB level) but are treated as write-once **by application logic**, not by a second DB trigger — a pragmatic choice flagged, not hidden.

---

## 9. Everything else (routes, AI/Hermes boundary policy, migration map, V1/V2 boundary, sequence)

Unchanged in structure from rev. 1 except for the two corrections below; not reproduced in full here since none of the correction items touched them beyond terminology (every `brand` reference becomes `business_contexts`; every `pdf_href` reference becomes `pdf_storage_path`; the "Coming next" routes and inline-CRUD-on-profile-page recommendations stand as written).

**AI/Hermes boundary — corrected:** rev. 1 recommended shipping V1 with `writer_mode='deterministic'` as the *only* reachable mode. **That recommendation is withdrawn.** The approved architecture is **AI-assisted drafting with deterministic fallback**, exactly as Living OS proves it:
- A provider-agnostic draft interface: `generateProposalDraft()`/`reviseProposalDraft()` port unchanged in shape — they already return `{content, mode: 'ai' | 'deterministic', note?}` regardless of which path produced the content.
- If a supported AI provider is configured and reachable, it drafts; the local Living OS Ollama/Hermes endpoint (`HERMES_API` defaulting to `127.0.0.1:11434`) is **not** what gets wired in — that endpoint is local-only infrastructure, correctly out of scope per the Phase 3A audit. A production-reachable provider is a separate, still-open configuration question (§11).
- If the provider is unavailable, unreachable, or errors, the deterministic fallback template runs instead — the same logic Living OS already has, ported unchanged.
- **Proposal creation never depends on AI availability** — `generateProposalDraft()`'s existing try/fallback structure already guarantees this; nothing about moving to Postgres changes it.
- Human approval remains mandatory, unchanged (§8 of rev. 1: API-layer auth check + the §7 freeze trigger together, not AI, gate `approve`).

**V1 vs. V2 boundary — corrected:** "Durable PDF storage" moves from the V2 list to **V1**, per §8. "Live Hermes/AI drafting wired to a real hosted endpoint" is corrected to: **AI-assisted drafting is V1**, scoped to *a* supported provider (not the local Ollama endpoint) with deterministic fallback — only the *specific provider integration* is a still-open configuration detail (§11), not a V2 deferral of the capability itself.

---

## 10. Corrected migration map delta

| Living OS | Production | Note |
|---|---|---|
| `PartnerBusinessLink[]` | *(not a table)* — derived from `partner_deals.business_contexts` / `proposals.business_contexts` | unchanged reasoning from rev. 1, terminology corrected |
| — | `series_id` on `proposals` | **new in this pass** — no direct Living OS equivalent; Living OS infers a version line from `(partnerId, business, product)`, which this pass replaces with an explicit identifier (§6) |
| `finalArtifactRef` (`{kind:'pdf', href, generatedAt, version}`) | `pdf_storage_path` + `pdf_generated_at` | **corrected in this pass** — Living OS's `href` was already a stand-in for "the PDF exists somewhere"; production makes that somewhere a durable, private, path-addressed Storage object rather than an on-demand-regenerated response (§8) |

---

## 11. Risks / open questions requiring your approval

Rev. 1's questions 1 (deterministic-only), 5 (brand enum finality), and 6 (PDF durability) are **resolved by this pass** and removed. Remaining and new:

1. **Which AI provider(s) count as "supported" in V1?** The architecture is provider-agnostic by design, but a real implementation needs at least one concrete, production-reachable provider named and its credentials sourced (this repo's existing env-var pattern). This is an implementation-readiness question, not a schema question — genuinely open.
2. **DB-level immutability trigger, now widened to the full field set in §7** — confirm the broader scope (not just `approved_content`) is welcome, not more than intended.
3. **`relationship_notes` as JSONB, server-stamped** — confirmed acceptable per your standing decision; no new question, listed only for completeness.
4. **Forward-only status transition strictness** — §7 proposes `approved → exported → sent`, plus `archived` reachable from any frozen status as a terminal housekeeping move. Confirm `archived` should be reachable from any frozen state, or only from `sent`.
5. **`proposal-pdfs` bucket name and signed-URL TTL** — proposed bucket name and a short (e.g. 5-minute) signed-URL lifetime are defaults, not load-bearing architecture decisions; flagged only so they're not assumed silently.
6. **Existing Living OS seed/runtime data** (the real SOHO relationship in `.sanctuary/runtime/work-data.json`) — per your standing decision, this gets a separate explicit import review before any insertion; not resolved here, just re-confirmed as still pending and out of this document's scope.

No implementation proceeds until these are resolved and a separate go-ahead is given.
