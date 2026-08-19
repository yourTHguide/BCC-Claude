-- ============================================================
-- PHASE 4 · MIGRATION C (v3) — Product content (1:1) + media (1:N)
-- ============================================================
-- Depends on: Migration A (reuses the set_updated_at() trigger function,
-- search_path pinned to '' there — this migration adds no new function).
--
-- Idempotent and ADDITIVE. Content/media are kept OUT of `products` so the
-- canonical/operational row stays lean and the booking hot path (/api/events,
-- checkout) never has to read them. This migration creates two new tables
-- only — it does not alter, drop, or touch products, product_schedules,
-- event_dates, or bookings in any way.
-- ============================================================

-- ── product_content (1:1 with products) ────────────────────
CREATE TABLE IF NOT EXISTS product_content (
  product_id          UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,

  tagline              TEXT,          -- hero one-liner
  short_description    TEXT,          -- card teaser / meta description
  full_description     TEXT,          -- main body copy

  -- V1 location model: { display_name, address, maps_url, instructions,
  -- visibility }. visibility ∈ 'public' | 'after_booking' | 'private'.
  -- Default '{}' = unset (no meeting-point content yet).
  meeting_point        JSONB NOT NULL DEFAULT '{}'::jsonb,

  duration_minutes     INTEGER,

  highlights           JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]  ("why join")
  itinerary            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- { title, description }[]
  whats_included       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  whats_not_included   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  important_info       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- string[]  ("good to know")

  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT meeting_point_visibility_valid CHECK (
    NOT (meeting_point ? 'visibility')
    OR meeting_point->>'visibility' IN ('public','after_booking','private')
  )
);

DROP TRIGGER IF EXISTS product_content_set_updated_at ON product_content;
CREATE TRIGGER product_content_set_updated_at
  BEFORE UPDATE ON product_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── product_media (1:N, ordered) ────────────────────────────
CREATE TABLE IF NOT EXISTS product_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'gallery'
    CHECK (kind IN ('cover','gallery')),

  -- Canonical identifier: the object's path inside the `product-media`
  -- Storage bucket (bucket created separately in Stage 8b), e.g.
  -- '{product_id}/cover/hero.webp'. Upload/delete/replace all key off this.
  -- The public URL is always DERIVED from storage_path at read time
  -- (lib/media.ts) — never persisted, never parsed back out of a URL.
  storage_path  TEXT NOT NULL,

  alt           TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product
  ON product_media(product_id, sort_order);

-- One cover row per product.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_cover
  ON product_media(product_id) WHERE kind = 'cover';

-- One DB row per storage object.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_media_storage_path
  ON product_media(storage_path);

-- ── RLS ─────────────────────────────────────────────────────
-- Deny-by-default: enable RLS with NO policies (service role only). Both the
-- public /events/[slug] page and the admin Draft preview read this
-- server-side via the service role — no anon/client-side read is required.
ALTER TABLE product_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- NOTE: the Supabase Storage bucket `product-media` (public-read) is created
-- separately in Stage 8b — deliberately NOT here, so this migration touches
-- only relational schema.
