-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "baseline_01_core_tables".
-- Source: see supabase/staging/README.md. Do not run against production.
CREATE TABLE IF NOT EXISTS bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  night_slug        TEXT NOT NULL,
  night_name        TEXT NOT NULL,
  event_date        DATE NOT NULL,
  guest_name        TEXT,
  guest_email       TEXT NOT NULL,
  guest_phone       TEXT,
  guest_whatsapp    TEXT,
  quantity          INT NOT NULL DEFAULT 1,
  price_per_person  INT NOT NULL,   -- in THB
  total_paid        INT NOT NULL,   -- in THB (after any discount)
  currency          TEXT DEFAULT 'thb',
  promo_code        TEXT,
  discount_amount   INT DEFAULT 0,  -- in THB
  source            TEXT DEFAULT 'website',  -- website | klook | airbnb | gyg | viator | manual
  status            TEXT DEFAULT 'confirmed', -- confirmed | cancelled | refunded | no_show
  stripe_session_id TEXT UNIQUE,
  stripe_payment_id TEXT,
  notes             TEXT,
  host_assigned     TEXT
);
CREATE TABLE IF NOT EXISTS event_dates (
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
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date  DATE NOT NULL,
  night_slug  TEXT NOT NULL,
  category    TEXT NOT NULL,  -- van | host_pay | extra
  description TEXT,
  amount      INT NOT NULL,   -- in THB
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS promo_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  discount_amount INT NOT NULL,   -- THB
  source          TEXT,           -- e.g. 'instagram', 'klook', 'partner'
  description     TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  uses_count      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ota_bookings (
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
