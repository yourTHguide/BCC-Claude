-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "smc_registration_tables".
-- Source: see supabase/staging/README.md. Do not run against production.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('card','promptpay'));

COMMENT ON COLUMN public.bookings.payment_method IS
  'card | promptpay. Set by the SMC fulfilment function; NULL for every booking made before SMC Phase 1b or through the BCC/BNT checkout.';
COMMENT ON COLUMN public.bookings.is_test IS
  'TRUE when the Stripe event that created this booking had livemode = false. Set by the SMC fulfilment function only.';

CREATE TABLE IF NOT EXISTS public.smc_registrations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  product_id                UUID NOT NULL REFERENCES public.products(id),
  event_id                  UUID NOT NULL REFERENCES public.event_dates(id),
  quantity                  INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 4),
  unit_price                INTEGER NOT NULL CHECK (unit_price > 0),       -- THB, server-resolved
  total_amount              INTEGER NOT NULL CHECK (total_amount > 0),     -- THB
  currency                  TEXT NOT NULL DEFAULT 'thb',
  lead_name                 TEXT NOT NULL,
  lead_email                TEXT NOT NULL,
  lead_whatsapp             TEXT NOT NULL,
  attendee_names            TEXT[] NOT NULL,
  age_confirmed             BOOLEAN NOT NULL CHECK (age_confirmed),
  terms_version             TEXT NOT NULL,
  terms_accepted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marketing_opt_in          BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method            TEXT NOT NULL CHECK (payment_method IN ('card','promptpay')),
  status                    TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_payment','paid','paid_over_capacity','failed','expired','cancelled')),
  hold_expires_at           TIMESTAMPTZ NOT NULL,
  stripe_session_id         TEXT UNIQUE,
  stripe_payment_intent_id  TEXT,
  livemode                  BOOLEAN,
  booking_id                UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  last_error                TEXT,
  CONSTRAINT smc_registrations_total_matches CHECK (total_amount = unit_price * quantity),
  CONSTRAINT smc_registrations_attendees_match CHECK (cardinality(attendee_names) = quantity)
);

CREATE INDEX IF NOT EXISTS idx_smc_registrations_event_status
  ON public.smc_registrations (event_id, status, hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_smc_registrations_booking ON public.smc_registrations (booking_id);

COMMENT ON TABLE public.smc_registrations IS
  'SMC Phase 1b. One row per checkout attempt. Holds seats while status is pending (until hold_expires_at) or awaiting_payment (until Stripe reports success, failure or expiry — never released by timer alone).';

CREATE TRIGGER smc_registrations_set_updated_at
  BEFORE UPDATE ON public.smc_registrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.booking_attendees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position >= 1),
  full_name   TEXT NOT NULL,
  is_lead     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_attendees_position_uniq UNIQUE (booking_id, position)
);

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind                 TEXT NOT NULL CHECK (kind IN ('smc_confirmation','smc_admin_alert')),
  booking_id           UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  registration_id      UUID REFERENCES public.smc_registrations(id) ON DELETE SET NULL,
  recipient            TEXT NOT NULL,
  idempotency_key      TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed')),
  attempts             INTEGER NOT NULL DEFAULT 0,
  max_attempts         INTEGER NOT NULL DEFAULT 6,
  next_attempt_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until         TIMESTAMPTZ,
  provider_message_id  TEXT,
  last_error           TEXT,
  sent_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_due ON public.email_outbox (status, next_attempt_at);

COMMENT ON TABLE public.email_outbox IS
  'SMC Phase 1b. Emails are enqueued in the same transaction that creates the booking, then sent by the webhook and retried by a scheduled job. Delivery is at-least-once with de-duplication (idempotency_key, claim leases); exactly-once delivery is not guaranteed.';

CREATE TRIGGER email_outbox_set_updated_at
  BEFORE UPDATE ON public.email_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id      TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  livemode      BOOLEAN NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  last_error    TEXT
);

ALTER TABLE public.smc_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
