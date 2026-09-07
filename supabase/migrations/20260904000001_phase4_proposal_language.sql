-- ============================================================
-- Phase 4 — Proposal Language
-- ============================================================
-- Adds one new Proposal-level field so the Venue/Nightlife Proposal Profile
-- can compose a Working Draft in English or Thai. Language is a property of
-- the Proposal/document, never of the Deal -- partner_deals.terms stays
-- language-neutral, entered once, and is never touched by this migration.
--
-- Not overloaded onto an existing column: business_contexts is a venture/
-- brand tag array unrelated to document language; product_profile_version
-- identifies which structural template version composed the draft
-- (independently bumpable from language); writing_standard_version
-- identifies the shared SNX tone/rules module version, which applies to
-- both languages equally. None of the three is a language signal, so a new
-- column is the correct, minimal shape -- matching the plain CHECK-column
-- pattern already used for proposals.status/writer_mode on this same table.
--
-- Pre-migration state confirmed live against project oomhftxgvikzxlvqdcmr
-- immediately before writing this file: 9 rows in public.proposals (4
-- already Finalized Versions with version IS NOT NULL), 6 partner_deals, 3
-- partners -- all disposable QA/manual-test data from Phase 3D-3H and this
-- session's own Nightlife Profile testing, not real partner data. Unlike
-- Phase 3G's equivalent note, this is NOT "0 rows, no backfill needed" --
-- there IS existing data, but `ADD COLUMN ... NOT NULL DEFAULT 'en'` needs
-- no separate backfill step: Postgres (11+; this project runs 17) applies a
-- constant DEFAULT to every existing row as part of the same metadata-only
-- ALTER TABLE, no full table rewrite, so all 9 existing rows become
-- language = 'en' atomically with the column's creation -- exactly the
-- "existing proposals remain English" requirement, satisfied by the
-- database itself rather than an application-layer migration script.
-- ============================================================

-- ── proposals.language ───────────────────────────────────────
ALTER TABLE public.proposals
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_language_check
  CHECK (language IN ('en', 'th'));

COMMENT ON COLUMN public.proposals.language IS
  'Which language this Proposal''s composed content is written in: en (default) | th. A Proposal/document property only -- partner_deals stays language-neutral. Set once at creation (createProposal), carried forward unchanged by createDraftFromFinalizedVersion, never changed by regenerateProposalDraft/requestProposalChanges, and permanently frozen once version IS NOT NULL (enforce_proposal_freeze, updated below).';

-- ── enforce_proposal_freeze() ────────────────────────────────
-- Same function, same immutable-fields/status-transition/accepted_at
-- structure as Phase 3G (unchanged in every other respect) -- language is
-- added to the substantive-fields immutable list on the same basis as
-- product_profile_version: a structural/compositional property fixed at
-- draft-creation time, never legitimately mutated once a version is
-- assigned. Nothing in the application ever attempts to change language on
-- an existing row today (no such UI/action exists -- see the file header),
-- so this is a defense-in-depth addition matching established convention,
-- not a fix for an app-layer gap that currently exists.
CREATE OR REPLACE FUNCTION public.enforce_proposal_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  allowed_forward TEXT[];
BEGIN
  IF OLD.version IS NOT NULL THEN
    -- Substantive fields, Phase 3G list plus language -- immutable forever
    -- once frozen. accepted_at is intentionally absent from this list; see
    -- its own block below.
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
      OR NEW.language                 IS DISTINCT FROM OLD.language
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

    -- status: forward-only within the frozen lifecycle (Phase 3G,
    -- unchanged): finalized -> sent -> accepted, or -> archived from any of
    -- those, never backward.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      allowed_forward := CASE OLD.status
        WHEN 'finalized' THEN ARRAY['sent','archived']
        WHEN 'sent'      THEN ARRAY['accepted','archived']
        WHEN 'accepted'  THEN ARRAY['archived']
        WHEN 'archived'  THEN ARRAY[]::TEXT[]
        ELSE ARRAY[]::TEXT[]
      END;
      IF NOT (NEW.status = ANY (allowed_forward)) THEN
        RAISE EXCEPTION
          'proposals: status cannot move from % to % — a frozen version may only advance forward (finalized → sent → accepted) or to archived, never backward.',
          OLD.status, NEW.status;
      END IF;
    END IF;

    -- accepted_at: write-once, and only as the exact sent -> accepted
    -- transition (Phase 3G, unchanged).
    IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
      IF OLD.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION
          'proposals: accepted_at is write-once and permanently immutable once set (version % of series %).',
          OLD.version, OLD.series_id;
      END IF;
      IF NOT (OLD.status = 'sent' AND NEW.status = 'accepted' AND NEW.accepted_at IS NOT NULL) THEN
        RAISE EXCEPTION
          'proposals: accepted_at may only be set exactly once, as part of the sent → accepted status transition (version % of series %).',
          OLD.version, OLD.series_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.enforce_proposal_freeze() IS
  'SNX Phase 3C/3G/4 — feature-owned trigger function (NOT shared infrastructure like set_updated_at). Engages whenever OLD.version IS NOT NULL. Immutable forever: partner_id, deal_id, series_id, version, draft_revision, business_contexts, product, title, framework/writing/profile versions, language, proposal_date, deal_terms_snapshot, context_for_proposal, writing_direction, draft_content, approved_content, approved_at, approved_by, pdf_storage_path, pdf_generated_at. status: forward-only (finalized→sent→accepted, or →archived from any of those). accepted_at: write-once, settable only as the exact sent→accepted transition, then permanently immutable (including through accepted→archived, which must preserve it unchanged). updated_at: freely mutable (set_updated_at). Safe to drop on a Phase 3C/3G/4 rollback; nothing outside this feature references it.';

-- ============================================================
-- Explicitly NOT touched by this migration:
--   - partner_deals (no column added -- Deal terms stay language-neutral,
--     per the approved architecture).
--   - proposals_lifecycle_invariant (no change needed: language is
--     unconditionally NOT NULL on every row regardless of draft/finalized
--     shape, unlike deal_id/approved_content/etc. which are only required
--     in the finalized shape -- so it needs no clause in that two-shape
--     constraint).
--   - Storage bucket / RLS / any other table.
-- ============================================================
