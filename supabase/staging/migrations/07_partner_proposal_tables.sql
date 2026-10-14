-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "partner_proposal_tables".
-- Source: see supabase/staging/README.md. Do not run against production.
CREATE TABLE public.partners (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name         TEXT NOT NULL,
  legal_name           TEXT,
  aliases              TEXT[],
  organization_type    TEXT
    CHECK (organization_type IN ('hospitality-group','venue','brand','agency','individual','other')),
  relationship_status  TEXT NOT NULL DEFAULT 'prospect'
    CHECK (relationship_status IN ('prospect','in-conversation','proposal-pending','active','paused','archived')),
  relationship_owner   UUID REFERENCES public.admin_users(user_id),
  relationship_summary TEXT,
  review_date          DATE,
  next_action          TEXT,
  relationship_notes   JSONB NOT NULL DEFAULT '[]'::jsonb,
  files                JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_partners_display_name_lower ON public.partners (lower(display_name));
CREATE INDEX IF NOT EXISTS idx_partners_aliases_gin ON public.partners USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_partners_relationship_owner ON public.partners (relationship_owner);
CREATE INDEX IF NOT EXISTS idx_partners_relationship_status ON public.partners (relationship_status);
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
CREATE INDEX IF NOT EXISTS idx_partner_contacts_partner_id ON public.partner_contacts (partner_id);
CREATE TABLE public.partner_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_locations_partner_name_uniq UNIQUE (partner_id, name),
  CONSTRAINT partner_locations_id_partner_uniq UNIQUE (id, partner_id)
);
CREATE TABLE public.partner_deals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id         UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  location_id        UUID,
  business_contexts  TEXT[] NOT NULL,
  product            TEXT,
  status             TEXT NOT NULL DEFAULT 'proposed',
  terms              JSONB NOT NULL DEFAULT '[]'::jsonb,
  agreed_at          DATE,
  effective_from     DATE,
  effective_until    DATE,
  document_url       TEXT,
  notes              TEXT,
  created_by         UUID REFERENCES public.admin_users(user_id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_deals_business_contexts_nonempty CHECK (cardinality(business_contexts) > 0),
  CONSTRAINT partner_deals_id_partner_uniq UNIQUE (id, partner_id),
  CONSTRAINT partner_deals_location_partner_fkey
    FOREIGN KEY (location_id, partner_id) REFERENCES public.partner_locations (id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_partner_deals_partner_id ON public.partner_deals (partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_deals_location_id ON public.partner_deals (location_id);
CREATE INDEX IF NOT EXISTS idx_partner_deals_business_contexts_gin ON public.partner_deals USING GIN (business_contexts);
CREATE INDEX IF NOT EXISTS idx_partner_deals_status ON public.partner_deals (status);
CREATE INDEX IF NOT EXISTS idx_partner_deals_created_by ON public.partner_deals (created_by);
CREATE TABLE public.proposals (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id                 UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  deal_id                    UUID,
  series_id                  UUID NOT NULL,
  version                    INTEGER,
  draft_revision              INTEGER NOT NULL DEFAULT 1,
  business_contexts           TEXT[] NOT NULL,
  product                     TEXT,
  title                       TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'draft',
  framework_version            TEXT NOT NULL,
  writing_standard_version     TEXT,
  product_profile_version      TEXT,
  proposal_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  deal_terms_snapshot          JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_for_proposal         TEXT,
  writing_direction            TEXT,
  writer_mode                  TEXT CHECK (writer_mode IN ('ai','deterministic')),
  draft_content                 TEXT,
  approved_content              TEXT,
  approved_at                   TIMESTAMPTZ,
  approved_by                   UUID REFERENCES public.admin_users(user_id),
  pdf_storage_path               TEXT,
  pdf_generated_at               TIMESTAMPTZ,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proposals_business_contexts_nonempty CHECK (cardinality(business_contexts) > 0),
  CONSTRAINT proposals_series_version_uniq UNIQUE (series_id, version),
  CONSTRAINT proposals_deal_partner_fkey
    FOREIGN KEY (deal_id, partner_id) REFERENCES public.partner_deals (id, partner_id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_partner_id ON public.proposals (partner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_deal_id ON public.proposals (deal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_business_contexts_gin ON public.proposals USING GIN (business_contexts);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals (status);
CREATE INDEX IF NOT EXISTS idx_proposals_approved_by ON public.proposals (approved_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_one_draft_per_series
  ON public.proposals (series_id)
  WHERE version IS NULL;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER partners_set_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER partner_contacts_set_updated_at
  BEFORE UPDATE ON public.partner_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER partner_locations_set_updated_at
  BEFORE UPDATE ON public.partner_locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER partner_deals_set_updated_at
  BEFORE UPDATE ON public.partner_deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER proposals_set_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
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
CREATE TRIGGER proposals_bump_draft_revision
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.bump_proposal_draft_revision();
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proposal-pdfs', 'proposal-pdfs', false, 10485760, ARRAY['application/pdf']);
