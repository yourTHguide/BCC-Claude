-- ============================================================
-- PHASE 4 · MIGRATION C — Product content (1:1) + media (1:N)
-- ============================================================
-- Intended stage: STAGE 7 (Product Content, then Media — SHOULD, after the core
-- Product/Schedule builder is proven).
-- Status: AUTHORED in Stage 0 — NOT yet applied to production (2026-08-19).
-- Depends on: Migration A (reuses the set_updated_at() trigger function).
--
-- Idempotent and ADDITIVE. Content/media are kept OUT of `products` so the
-- canonical/operational row stays lean and the booking hot path (/api/events,
-- checkout) never has to read them.
-- ============================================================

-- ── product_content (1:1 with products) ────────────────────
CREATE TABLE IF NOT EXISTS product_content (
  product_id        UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  short_description TEXT,
  full_description  TEXT,
  meeting_point     TEXT,
  duration_minutes  INTEGER,
  highlights        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of strings
  itinerary         JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of venue-stop objects
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS product_content_set_updated_at ON product_content;
CREATE TRIGGER product_content_set_updated_at
  BEFORE UPDATE ON product_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── product_media (1:N, ordered) ────────────────────────────
CREATE TABLE IF NOT EXISTS product_media (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'gallery'
    CHECK (kind IN ('cover','gallery')),
  url        TEXT NOT NULL,      -- public URL of an object in the `product-media` bucket
  alt        TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id, sort_order);

-- ── RLS ─────────────────────────────────────────────────────
-- Deny-by-default: enable RLS with NO policies (service role only). Public
-- landing pages render this content SERVER-SIDE via the service role, so no anon
-- read is required. If Stage 7 chooses client-side rendering instead, add a
-- read-only `FOR SELECT TO public USING (true)` policy at that point.
ALTER TABLE product_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- NOTE: the Supabase Storage bucket `product-media` (public-read) is created in
-- the Supabase dashboard / via API during STAGE 7b — deliberately NOT here, so
-- this migration touches only relational schema.
