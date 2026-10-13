-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "baseline_04_booking_identity_bnt_forms_pricing".
-- Source: see supabase/staging/README.md. Do not run against production.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES event_dates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ticket_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bookings_ticket_token
  ON bookings(ticket_token);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE TABLE IF NOT EXISTS bnt_experience_inquiries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  name              text NOT NULL,
  whatsapp          text NOT NULL,
  occasion          text,
  event_date        date,
  is_flexible_date  boolean NOT NULL DEFAULT false,
  group_size        text,
  preferred_vibe    text,
  budget_range      text,
  inquiry_type      text NOT NULL DEFAULT 'Private Inquiry'
);
CREATE TABLE IF NOT EXISTS bnt_contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL,
  whatsapp    text NOT NULL,
  message     text
);
ALTER TABLE bnt_experience_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bnt_contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS early_bird_price INTEGER,
  ADD COLUMN IF NOT EXISTS early_bird_cutoff_hours INTEGER;
ALTER TABLE products
  ADD CONSTRAINT products_early_bird_requires_cutoff
    CHECK (early_bird_price IS NULL OR early_bird_cutoff_hours IS NOT NULL);
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS storefront TEXT,
  ADD COLUMN IF NOT EXISTS price_tier TEXT;
ALTER TABLE bookings
  ADD CONSTRAINT bookings_storefront_check
    CHECK (storefront IS NULL OR storefront = ANY (ARRAY['bcc'::text, 'bnt'::text])),
  ADD CONSTRAINT bookings_price_tier_check
    CHECK (price_tier IS NULL OR price_tier = ANY (ARRAY['early_bird'::text, 'regular'::text]));
