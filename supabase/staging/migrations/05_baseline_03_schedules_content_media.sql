-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "baseline_03_schedules_content_media".
-- Source: see supabase/staging/README.md. Do not run against production.
CREATE TABLE IF NOT EXISTS product_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  night_slug         TEXT NOT NULL,
  night_name         TEXT NOT NULL,
  freq               TEXT NOT NULL DEFAULT 'weekly'
    CHECK (freq IN ('once','weekly')),
  weekday            SMALLINT CHECK (weekday BETWEEN 0 AND 6),
  start_date         DATE NOT NULL,
  until_date         DATE,
  start_time_default TIME,
  generated_through  DATE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_schedules_product ON product_schedules(product_id);
ALTER TABLE product_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates
  ADD COLUMN IF NOT EXISTS schedule_id UUID;
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_dates_schedule_id_fkey'
      AND conrelid = 'public.event_dates'::regclass
  ) THEN
    ALTER TABLE event_dates
      ADD CONSTRAINT event_dates_schedule_id_fkey
      FOREIGN KEY (schedule_id) REFERENCES product_schedules(id) ON DELETE SET NULL;
  END IF;
END $guard$;
CREATE INDEX IF NOT EXISTS idx_event_dates_schedule ON event_dates(schedule_id);
CREATE TABLE IF NOT EXISTS product_content (
  product_id          UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  tagline              TEXT,
  short_description    TEXT,
  full_description     TEXT,
  meeting_point        JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_minutes     INTEGER,
  highlights           JSONB NOT NULL DEFAULT '[]'::jsonb,
  itinerary             JSONB NOT NULL DEFAULT '[]'::jsonb,
  whats_included        JSONB NOT NULL DEFAULT '[]'::jsonb,
  whats_not_included    JSONB NOT NULL DEFAULT '[]'::jsonb,
  important_info        JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meeting_point_visibility_valid CHECK (
    NOT (meeting_point ? 'visibility')
    OR meeting_point->>'visibility' IN ('public','after_booking','private')
  )
);
CREATE TRIGGER product_content_set_updated_at
  BEFORE UPDATE ON product_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TABLE IF NOT EXISTS product_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'gallery'
    CHECK (kind IN ('cover','gallery')),
  storage_path  TEXT NOT NULL,
  alt           TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_cover ON product_media(product_id) WHERE kind = 'cover';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_product_media_storage_path ON product_media(storage_path);
ALTER TABLE product_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media', 'product-media', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
