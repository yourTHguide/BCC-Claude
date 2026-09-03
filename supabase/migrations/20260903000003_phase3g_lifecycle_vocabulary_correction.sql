-- ============================================================
-- Phase 3G — Partnership Lifecycle Vocabulary Correction
-- ============================================================
-- Corrects partner_deals.status and proposals.status to match the real
-- SNX partnership workflow (verbal/WhatsApp/email-agreed small partners,
-- through to fully formal Proposal->PDF->Sent->Accepted hospitality-group
-- partnerships), per the architecture reassessment approved 2026-09-03.
-- Purely a vocabulary correction on the five Phase 3C-1 tables -- no new
-- table (no Opportunity table, no Agreement table), no new FK, no index
-- change, no RLS change. "Opportunity" and "Idea/Discussing" are NOT new
-- entities: an early-stage Deal now starts life at status='discussing'
-- (this migration's new default), and a pre-specific relationship lives on
-- partners.relationship_status/next_action/relationship_notes exactly as
-- it already did -- nothing added there.
--
-- Pre-migration cleanup (already performed as its OWN explicit, reviewed,
-- non-migration action -- NOT part of this file): the 8 disposable QA
-- partners created during Phase 3D-3F manual testing (display_name
-- 'Test'/'test'/'ZZZ UI TEST PARTNER') were deleted directly, cascading to
-- their 6 partner_deals and 7 proposals rows. All five Phase 3C-1 tables
-- were confirmed at 0 rows immediately before this migration was written,
-- so nothing here requires a data backfill/transform for old status
-- values -- there is no data to transform.
-- ============================================================

-- ── proposals.accepted_at ────────────────────────────────────
-- Added FIRST, before any CHECK constraint or trigger function below that
-- references it (proposals_lifecycle_invariant, enforce_proposal_freeze) --
-- a constraint/function referencing a column that doesn't exist yet fails
-- at apply time. Nullable, no default. Populated exactly once, exactly as
-- part of the sent -> accepted status transition -- enforced below by
-- enforce_proposal_freeze(), not left as an app-layer convention. finalized
-- and sent proposals always have accepted_at = NULL; once set it is
-- permanently immutable, including through a later accepted -> archived
-- transition (which must carry the original timestamp forward unchanged).
-- Distinct in meaning from approved_at, which stamps the internal
-- finalize/freeze moment, not the partner's acceptance.
ALTER TABLE public.proposals ADD COLUMN accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.proposals.accepted_at IS
  'When the Partner accepted this Finalized Version. NULL for finalized/sent (and for archived if archived before ever being accepted). Write-once: settable only as the exact sent -> accepted transition (enforced by enforce_proposal_freeze, not just a CHECK), permanently immutable once set. Distinct from approved_at (the internal finalize/freeze moment).';

-- ── partner_deals.status ────────────────────────────────────
-- Old: proposed | informal | signed | expired
-- New: discussing | terms_agreed | active | paused | ended
--
-- 'proposed' is retired from Deal vocabulary entirely -- "Proposed" now
-- belongs only to the Proposal lifecycle (proposals.status), never the
-- Deal's. 'signed' is retired because the real workflow explicitly does
-- NOT require a signed contract (verbal/WhatsApp/email/a partner's own
-- rate sheet are all valid evidence -- see partner_deals.agreed_at/
-- document_url/notes, unchanged, still the whole "how this was agreed"
-- story). 'informal' is retired as vague. 'expired' folds into 'ended'
-- (a lapsed vs. a deliberately concluded deal are the same "no longer
-- running" state at this level of granularity).
--
-- 'discussing' is new and is the Opportunity stage: a specific commercial
-- thread (a business context / product / venue in mind) that isn't yet
-- worth calling a Deal in the "terms we can act on" sense. The default
-- changes from 'proposed' to 'discussing' to match -- a newly created Deal
-- row now starts life as "we're discussing this," not "we've proposed
-- something."
ALTER TABLE public.partner_deals DROP CONSTRAINT partner_deals_status_check;
ALTER TABLE public.partner_deals ALTER COLUMN status SET DEFAULT 'discussing';
ALTER TABLE public.partner_deals
  ADD CONSTRAINT partner_deals_status_check
  CHECK (status IN ('discussing','terms_agreed','active','paused','ended'));

COMMENT ON COLUMN public.partner_deals.status IS
  'discussing (Opportunity stage -- specific thread under discussion, no agreed terms yet) | terms_agreed (commercial/operational terms agreed sufficiently to proceed -- may be verbal/WhatsApp/email, see agreed_at/document_url/notes) | active (partnership currently operating) | paused (temporarily inactive) | ended (no longer operating). Default discussing. A Deal may move terms_agreed -> active with no Proposal ever created -- that is a first-class valid workflow, not a shortcut.';

-- ── proposals.status ─────────────────────────────────────────
-- Old: draft | review | approved | exported | sent | archived
-- New: draft | finalized | sent | accepted | archived
--
-- 'review' is dropped -- unused vocabulary; nothing in the built system
-- ever produces or reads it (createProposal/createDraftFromFinalizedVersion
-- always insert 'draft'). 'approved' and 'exported' both collapse into
-- 'finalized', which means exactly one thing: version is assigned, the PDF
-- exists, immutable -- with NO implication about whether it has been
-- delivered to the partner (that's 'sent') or whether the partner has said
-- yes (that's the new 'accepted'). This is the one genuine gap the old
-- vocabulary had: there was no status meaning "the partner accepted this."
-- 'sent' and 'archived' are unchanged in name and meaning.
ALTER TABLE public.proposals DROP CONSTRAINT proposals_status_check;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft','finalized','sent','accepted','archived'));

-- ── proposals_lifecycle_invariant ────────────────────────────
-- Same two-shape structure as before (Working Draft vs. Finalized Version),
-- just the Working Draft branch narrows from status IN ('draft','review')
-- to status = 'draft' (review retired), and the Finalized branch's status
-- list is the new vocabulary. One new clause, extending the exact same
-- "required fields present" pattern already used for approved_content/
-- approved_at/approved_by/pdf_storage_path/pdf_generated_at: whenever
-- status = 'accepted', accepted_at must be set. This does NOT require the
-- reverse (accepted_at set implies status = 'accepted') -- an archived
-- proposal that was accepted before being archived legitimately keeps its
-- original accepted_at with status now 'archived'; only enforce_proposal_
-- freeze (below) is responsible for guaranteeing that value is the exact
-- one that was set at the moment of acceptance, never a different one.
ALTER TABLE public.proposals DROP CONSTRAINT proposals_lifecycle_invariant;
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_lifecycle_invariant
  CHECK (
    (
      version IS NULL
      AND status = 'draft'
    )
    OR (
      version IS NOT NULL
      AND version > 0
      AND status IN ('finalized','sent','accepted','archived')
      AND approved_content IS NOT NULL
      AND approved_at IS NOT NULL
      AND approved_by IS NOT NULL
      AND pdf_storage_path IS NOT NULL
      AND pdf_generated_at IS NOT NULL
      AND (status <> 'accepted' OR accepted_at IS NOT NULL)
    )
  );

COMMENT ON CONSTRAINT proposals_lifecycle_invariant ON public.proposals IS
  'Exactly two valid shapes: Working Draft (version IS NULL, status = draft) or Finalized Version (version IS NOT NULL AND version > 0, status IN (finalized,sent,accepted,archived), with approved content/actor/time and PDF metadata all present, and accepted_at required whenever status = accepted). Evaluated on INSERT and UPDATE alike, unlike the freeze trigger which only fires on UPDATE.';

-- ── enforce_proposal_freeze() ────────────────────────────────
-- Same immutable-field list as before (unchanged), same forward-only
-- status transition mechanism (unchanged shape, new value set), PLUS one
-- new dedicated block for accepted_at -- deliberately NOT folded into the
-- blanket immutable-fields IF, because unlike every field in that list
-- (fixed forever the instant version is assigned), accepted_at is allowed
-- exactly one legitimate write AFTER the row is already frozen. It gets
-- the same kind of dedicated, narrower treatment `status` already has.
CREATE OR REPLACE FUNCTION public.enforce_proposal_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  allowed_forward TEXT[];
BEGIN
  IF OLD.version IS NOT NULL THEN
    -- Substantive fields, unchanged list (Phase 3C-1) -- immutable forever
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

    -- status: forward-only within the frozen lifecycle (same mechanism as
    -- Phase 3C-1, new value set): finalized -> sent -> accepted, or ->
    -- archived from any of those, never backward.
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
    -- transition. Once set (OLD.accepted_at IS NOT NULL), permanently
    -- immutable -- this is what makes accepted -> archived correctly carry
    -- the original timestamp forward: that transition doesn't touch
    -- accepted_at at all, so NEW.accepted_at = OLD.accepted_at and this
    -- whole block is skipped (not distinct, nothing to check).
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
  'SNX Phase 3C/3G — feature-owned trigger function (NOT shared infrastructure like set_updated_at). Engages whenever OLD.version IS NOT NULL. Immutable forever: partner_id, deal_id, series_id, version, draft_revision, business_contexts, product, title, framework/writing/profile versions, proposal_date, deal_terms_snapshot, context_for_proposal, writing_direction, draft_content, approved_content, approved_at, approved_by, pdf_storage_path, pdf_generated_at. status: forward-only (finalized→sent→accepted, or →archived from any of those). accepted_at: write-once, settable only as the exact sent→accepted transition, then permanently immutable (including through accepted→archived, which must preserve it unchanged). updated_at: freely mutable (set_updated_at). Safe to drop on a Phase 3C/3G rollback; nothing outside this feature references it.';

-- ============================================================
-- Explicitly NOT built in this migration (documented intent for a later
-- pass, per the approved architecture reassessment):
--   - No acceptance API/action (POST .../accept or similar) exists yet.
--     sent -> accepted is enforceable by this schema the moment such an
--     action is written, but nothing calls it today.
--   - The future acceptance action's Deal-activation boundary (documented
--     here so the intent isn't lost, NOT enforced by any trigger yet):
--     when a Proposal moves sent -> accepted, its linked partner_deals row
--     (proposals.deal_id) should move terms_agreed -> active, or be left
--     alone if already active (idempotent) -- and must NOT resurrect a
--     paused or ended Deal automatically. This is an application-layer
--     rule for that future action to implement, not a DB constraint --
--     partner_deals.status has no automatic linkage to proposals.status at
--     the schema level, by design (Proposal is not the Deal).
--   - No Agreement table, no confirmation-method enum, no e-signature
--     system -- partner_deals.agreed_at/document_url/notes remain the
--     entire lightweight evidence layer for verbal/WhatsApp/email/
--     partner-supplied-document agreements, unchanged by this migration.
-- ============================================================
