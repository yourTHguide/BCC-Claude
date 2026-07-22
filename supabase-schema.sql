-- ============================================================
-- BCC Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
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

-- Allow service role full access (used by webhook + dashboard)
-- Anon key: no direct access (all writes go through API routes)

-- ── USEFUL VIEWS ────────────────────────────────────────────

-- Daily summary view
CREATE VIEW daily_summary AS
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
  COALESCE(SUM(e.amount), 0) AS total_expenses
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
