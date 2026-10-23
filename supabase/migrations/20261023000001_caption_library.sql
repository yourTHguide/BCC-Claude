-- ============================================================
-- Caption Library — Bangkok Club Crawl Instagram caption inventory.
-- ============================================================
-- Single home for captions shared by the SNX Operator (/operator/create/
-- captions) and Living OS (livingos://best-nightlife/creative-studio/
-- social-floor/caption-library). Additive only: one new table, nothing
-- existing is touched. Service-role only, same convention as every other
-- operator table: RLS on with no policies, so the anon key can neither read
-- nor write it; all access goes through requireRole()-gated API routes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.captions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id  TEXT NOT NULL DEFAULT 'best-nightlife',
  city_id     TEXT NOT NULL DEFAULT 'bangkok',
  product_id  TEXT NOT NULL DEFAULT 'bangkok-club-crawl',
  category_id TEXT NOT NULL
    CHECK (category_id IN ('funny','connection','classy','party','solo','host','recap','promotional')),
  text        TEXT NOT NULL CHECK (char_length(btrim(text)) >= 8),
  status      TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','used')),
  source      TEXT NOT NULL DEFAULT 'generated' CHECK (source IN ('generated','imported','manual')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at     TIMESTAMPTZ,
  CONSTRAINT captions_used_at_matches_status CHECK ((status = 'used') = (used_at IS NOT NULL)),
  CONSTRAINT captions_scope_text_unique UNIQUE (venture_id, city_id, product_id, text)
);

CREATE INDEX IF NOT EXISTS idx_captions_scope_status_category
  ON public.captions (venture_id, city_id, product_id, status, category_id, created_at DESC);

ALTER TABLE public.captions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.captions IS
  'Caption Library inventory (BEST Nightlife / Bangkok / Bangkok Club Crawl). Service-role only. Shared by SNX Operator and Living OS.';
