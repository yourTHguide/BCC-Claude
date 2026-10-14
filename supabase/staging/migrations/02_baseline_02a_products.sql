-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "baseline_02a_products".
-- Source: see supabase/staging/README.md. Do not run against production.
CREATE TABLE IF NOT EXISTS products (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','draft','archived')),
  default_price      INTEGER,             -- in THB (whole units)
  default_start_time TIME,
  visible_bcc        BOOLEAN NOT NULL DEFAULT FALSE,  -- sold on the BCC storefront
  visible_bnt        BOOLEAN NOT NULL DEFAULT FALSE,  -- sold on the BNT storefront (future)
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE event_dates
  ADD COLUMN IF NOT EXISTS product_id          UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS price_override      INTEGER,   -- overrides products.default_price when set
  ADD COLUMN IF NOT EXISTS start_time_override TIME,      -- overrides products.default_start_time when set
  ADD COLUMN IF NOT EXISTS capacity            INTEGER;   -- per-event capacity; NULL = no defined capacity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_dates_product_id_fkey'
      AND conrelid = 'public.event_dates'::regclass
  ) THEN
    ALTER TABLE event_dates
      ADD CONSTRAINT event_dates_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_night ON bookings(night_slug);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(guest_email);
CREATE INDEX IF NOT EXISTS idx_event_dates_date ON event_dates(event_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(event_date);
CREATE INDEX IF NOT EXISTS idx_ota_date ON ota_bookings(event_date);
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ota_bookings ENABLE ROW LEVEL SECURITY;
