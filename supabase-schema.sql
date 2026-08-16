-- ============================================================
-- BCC Supabase Schema — CANONICAL BASELINE
-- ============================================================
-- Faithful, idempotent snapshot of the *current* production schema
-- (project ref: oomhftxgvikzxlvqdcmr), reconciled by direct catalog
-- introspection on 2026-08-17.
--
-- PURPOSE
--   • Documents the canonical production schema so the repo is a truthful
--     description of production.
--   • Lets a FRESH environment be rebuilt to match production by running this
--     file ONCE (Supabase Dashboard → SQL Editor, or `psql` on a new project).
--
-- DO NOT run this against production. Production already has this schema; the
-- file is written idempotently (IF NOT EXISTS / guarded / OR REPLACE) so a
-- stray run would be a harmless no-op, but there is no reason to execute it
-- there. This baseline changes the REPO only — never production.
--
-- Historical note: the Product/Event-Instance layer (Phase 1) and the RLS
-- policies below were applied directly to production and were previously
-- missing from this file. They are documented here to close that drift.
-- ============================================================

-- ── BOOKINGS ────────────────────────────────────────────────
CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Event info
  night_slug        TEXT NOT NULL,
  night_name        TEXT NOT NULL,
  event_date        DATE NOT NULL,

  -- Guest info (from Stripe)
  guest_name        TEXT,
  guest_email       TEXT NOT NULL,
  guest_phone       TEXT,
  guest_whatsapp    TEXT,

  -- Booking details
  quantity          INT NOT NULL DEFAULT 1,
  price_per_person  INT NOT NULL,   -- in THB
  total_paid        INT NOT NULL,   -- in THB (after any discount)
  currency          TEXT DEFAULT 'thb',

  -- Promo / discount
  promo_code        TEXT,
  discount_amount   INT DEFAULT 0,  -- in THB

  -- Source tracking
  source            TEXT DEFAULT 'website',  -- website | klook | airbnb | gyg | viator | manual

  -- Status
  status            TEXT DEFAULT 'confirmed', -- confirmed | cancelled | refunded | no_show

  -- Stripe
  stripe_session_id TEXT UNIQUE,
  stripe_payment_id TEXT,

  -- Internal
  notes             TEXT,
  host_assigned     TEXT
);

-- ── EVENT DATES ─────────────────────────────────────────────
-- Founder controls which dates are open/closed
CREATE TABLE event_dates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date    DATE NOT NULL,
  night_slug    TEXT NOT NULL,
  night_name    TEXT NOT NULL,
  is_open       BOOLEAN DEFAULT TRUE,
  host_assigned TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_date, night_slug)
);

-- ── EXPENSES ────────────────────────────────────────────────
CREATE TABLE expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date  DATE NOT NULL,
  night_slug  TEXT NOT NULL,
  category    TEXT NOT NULL,  -- van | host_pay | extra
  description TEXT,
  amount      INT NOT NULL,   -- in THB
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROMO CODES ─────────────────────────────────────────────
-- Reference only (actual validation is in Stripe)
-- Used to track which codes exist and their source
CREATE TABLE promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  discount_amount INT NOT NULL,   -- THB
  source          TEXT,           -- e.g. 'instagram', 'klook', 'partner'
  description     TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  uses_count      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── OTA ADDITIONS ───────────────────────────────────────────
-- Manual entries for OTA bookings (Klook, Airbnb, etc.)
CREATE TABLE ota_bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date    DATE NOT NULL,
  night_slug    TEXT NOT NULL,
  source        TEXT NOT NULL,  -- klook | airbnb | gyg | viator | eventbrite
  guest_name    TEXT,
  quantity      INT NOT NULL DEFAULT 1,
  price_per_person INT,
  total_paid    INT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── OPERATIONS LAYER (added for host-brief / confirmed-meetup workflow) ──
-- event_dates: verdict + meetup logistics + host fee tracking
ALTER TABLE event_dates
  ADD COLUMN IF NOT EXISTS operation_verdict TEXT NOT NULL DEFAULT 'Pending'
    CHECK (operation_verdict IN ('Pending','Pre-confirmation','Operation Confirmed','Cancelled / Rescheduled','Completed','Reviewed')),
  ADD COLUMN IF NOT EXISTS meet_up_location TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_group_link TEXT,
  ADD COLUMN IF NOT EXISTS venue_route JSONB DEFAULT '{}'::jsonb,  -- { venue1, venue2, venue3, venue4, backup, notes }
  ADD COLUMN IF NOT EXISTS van_or_taxi_contact TEXT,
  ADD COLUMN IF NOT EXISTS special_notes TEXT,
  ADD COLUMN IF NOT EXISTS host_payment_status TEXT NOT NULL DEFAULT 'Not calculated'
    CHECK (host_payment_status IN ('Not calculated','Calculated','Paid')),
  ADD COLUMN IF NOT EXISTS host_fee_final INTEGER;

-- Guest attendance tracking — reuses existing booking sources rather than a
-- separate namelist table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'expected'
    CHECK (attendance_status IN ('expected','checked_in','no_show'));

ALTER TABLE ota_bookings
  ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'expected'
    CHECK (attendance_status IN ('expected','checked_in','no_show')),
  ADD COLUMN IF NOT EXISTS guest_email TEXT; -- optional, lets OTA guests receive the confirmed-meetup email

CREATE INDEX IF NOT EXISTS idx_event_dates_verdict ON event_dates(operation_verdict);
CREATE INDEX IF NOT EXISTS idx_bookings_attendance ON bookings(attendance_status);
CREATE INDEX IF NOT EXISTS idx_ota_attendance ON ota_bookings(attendance_status);

-- ── PRODUCT / EVENT-INSTANCE LAYER (Phase 1) ────────────────
-- Introduces the canonical Product, and links every event_dates row to one
-- Product. This section was applied directly to production during Phase 1 and
-- is reproduced here so a fresh environment matches production.
--
-- NOTE: production also contains a table `_migration_p1_audit`
-- (row_id, action, migrated_at) — a one-off audit trail of the Phase 1 DATA
-- migration (e.g. closing legacy experiment dates). It is a historical
-- artifact of how Phase 1 ran, not part of the operational schema, so it is
-- intentionally NOT recreated for fresh environments.

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

-- event_dates → products link + per-instance overrides
ALTER TABLE event_dates
  ADD COLUMN IF NOT EXISTS product_id          UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS price_override      INTEGER,   -- overrides products.default_price when set
  ADD COLUMN IF NOT EXISTS start_time_override TIME,      -- overrides products.default_start_time when set
  ADD COLUMN IF NOT EXISTS capacity            INTEGER;   -- per-event capacity; NULL = no defined capacity

-- FK is added via a guard so re-running is safe (ADD CONSTRAINT has no IF NOT EXISTS)
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

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_bookings_date ON bookings(event_date);
CREATE INDEX idx_bookings_night ON bookings(night_slug);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_email ON bookings(guest_email);
CREATE INDEX idx_event_dates_date ON event_dates(event_date);
CREATE INDEX idx_expenses_date ON expenses(event_date);
CREATE INDEX idx_ota_date ON ota_bookings(event_date);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- Public can insert bookings (webhook does this)
-- Only service role can read/update
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ota_bookings ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (as they exist in production).
-- All are PERMISSIVE, granted to role `public`, with permissive (`true`)
-- expressions. `promo_codes` has RLS enabled but NO policies (locked to the
-- service role, which bypasses RLS). `products` has RLS DISABLED in production
-- and is therefore intentionally left without ENABLE / policies here.
-- (Service-role clients bypass RLS regardless of these policies.)
DROP POLICY IF EXISTS "Allow public read on bookings" ON bookings;
CREATE POLICY "Allow public read on bookings" ON bookings
  FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow service role insert on bookings" ON bookings;
CREATE POLICY "Allow service role insert on bookings" ON bookings
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on event_dates" ON event_dates;
CREATE POLICY "Allow public read on event_dates" ON event_dates
  FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow service role insert on event_dates" ON event_dates;
CREATE POLICY "Allow service role insert on event_dates" ON event_dates
  FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service role update on event_dates" ON event_dates;
CREATE POLICY "Allow service role update on event_dates" ON event_dates
  FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Allow public read on expenses" ON expenses;
CREATE POLICY "Allow public read on expenses" ON expenses
  FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow service role insert on expenses" ON expenses;
CREATE POLICY "Allow service role insert on expenses" ON expenses
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read on ota_bookings" ON ota_bookings;
CREATE POLICY "Allow public read on ota_bookings" ON ota_bookings
  FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Allow service role insert on ota_bookings" ON ota_bookings;
CREATE POLICY "Allow service role insert on ota_bookings" ON ota_bookings
  FOR INSERT TO public WITH CHECK (true);

-- ── USEFUL VIEWS ────────────────────────────────────────────

-- Daily summary view
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  ed.event_date,
  ed.night_slug,
  ed.night_name,
  ed.is_open,
  ed.host_assigned,
  -- Website bookings
  COALESCE(SUM(b.quantity), 0) AS website_guests,
  COALESCE(SUM(b.total_paid), 0) AS website_revenue,
  -- OTA bookings
  COALESCE(SUM(o.quantity), 0) AS ota_guests,
  COALESCE(SUM(o.total_paid), 0) AS ota_revenue,
  -- Total
  COALESCE(SUM(b.quantity), 0) + COALESCE(SUM(o.quantity), 0) AS total_guests,
  COALESCE(SUM(b.total_paid), 0) + COALESCE(SUM(o.total_paid), 0) AS total_revenue,
  -- Expenses
  COALESCE(SUM(ex.amount), 0) AS total_expenses
FROM event_dates ed
LEFT JOIN bookings b
  ON b.event_date = ed.event_date
  AND b.night_slug = ed.night_slug
  AND b.status = 'confirmed'
LEFT JOIN ota_bookings o
  ON o.event_date = ed.event_date
  AND o.night_slug = ed.night_slug
LEFT JOIN expenses ex
  ON ex.event_date = ed.event_date
  AND ex.night_slug = ed.night_slug
GROUP BY ed.event_date, ed.night_slug, ed.night_name, ed.is_open, ed.host_assigned
ORDER BY ed.event_date DESC;

-- ── CANONICAL SEED (DATA — not schema) ──────────────────────
-- The single canonical BCC Product as it exists in production. Seeded so a
-- fresh environment has a Product for event_dates.product_id to reference and
-- for the storefront/checkout to resolve. Idempotent via ON CONFLICT.
-- This is the ONLY seed row; no legacy experiment Products are (re)created.
INSERT INTO products (id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt)
VALUES ('bbacd61d-1063-4b69-a0d6-4fd147ef98ea', 'bangkok-club-crawl', 'Bangkok Club Crawl', 'active', 1200, '21:30:00', TRUE, FALSE)
ON CONFLICT (slug) DO NOTHING;
