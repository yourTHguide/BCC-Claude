-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "proposal_lifecycle_and_language_final".
-- Source: see supabase/staging/README.md. Do not run against production.
ALTER TABLE public.proposals ADD COLUMN accepted_at TIMESTAMPTZ;
ALTER TABLE public.partner_deals ALTER COLUMN status SET DEFAULT 'discussing';
ALTER TABLE public.partner_deals
  ADD CONSTRAINT partner_deals_status_check
  CHECK (status IN ('discussing','terms_agreed','active','paused','ended'));
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft','finalized','sent','accepted','archived'));
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
ALTER TABLE public.proposals
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_language_check
  CHECK (language IN ('en', 'th'));
CREATE OR REPLACE FUNCTION public.enforce_proposal_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  allowed_forward TEXT[];
BEGIN
  IF OLD.version IS NOT NULL THEN
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
CREATE TRIGGER proposals_enforce_freeze
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_freeze();
