-- ============================================================
-- PHASE 4 · MIGRATION B — Recurring schedule definitions + instance provenance
-- ============================================================
-- Intended stage: STAGE 4 (Product create + schedule generate).
-- Status: AUTHORED in Stage 0 — NOT yet applied to production (2026-08-19).
-- Depends on: nothing (standalone — does not use set_updated_at()).
--
-- Idempotent and ADDITIVE.
--
-- IMPORTANT: the customer booking calendar (/book, /api/events) NEVER reads
-- product_schedules. It only ever reads the event_dates rows this schedule
-- GENERATES. Storing the rule exists purely so the dashboard can extend /
-- regenerate a recurrence and de-duplicate deterministically. Recurrence logic
-- stays OUT of the customer path — exactly as Phase 3 established.
-- ============================================================

-- ── product_schedules ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_schedules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Storefront/booking key stamped onto every generated event_dates row. For a
  -- simple single-schedule Product this equals the product slug. (BCC's legacy
  -- two-slug setup is NOT modeled here — see Phase 4 decision #5.)
  night_slug         TEXT NOT NULL,
  night_name         TEXT NOT NULL,

  freq               TEXT NOT NULL DEFAULT 'weekly'
    CHECK (freq IN ('once','weekly')),
  -- 0=Sunday .. 6=Saturday (matches JS Date.getDay()). Required for weekly;
  -- NULL for a one-time schedule.
  weekday            SMALLINT CHECK (weekday BETWEEN 0 AND 6),

  start_date         DATE NOT NULL,
  -- NULL = open-ended. Generation materializes up to a rolling horizon (default
  -- 12 weeks, operator-overridable) chosen at generate time.
  until_date         DATE,

  start_time_default TIME,          -- NULL -> inherits products.default_start_time
  generated_through  DATE,          -- bookkeeping: furthest date materialized so far
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_schedules_product ON product_schedules(product_id);

-- Service role only (admin API). Enable RLS with no policies so this table never
-- repeats the products "RLS disabled in public" advisor error.
ALTER TABLE product_schedules ENABLE ROW LEVEL SECURITY;

-- ── event_dates.schedule_id (provenance) ────────────────────
-- Which schedule (if any) generated this instance. NULL for hand-added one-offs
-- and for every pre-Phase-4 row. Lets schedule ops (extend / cancel-future)
-- target generated rows precisely without disturbing manual instances.
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
