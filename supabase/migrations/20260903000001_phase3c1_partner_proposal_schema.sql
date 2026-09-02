-- ============================================================
-- Phase 3C-1 — Partner + Proposal production foundation: schema
-- ============================================================
-- Adds five new tables ONLY: partners, partner_contacts, partner_locations,
-- partner_deals, proposals. Nothing existing is altered — no existing table,
-- column, view, policy, or function is touched or redefined.
--
-- Rev. 2 of this migration (this file): corrects the proposal lifecycle
-- model. A proposal row is either a mutable Working Draft (version IS NULL,
-- freely edited, never versioned) or a permanently frozen Finalized Version
-- (version IS NOT NULL, assigned exactly once by a single atomic
-- Finalize & Generate PDF database write that ALSO writes its approved
-- content and durable PDF pointer in the same statement — never separately).
--
-- Rev. 3 (this file, final integrity pass): the PDF Storage path is now
-- keyed on draft_revision as well as the row's own id, so a retry against
-- an unchanged draft reuses the exact artifact that revision already
-- produced instead of overwriting anything (§ pdf_storage_path below); and
-- proposals_finalization_requires_pdf is replaced by the strictly broader
-- proposals_lifecycle_invariant, which also pins status to the correct set
-- of values for whichever side of version IS NULL a row is on, closing the
-- gap that a CHECK-only constraint (unlike enforce_proposal_freeze, a
-- trigger, which never fires on INSERT) is the only thing that protects
-- against on both INSERT and UPDATE.
--
-- See SNX_PHASE3B_PARTNER_PROPOSAL_ARCHITECTURE.md and the Phase 3C session
-- correction thread for the full reasoning.
--
-- IDEMPOTENCY, deliberately changed in this revision: table creation
-- (CREATE TABLE, all five) and the proposal-pdfs bucket insert are NO LONGER
-- silently re-runnable via IF NOT EXISTS / ON CONFLICT DO UPDATE. Both now
-- fail loudly (a plain Postgres "relation/bucket already exists" error) if
-- their target already exists, rather than silently accepting whatever is
-- already there or silently overwriting a bucket's configuration. These are
-- brand-new names with no legitimate prior owner other than this migration
-- itself having already been applied once — which Supabase's own migration
-- history tracking already prevents from happening via a normal `db push`.
-- A genuine collision (an unexpected pre-existing object under one of these
-- names) is exactly the case that must now surface as an error, not a
-- silent no-op that could mask an incompatible partial object. Indexes and
-- triggers remain IF NOT EXISTS / DROP+CREATE as before — by the time those
-- statements run, the table creation above them has already guaranteed a
-- fresh table within this same migration, so no similar ambiguity exists
-- for them.
--
-- Reuses the EXISTING shared public.set_updated_at() trigger function
-- (defined in 20260819000001_phase4a_auth_rls.sql, already live in
-- production) — this migration only attaches new triggers to it on the five
-- new tables. It does not, and must never, redefine or drop that function;
-- it is pre-existing shared infrastructure this migration only reuses.
--
-- RLS posture matches every existing table in this schema exactly: enabled,
-- zero policies. Supabase's project-wide bootstrap grants blanket
-- SELECT/INSERT/UPDATE/DELETE to anon/authenticated at the schema level, but
-- RLS-with-no-policy denies every row to both roles regardless of that
-- grant — only service_role (and postgres), which carry BYPASSRLS, can read
-- or write these tables. See supabase-schema.sql's RLS section for the full
-- explanation of this repo's standing posture; do not add a permissive
-- policy here "to make the anon key work" — nothing anon-side is meant to
-- read these tables, ever.
-- ============================================================

-- ── PARTNERS ─────────────────────────────────────────────────
-- The canonical organization/business/entity SNX has a relationship with.
-- One row per real-world entity regardless of how many SNX business
-- contexts (brands/ventures) work with it.
CREATE TABLE public.partners (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name         TEXT NOT NULL,
  legal_name           TEXT,
  -- Lowercased alternate names for entity resolution (resolvePartner()).
  aliases              TEXT[],
  organization_type    TEXT
    CHECK (organization_type IN ('hospitality-group','venue','brand','agency','individual','other')),
  relationship_status  TEXT NOT NULL DEFAULT 'prospect'
    CHECK (relationship_status IN ('prospect','in-conversation','proposal-pending','active','paused','archived')),
  -- Real operator identity (this repo's admin_users), not a fictional
  -- "wildlife" owner. Nullable: not every partner has an owner assigned yet.
  relationship_owner   UUID REFERENCES public.admin_users(user_id),
  relationship_summary TEXT,
  review_date          DATE,
  next_action          TEXT,
  -- Array of {date, author, summary, decisions, next_steps}. The server
  -- write path stamps author/date on every entry it appends — never trusts
  -- a client-supplied value for those two fields. JSONB is deliberate for
  -- V1 (Phase 3B §10 open question 3, resolved: acceptable for V1).
  relationship_notes   JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of {label, href}.
  files                JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.partners IS
  'SNX Phase 3C — canonical Partner record. One row per real-world organization; never duplicated per business context. See SNX_PHASE3B_PARTNER_PROPOSAL_ARCHITECTURE.md.';

-- Entity-resolution lookups (resolvePartner(): exact -> alias -> substring).
CREATE INDEX IF NOT EXISTS idx_partners_display_name_lower ON public.partners (lower(display_name));
CREATE INDEX IF NOT EXISTS idx_partners_aliases_gin ON public.partners USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_partners_relationship_owner ON public.partners (relationship_owner);
CREATE INDEX IF NOT EXISTS idx_partners_relationship_status ON public.partners (relationship_status);

-- ── PARTNER CONTACTS ─────────────────────────────────────────
-- Smallest safe representation of a person at a Partner. Deliberately NOT a
-- canonical People system (Phase 3B §7): no profile page, no cross-linking
-- to bookings/guests, no dedup logic. person_id is a reserved, UNPOPULATED
-- forward-compat seam for a future canonical Person table — no FK
-- constraint is added now because that table does not exist.
CREATE TABLE public.partner_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  person_id      UUID,
  name           TEXT NOT NULL,
  title_or_role  TEXT,
  email          TEXT,
  phone          TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.partner_contacts IS
  'SNX Phase 3C — people at a Partner. person_id is a reserved, unpopulated, unconstrained seam for a future canonical Person system; do not wire it in this phase.';
COMMENT ON COLUMN public.partner_contacts.person_id IS
  'Reserved for a future canonical Person table. No FK constraint in V1 -- the target table does not exist yet. Never populated by Phase 3C code.';

CREATE INDEX IF NOT EXISTS idx_partner_contacts_partner_id ON public.partner_contacts (partner_id);

-- ── PARTNER LOCATIONS ────────────────────────────────────────
-- A physical venue belonging to a Partner. A real table (not JSONB)
-- specifically so partner_deals can reference one by foreign key instead of
-- matching a text string -- avoiding the exact fragility event_dates.
-- host_assigned already has as open tech debt (free text, not FK'd).
CREATE TABLE public.partner_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  -- Free text (club/bar/restaurant/hotel/rooftop/...) -- not a CHECK enum;
  -- the domain spans every SNX venture and would need constant expansion.
  kind        TEXT,
  address     TEXT,
  notes       TEXT,
  -- Soft-hide a closed venue without breaking deal history that still
  -- references it. This is the intended retirement path -- partner_deals'
  -- composite FK below deliberately blocks hard-deleting a referenced row.
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevents a literal duplicate venue row under the same partner. Also
  -- doubles as the "locations for this partner" lookup index (partner_id
  -- leads), so no separate plain index on partner_id is added.
  CONSTRAINT partner_locations_partner_name_uniq UNIQUE (partner_id, name),
  -- Composite-unique target required for partner_deals' composite FK below
  -- (Postgres can only FK-reference a column set carrying a unique
  -- constraint). Every row already satisfies this trivially since id alone
  -- is already unique -- its only purpose is enabling the integrity check.
  CONSTRAINT partner_locations_id_partner_uniq UNIQUE (id, partner_id)
);

COMMENT ON TABLE public.partner_locations IS
  'SNX Phase 3C — venues belonging to a Partner. partner_deals.location_id, when set, is constrained to belong to the same partner via a composite FK to (id, partner_id) here.';

-- ── PARTNER DEALS ────────────────────────────────────────────
-- The real agreed (or being-agreed) commercial/operational terms between SNX
-- and a Partner. Deliberately absorbs THREE things Phase 3B kept separate in
-- Living OS: (1) "which SNX business context(s) this relationship touches"
-- -- business_contexts, not a separate always-in-sync brand-tag table;
-- (2) the deal/commercial terms themselves -- terms JSONB, the proven
-- ProposalDealVariable[] shape; (3) the lightweight substitute for a formal
-- Agreement object -- status/agreed_at/document_url/notes (Phase 3B §6
-- Decision A: no separate Agreement table, no e-signature).
--
-- Multiple concurrent 'signed' deals for the same partner/location/business
-- context are deliberately NOT prevented by a uniqueness constraint --
-- that's a business-rule judgment call, not a schema-obvious one, and it
-- stays permitted.
CREATE TABLE public.partner_deals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id         UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  -- NULL = applies to the partner relationship as a whole, not one venue.
  location_id        UUID,
  -- One or more SNX business/venture context tags (e.g. 'best-nightlife',
  -- 'bkk-club-crawl', 'your-thailand-guide', 'flow-lab', 'sanctuary-nexus').
  -- Deliberately NOT a value-list CHECK / DB enum (Phase 3B §5) -- only the
  -- shape (non-empty) is enforced here; "is this a known context" is an
  -- application-layer allow-list, extendable without a migration. No Brand
  -- table exists or is created by this migration.
  business_contexts  TEXT[] NOT NULL,
  -- A single specific product name when the deal concerns one; distinct
  -- from business_contexts, which can carry multiple simultaneous tags.
  product            TEXT,
  status             TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed','informal','signed','expired')),
  -- Array of {key, label, value, required} -- the proven Living OS
  -- ProposalDealVariable[] shape, unchanged.
  terms              JSONB NOT NULL DEFAULT '[]'::jsonb,
  agreed_at          DATE,
  effective_from     DATE,
  effective_until    DATE,
  -- Optional link to an uploaded/external signed contract. The entire
  -- "formal agreement" story in V1 -- no e-signature, no Agreement object.
  document_url       TEXT,
  notes              TEXT,
  -- Real attribution using this repo's actual admin auth. Always set from
  -- the authenticated session server-side -- never accepted from a client
  -- request body (Phase 3C §5).
  created_by         UUID REFERENCES public.admin_users(user_id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_deals_business_contexts_nonempty CHECK (cardinality(business_contexts) > 0),
  -- Composite-unique target required for proposals' composite FK below.
  CONSTRAINT partner_deals_id_partner_uniq UNIQUE (id, partner_id),
  -- THE Partner <-> Location integrity fix: when location_id is set, the
  -- referenced partner_locations row MUST belong to the same partner_id.
  -- NULL location_id bypasses the check entirely (Postgres default MATCH
  -- SIMPLE: any NULL column in a multi-column FK exempts that row). No ON
  -- DELETE action is specified (defaults to NO ACTION) -- a
  -- partner_locations row still referenced by a deal cannot be
  -- hard-deleted; retire it via is_active = false instead.
  CONSTRAINT partner_deals_location_partner_fkey
    FOREIGN KEY (location_id, partner_id) REFERENCES public.partner_locations (id, partner_id)
);

COMMENT ON TABLE public.partner_deals IS
  'SNX Phase 3C — real or in-progress commercial/operational terms with a Partner, tagged with business_contexts. Also the lightweight substitute for a formal Agreement object (status/agreed_at/document_url/notes) -- Phase 3B §6 Decision A: no separate Agreement table, no e-signature. Multiple concurrent signed deals for the same partner/location/context are permitted by design.';
COMMENT ON COLUMN public.partner_deals.business_contexts IS
  'One or more SNX business/venture context tags. Shape-only CHECK (non-empty); values are NOT constrained by a DB enum -- validated by an application-layer allow-list so new contexts never need a migration.';
COMMENT ON CONSTRAINT partner_deals_location_partner_fkey ON public.partner_deals IS
  'Enforces that a Deal''s Location, when set, belongs to the same Partner as the Deal itself. NULL location_id is exempt (MATCH SIMPLE).';

CREATE INDEX IF NOT EXISTS idx_partner_deals_partner_id ON public.partner_deals (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_deals_location_id ON public.partner_deals (location_id);
CREATE INDEX IF NOT EXISTS idx_partner_deals_business_contexts_gin ON public.partner_deals USING GIN (business_contexts);
CREATE INDEX IF NOT EXISTS idx_partner_deals_status ON public.partner_deals (status);
CREATE INDEX IF NOT EXISTS idx_partner_deals_created_by ON public.partner_deals (created_by);

-- ── PROPOSALS ────────────────────────────────────────────────
-- Lifecycle (corrected, this revision):
--
--   Working Draft  (version IS NULL)
--     -- freely, repeatedly editable in place: manual edits, AI/deterministic
--     -- regeneration, Request Changes, deal-term changes, context/title/
--     -- business-context edits. NONE of this ever touches `version` -- it
--     -- is the same row, same id, throughout the entire drafting phase.
--   -- Finalize & Generate PDF (one atomic application-level operation,
--   -- not built in this migration -- see proposals_lifecycle_invariant
--   -- below for the invariant the database enforces on it) -->
--   Finalized Version  (version IS NOT NULL, permanently frozen)
--     -- version is assigned exactly once, together with approved_content,
--     -- approved_at, approved_by, pdf_storage_path, and pdf_generated_at,
--     -- all in the SAME UPDATE statement. A numbered version without its
--     -- PDF can never exist, not even momentarily (enforced by a CHECK
--     -- constraint evaluated on every INSERT/UPDATE, not by application
--     -- discipline).
--
-- "Create New Draft from V1" starts a NEW row: same series_id, a fresh
-- version = NULL, seeded from V1's frozen content. Flat, one row per
-- Working-Draft-or-Finalized-Version -- NOT split into a parent/child
-- proposals+proposal_versions structure. series_id is the stable lineage
-- identifier shared by every draft/version of one proposal "line".
CREATE TABLE public.proposals (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id                 UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  -- NULL = drafted without a formal Deal row yet (Living OS itself allows
  -- this); the V1 operator UI is expected to always create/select a Deal
  -- first in practice, but the schema does not force it.
  deal_id                    UUID,
  -- Stable lineage identifier: one series_id per proposal "line", shared by
  -- every draft/version of it. NO DEFAULT -- always supplied explicitly by
  -- the application (a new UUID on the very first Working Draft; the SAME
  -- series_id, copied from the version being branched, on "Create New Draft
  -- from V1").
  series_id                  UUID NOT NULL,
  -- NULL = Working Draft, no formal version exists yet. Assigned exactly
  -- once, atomically, by Finalize & Generate PDF -- never at row creation,
  -- never incremented by any editing action. No default: the application
  -- always explicitly leaves this NULL when creating a fresh draft.
  version                    INTEGER,
  -- Optimistic-concurrency token for the Working Draft phase. Auto-
  -- incremented by the dedicated bump_proposal_draft_revision trigger
  -- (below) on every genuine draft edit. Frozen forever once version is
  -- assigned -- included in enforce_proposal_freeze's immutable field list,
  -- so a finalized row's draft_revision permanently records exactly which
  -- edit produced it. Finalize's application code is expected to capture
  -- this value at the start of rendering and condition its final UPDATE on
  -- it still matching -- see the migration header and the Phase 3C
  -- correction thread for the full algorithm; this schema only makes that
  -- possible, it does not implement it.
  draft_revision              INTEGER NOT NULL DEFAULT 1,
  business_contexts           TEXT[] NOT NULL,
  product                     TEXT,
  title                       TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','approved','exported','sent','archived')),
  -- Stamped versions of the framework/standard/profile used to write THIS
  -- row's current content -- so a later framework edit never silently
  -- rewrites an old draft or finalized version.
  framework_version            TEXT NOT NULL,
  writing_standard_version     TEXT,
  product_profile_version      TEXT,
  proposal_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  -- The deal variables actually reflected in the current draft content --
  -- frozen forever once finalized, even if partner_deals.terms changes
  -- later.
  deal_terms_snapshot          JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_for_proposal         TEXT,
  writing_direction            TEXT,
  -- Preserved capability: writer_mode = 'ai' | 'deterministic'. Phase 3C
  -- connects NO hosted AI provider -- every proposal drafted in this phase
  -- will carry mode = 'deterministic'. The column and its full value range
  -- are unchanged so a provider can be connected later with zero schema
  -- change.
  writer_mode                  TEXT CHECK (writer_mode IN ('ai','deterministic')),
  draft_content                 TEXT,
  -- Frozen at finalization -- never mutated after (enforced below by the
  -- freeze trigger, not just application logic). Populated together with
  -- version, approved_at, approved_by, pdf_storage_path, and
  -- pdf_generated_at in the same Finalize UPDATE -- see
  -- proposals_lifecycle_invariant.
  approved_content              TEXT,
  approved_at                   TIMESTAMPTZ,
  -- Real human attribution at the moment of finalization. Always set from
  -- the authenticated session server-side -- never accepted from a client
  -- request body, never a system/AI actor (Phase 3C §5).
  approved_by                   UUID REFERENCES public.admin_users(user_id),
  -- Write-once durable PDF pointer + timestamp: a Storage object path,
  -- never a permanent URL. Populated exactly once, together with version
  -- and the approved_* fields, inside the single atomic Finalize UPDATE --
  -- and immutable forever after that (Phase 3C correction: since approval
  -- and PDF generation are no longer two separate steps, there is no
  -- longer any reason for these two fields to stay mutable post-freeze --
  -- both are now in enforce_proposal_freeze's immutable field list). Any
  -- new PDF requires a new Working Draft -> new Finalized Version, never an
  -- overwrite of an existing one.
  --
  -- Canonical path convention (rev. 3):
  -- {partner_id}/{series_id}/{proposal_id}/r{draft_revision}.pdf -- keyed
  -- on BOTH this row's own stable id (known from the moment the Working
  -- Draft is created) AND the exact draft_revision that produced this
  -- render, NOT on version -- because the PDF is rendered and uploaded to
  -- Storage BEFORE a version number is assigned (Storage and Postgres do
  -- not share a transaction; the safe order is upload first, then the one
  -- atomic Postgres write that only proceeds if nothing else already
  -- finalized or edited this draft out from under it). Keying on
  -- draft_revision as well as id removes the ambiguity a purely
  -- id-keyed path would have had: a retry against a draft that is STILL at
  -- the same captured revision targets the exact same rXX.pdf object (safe
  -- to reuse as-is -- content produced from an unchanged revision is always
  -- the same render, so no overwrite is ever needed, and none is
  -- performed); a retry after the draft has moved to a NEW revision targets
  -- a different rYY.pdf path, and the old rXX.pdf simply becomes an
  -- unreferenced, permanently-orphaned object -- never reused, never
  -- pointed to by any row, safe to garbage-collect later (out of scope for
  -- this migration).
  pdf_storage_path               TEXT,
  pdf_generated_at               TIMESTAMPTZ,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proposals_business_contexts_nonempty CHECK (cardinality(business_contexts) > 0),
  -- THE Draft/Finalized lifecycle invariant (Phase 3C rev. 3 correction --
  -- supersedes and strictly broadens the earlier proposals_finalization_
  -- requires_pdf, which only checked the PDF fields and said nothing about
  -- status). Exactly two shapes are valid for this row, and no other
  -- combination of version/status/approval/PDF fields is possible:
  --   * Working Draft:    version IS NULL,     status IN ('draft','review')
  --   * Finalized Version: version IS NOT NULL AND version > 0,
  --                        status IN ('approved','exported','sent','archived'),
  --                        AND approved_content/approved_at/approved_by/
  --                        pdf_storage_path/pdf_generated_at all NOT NULL.
  -- This rejects, at the database level, exactly the contradictory
  -- combinations named in the correction request -- e.g. version = 1 with
  -- status = 'draft', or version IS NULL with status = 'sent' -- neither
  -- branch above admits them, so the whole CHECK fails.
  --
  -- Evaluated by Postgres on every INSERT and every UPDATE (unlike
  -- enforce_proposal_freeze, a trigger, which only fires on UPDATE and so
  -- can never protect against a row being created already in an invalid
  -- shape). There is no momentary window, on any code path, where a
  -- numbered version can exist without its finalized content and PDF, or
  -- where a draft can carry a "finalized" status without ever having been
  -- finalized.
  CONSTRAINT proposals_lifecycle_invariant CHECK (
    (
      version IS NULL
      AND status IN ('draft','review')
    )
    OR (
      version IS NOT NULL
      AND version > 0
      AND status IN ('approved','exported','sent','archived')
      AND approved_content IS NOT NULL
      AND approved_at IS NOT NULL
      AND approved_by IS NOT NULL
      AND pdf_storage_path IS NOT NULL
      AND pdf_generated_at IS NOT NULL
    )
  ),
  -- Enforced identity of "which numbered version of which line" -- still
  -- meaningful for the non-null (finalized) rows despite version now being
  -- nullable: Postgres treats every NULL as distinct from every other NULL
  -- for uniqueness purposes, so this constraint alone does NOT prevent two
  -- concurrent Working Drafts in the same series -- that's what the
  -- separate partial unique index below is for.
  CONSTRAINT proposals_series_version_uniq UNIQUE (series_id, version),
  -- THE Partner <-> Deal <-> Proposal integrity fix: when deal_id is set,
  -- the referenced partner_deals row MUST belong to the same partner_id as
  -- this proposal. NULL deal_id bypasses the check (MATCH SIMPLE). No ON
  -- DELETE action is specified (NO ACTION) -- a Deal still referenced by a
  -- Proposal cannot be hard-deleted; retire it via status = 'expired'
  -- instead.
  CONSTRAINT proposals_deal_partner_fkey
    FOREIGN KEY (deal_id, partner_id) REFERENCES public.partner_deals (id, partner_id)
);

COMMENT ON TABLE public.proposals IS
  'SNX Phase 3C — a Working Draft (version IS NULL, freely mutable) or a permanently frozen Finalized Version (version IS NOT NULL). One row per draft-or-version (flat, no parent/child split); series_id links every draft/version of one proposal "line" together, version numbers only the finalized ones. See enforce_proposal_freeze and proposals_lifecycle_invariant below.';
COMMENT ON COLUMN public.proposals.series_id IS
  'Stable lineage identifier shared by every Working Draft and Finalized Version of one proposal "line". No DEFAULT -- always supplied by the application. UNIQUE together with version (for non-null version values -- see the partial unique index for at-most-one-open-draft enforcement).';
COMMENT ON COLUMN public.proposals.version IS
  'NULL = Working Draft, not yet finalized. Non-null = a permanently frozen Finalized Version, assigned exactly once by Finalize & Generate PDF together with the approved_*/pdf_* fields -- never assigned at row creation, never incremented by any editing action.';
COMMENT ON COLUMN public.proposals.draft_revision IS
  'Optimistic-concurrency token for the Working Draft phase, auto-incremented by bump_proposal_draft_revision on every genuine draft edit. Frozen forever once version is assigned. Finalize is expected to capture this value before rendering the PDF and condition its final UPDATE on it still matching, so a mid-render/upload edit cannot be frozen against a stale PDF.';
COMMENT ON COLUMN public.proposals.writer_mode IS
  'ai | deterministic. Phase 3C connects no hosted AI provider -- every row created in this phase will be deterministic. Preserved unchanged for a future provider connection.';
COMMENT ON COLUMN public.proposals.pdf_storage_path IS
  'Path of the object inside the proposal-pdfs Storage bucket: {partner_id}/{series_id}/{proposal_id}/r{draft_revision}.pdf -- keyed on this row''s own id AND the exact draft_revision that produced this render, not on version, because the PDF is uploaded to Storage BEFORE a version number is assigned. A retry at the same (unchanged) revision reuses the existing rXX.pdf object; a retry at a new revision uploads to a new rYY.pdf path, leaving the old one a harmless, permanently unreferenced orphan. Canonical identifier -- a signed URL is always derived from this at read time, never persisted. Write-once: populated exactly once by the Finalize UPDATE, immutable forever after (see enforce_proposal_freeze) -- a new PDF always means a new Working Draft and a new Finalized Version, never an overwrite.';
COMMENT ON CONSTRAINT proposals_deal_partner_fkey ON public.proposals IS
  'Enforces that a Proposal''s Deal, when set, belongs to the same Partner as the Proposal itself. NULL deal_id is exempt (MATCH SIMPLE).';
COMMENT ON CONSTRAINT proposals_lifecycle_invariant ON public.proposals IS
  'Exactly two valid shapes: Working Draft (version IS NULL, status IN (draft,review)) or Finalized Version (version IS NOT NULL AND version > 0, status IN (approved,exported,sent,archived), with approved content/actor/time and PDF metadata all present). Rejects contradictory combinations such as version=1 with status=draft, or version IS NULL with status=sent. Evaluated on INSERT and UPDATE alike, unlike the freeze trigger which only fires on UPDATE.';

CREATE INDEX IF NOT EXISTS idx_proposals_partner_id ON public.proposals (partner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_deal_id ON public.proposals (deal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_business_contexts_gin ON public.proposals USING GIN (business_contexts);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_approved_by ON public.proposals (approved_by);

-- THE at-most-one-open-Working-Draft-per-series enforcement. A plain
-- UNIQUE(series_id, version) does NOT achieve this on its own, because
-- Postgres treats every NULL version as distinct from every other NULL for
-- uniqueness purposes -- without this partial index, nothing would stop two
-- concurrent Working Draft rows existing for the same series. This index
-- only ever applies to version IS NULL rows; it says nothing about, and
-- does not duplicate, proposals_series_version_uniq above.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_one_draft_per_series
  ON public.proposals (series_id)
  WHERE version IS NULL;

COMMENT ON INDEX public.idx_proposals_one_draft_per_series IS
  'At most one Working Draft (version IS NULL) may exist per series_id at a time. "Create New Draft from V1" (or any other finalized version) is blocked at the database level while an open draft already exists for that series.';

-- ============================================================
-- Row Level Security — enabled, ZERO policies, on all five new tables.
-- Identical posture to bookings/event_dates/expenses/ota_bookings/products.
-- Only service_role (BYPASSRLS) can read/write -- exactly how every
-- /operator server-component and /api/admin/* route already accesses data.
-- ============================================================
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- updated_at triggers — REUSE the existing shared public.set_updated_at()
-- function (created in 20260819000001_phase4a_auth_rls.sql, already live).
-- This migration does NOT define, replace, or drop that function -- it is
-- pre-existing shared infrastructure, only referenced here.
-- ============================================================
DROP TRIGGER IF EXISTS partners_set_updated_at ON public.partners;
CREATE TRIGGER partners_set_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS partner_contacts_set_updated_at ON public.partner_contacts;
CREATE TRIGGER partner_contacts_set_updated_at
  BEFORE UPDATE ON public.partner_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS partner_locations_set_updated_at ON public.partner_locations;
CREATE TRIGGER partner_locations_set_updated_at
  BEFORE UPDATE ON public.partner_locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS partner_deals_set_updated_at ON public.partner_deals;
CREATE TRIGGER partner_deals_set_updated_at
  BEFORE UPDATE ON public.partner_deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS proposals_set_updated_at ON public.proposals;
CREATE TRIGGER proposals_set_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Draft revision bump — NEW function, feature-owned. Auto-advances the
-- optimistic-concurrency token on every genuine Working Draft edit, so
-- Finalize's application code never has to remember to do it manually.
--
-- TRIGGER ORDERING (BEFORE UPDATE triggers on the same table fire in
-- alphabetical order by trigger name in Postgres): this migration produces
-- proposals_bump_draft_revision, proposals_enforce_freeze,
-- proposals_set_updated_at, in that alphabetical order. This happens to be
-- a safe order, but the three are ALSO independently safe regardless of
-- relative order, because their guard conditions are mutually exclusive by
-- construction:
--   * bump_proposal_draft_revision only ever changes NEW.draft_revision
--     when OLD.version IS NULL AND NEW.version IS NULL (a real draft-to-
--     draft edit). It is a no-op on the Finalize transition itself (NEW.
--     version becomes non-null) and a no-op on any update to an
--     already-frozen row (OLD.version IS NOT NULL).
--   * enforce_proposal_freeze only restricts anything when OLD.version IS
--     NOT NULL (the row was ALREADY frozen before this statement). It never
--     restricts a draft-to-draft edit, and never restricts the transition
--     INTO frozen (that transition is exactly what it's designed to allow
--     unrestricted, once).
--   * set_updated_at only ever touches NEW.updated_at, which is excluded
--     from every other check.
-- Net effect: on a routine draft edit, only the bump fires (increments
-- draft_revision); on the Finalize transition, neither the bump nor the
-- freeze trigger restrict anything, and draft_revision ends up exactly
-- equal to whatever the application's conditional UPDATE required it to
-- be (the captured pre-finalization value) -- never one higher; on any
-- update to an already-frozen row, only status (forward-only) and
-- updated_at can change, everything else -- including draft_revision -- is
-- rejected by enforce_proposal_freeze.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_proposal_draft_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF OLD.version IS NULL AND NEW.version IS NULL THEN
    NEW.draft_revision := OLD.draft_revision + 1;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.bump_proposal_draft_revision() IS
  'SNX Phase 3C — feature-owned trigger function (NOT shared infrastructure). Auto-advances proposals.draft_revision on every genuine Working Draft edit (OLD.version IS NULL AND NEW.version IS NULL). No-op on the Finalize transition and on any update to an already-frozen row. Safe to drop on a Phase 3C rollback.';

DROP TRIGGER IF EXISTS proposals_bump_draft_revision ON public.proposals;
CREATE TRIGGER proposals_bump_draft_revision
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.bump_proposal_draft_revision();

-- ============================================================
-- Proposal freeze — NEW function, feature-owned (not shared
-- infrastructure). A proposal version is permanently frozen once it has a
-- version number (version IS NOT NULL) -- no longer keyed to the status
-- list. Once frozen, every substantive field (now including draft_revision
-- and the PDF metadata pair -- see below) is immutable forever; only status
-- (forward-only within the frozen lifecycle, plus archived as terminal
-- housekeeping from any frozen state) and updated_at may still change. This
-- is defense in depth alongside the application-layer checks -- a bug in
-- the API layer can never silently rewrite a frozen version.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_proposal_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  allowed_forward TEXT[];
BEGIN
  IF OLD.version IS NOT NULL THEN
    -- Substantive fields, including draft_revision and the PDF metadata
    -- pair (Phase 3C correction: PDF metadata is written once, in the same
    -- atomic UPDATE that assigns version, so there is no longer any reason
    -- for it to stay mutable afterward -- any new PDF requires a new
    -- Working Draft and a new Finalized Version, never an overwrite).
    IF NEW.partner_id                 IS DISTINCT FROM OLD.partner_id
      OR NEW.deal_id                  IS DISTINCT FROM OLD.deal_id
      OR NEW.series_id                IS DISTINCT FROM OLD.series_id
      OR NEW.version                  IS DISTINCT FROM OLD.version
      OR NEW.draft_revision           IS DISTINCT FROM OLD.draft_revision
      OR NEW.business_contexts        IS DISTINCT FROM OLD.business_contexts
      OR NEW.product                  IS DISTINCT FROM OLD.product
      OR NEW.title                    IS DISTINCT FROM OLD.title
      OR NEW.framework_version        IS DISTINCT FROM OLD.framework_version
      OR NEW.writing_standard_version IS DISTINCT FROM OLD.writing_standard_version
      OR NEW.product_profile_version  IS DISTINCT FROM OLD.product_profile_version
      OR NEW.proposal_date            IS DISTINCT FROM OLD.proposal_date
      OR NEW.deal_terms_snapshot      IS DISTINCT FROM OLD.deal_terms_snapshot
      OR NEW.context_for_proposal     IS DISTINCT FROM OLD.context_for_proposal
      OR NEW.writing_direction        IS DISTINCT FROM OLD.writing_direction
      OR NEW.draft_content            IS DISTINCT FROM OLD.draft_content
      OR NEW.approved_content         IS DISTINCT FROM OLD.approved_content
      OR NEW.approved_at              IS DISTINCT FROM OLD.approved_at
      OR NEW.approved_by              IS DISTINCT FROM OLD.approved_by
      OR NEW.pdf_storage_path         IS DISTINCT FROM OLD.pdf_storage_path
      OR NEW.pdf_generated_at         IS DISTINCT FROM OLD.pdf_generated_at
    THEN
      RAISE EXCEPTION
        'proposals: version % of series % is finalized and permanently frozen — substantive fields (including PDF metadata) are immutable. Start a new Working Draft (Create New Draft) to keep editing.',
        OLD.version, OLD.series_id;
    END IF;

    -- status: forward-only within the frozen lifecycle, plus 'archived'
    -- reachable from any frozen status as terminal housekeeping. Never
    -- backward, never skipped to a non-frozen status. A finalized/archived
    -- row remains frozen forever -- there is no path back out of this
    -- IF OLD.version IS NOT NULL branch for this row, ever.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      allowed_forward := CASE OLD.status
        WHEN 'approved' THEN ARRAY['exported','sent','archived']
        WHEN 'exported' THEN ARRAY['sent','archived']
        WHEN 'sent'     THEN ARRAY['archived']
        WHEN 'archived' THEN ARRAY[]::TEXT[]
        ELSE ARRAY[]::TEXT[]
      END;
      IF NOT (NEW.status = ANY (allowed_forward)) THEN
        RAISE EXCEPTION
          'proposals: status cannot move from % to % — a frozen version may only advance forward (approved → exported → sent) or to archived, never backward.',
          OLD.status, NEW.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.enforce_proposal_freeze() IS
  'SNX Phase 3C — feature-owned trigger function (NOT shared infrastructure like set_updated_at). Engages whenever OLD.version IS NOT NULL (permanently frozen, not keyed to the status list). Immutable: partner_id, deal_id, series_id, version, draft_revision, business_contexts, product, title, framework/writing/profile versions, proposal_date, deal_terms_snapshot, context_for_proposal, writing_direction, draft_content, approved_content, approved_at, approved_by, pdf_storage_path, pdf_generated_at. Mutable: status (forward-only, plus archived from any frozen state), updated_at. Safe to drop on a Phase 3C rollback; nothing outside this feature references it.';

DROP TRIGGER IF EXISTS proposals_enforce_freeze ON public.proposals;
CREATE TRIGGER proposals_enforce_freeze
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_freeze();
