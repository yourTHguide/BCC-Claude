-- ============================================================
-- SMC Phase 1b — Single Meet Club registration, seat holds,
-- transactional fulfilment, email outbox, webhook event log.
-- ============================================================
-- Additive only. Existing tables gain two nullable/defaulted columns on
-- `bookings`; nothing existing is altered or removed. All new objects are
-- service-role only: RLS on with no policies, and EXECUTE on every function
-- revoked from PUBLIC/anon/authenticated (functions in `public` are
-- otherwise callable through PostgREST with the anon key).
--
-- Applied to STAGING only (jyhtznpethgzypblppnt) until launch approval.
-- ============================================================

-- ── bookings: two additive columns ──────────────────────────
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

-- ── smc_registrations: a checkout in progress + its seat hold ─
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

-- ── booking_attendees: one row per person on a booking ───────
CREATE TABLE IF NOT EXISTS public.booking_attendees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position >= 1),
  full_name   TEXT NOT NULL,
  is_lead     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_attendees_position_uniq UNIQUE (booking_id, position)
);

-- ── email_outbox: durable, retryable transactional email ─────
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

-- ── stripe_webhook_events: receipt log for SMC webhook ───────
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id      TEXT PRIMARY KEY,
  type          TEXT NOT NULL,
  livemode      BOOLEAN NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  last_error    TEXT
);

-- ── RLS: service-role only ───────────────────────────────────
ALTER TABLE public.smc_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Functions
-- ============================================================

-- Seats taken for one event: confirmed bookings + live holds.
-- A hold is live while pending and not yet expired, or while
-- awaiting_payment (PromptPay processing) regardless of the timer.
CREATE OR REPLACE FUNCTION public.smc_seats_taken(p_event_id UUID, p_exclude_registration UUID DEFAULT NULL)
RETURNS TABLE (confirmed INTEGER, held INTEGER)
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT
    COALESCE((
      SELECT SUM(b.quantity)::INTEGER
      FROM public.bookings b
      JOIN public.event_dates e ON e.id = p_event_id
      WHERE b.status = 'confirmed'
        AND (b.event_id = p_event_id
             OR (b.event_id IS NULL AND b.night_slug = e.night_slug AND b.event_date = e.event_date))
    ), 0) AS confirmed,
    COALESCE((
      SELECT SUM(r.quantity)::INTEGER
      FROM public.smc_registrations r
      WHERE r.event_id = p_event_id
        AND (p_exclude_registration IS NULL OR r.id <> p_exclude_registration)
        AND (
          (r.status = 'pending' AND r.hold_expires_at > NOW())
          OR r.status = 'awaiting_payment'
        )
    ), 0) AS held;
$fn$;

-- Public-safe availability for one SMC event (no personal data).
CREATE OR REPLACE FUNCTION public.smc_event_availability(p_event_id UUID)
RETURNS TABLE (capacity INTEGER, confirmed INTEGER, held INTEGER, remaining INTEGER)
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT
    e.capacity,
    t.confirmed,
    t.held,
    CASE WHEN e.capacity IS NULL THEN NULL
         ELSE GREATEST(e.capacity - t.confirmed - t.held, 0) END AS remaining
  FROM public.event_dates e
  CROSS JOIN LATERAL public.smc_seats_taken(e.id) t
  WHERE e.id = p_event_id;
$fn$;

-- Create a registration and hold its seats, atomically.
-- Locks the event row so two concurrent checkouts cannot both take the last seats.
-- Raises: smc_event_not_found, smc_event_closed, smc_event_started,
--         smc_product_unavailable, smc_invalid_quantity, smc_invalid_attendees,
--         smc_age_not_confirmed, smc_capacity_missing, smc_price_missing, smc_sold_out
CREATE OR REPLACE FUNCTION public.smc_create_registration(
  p_event_id          UUID,
  p_quantity          INTEGER,
  p_lead_name         TEXT,
  p_lead_email        TEXT,
  p_lead_whatsapp     TEXT,
  p_attendee_names    TEXT[],
  p_payment_method    TEXT,
  p_terms_version     TEXT,
  p_age_confirmed     BOOLEAN,
  p_marketing_opt_in  BOOLEAN,
  p_allow_draft       BOOLEAN,
  p_hold_minutes      INTEGER
)
RETURNS public.smc_registrations
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_event      public.event_dates%ROWTYPE;
  v_product    public.products%ROWTYPE;
  v_start      TIMESTAMPTZ;
  v_price      INTEGER;
  v_taken      RECORD;
  v_reg        public.smc_registrations%ROWTYPE;
BEGIN
  SELECT * INTO v_event FROM public.event_dates WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'smc_event_not_found'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id = v_event.product_id;
  IF NOT FOUND OR v_product.slug <> 'smc' THEN RAISE EXCEPTION 'smc_event_not_found'; END IF;

  IF NOT (v_product.status = 'active' OR (p_allow_draft AND v_product.status = 'draft'))
     OR v_product.visible_bnt IS NOT TRUE THEN
    RAISE EXCEPTION 'smc_product_unavailable';
  END IF;

  IF v_event.is_open IS NOT TRUE THEN RAISE EXCEPTION 'smc_event_closed'; END IF;

  v_start := ((v_event.event_date + COALESCE(v_event.start_time_override, v_product.default_start_time))
              AT TIME ZONE 'Asia/Bangkok');
  IF v_start IS NULL OR v_start <= NOW() THEN RAISE EXCEPTION 'smc_event_started'; END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 4 THEN
    RAISE EXCEPTION 'smc_invalid_quantity';
  END IF;
  IF p_attendee_names IS NULL OR cardinality(p_attendee_names) <> p_quantity
     OR EXISTS (SELECT 1 FROM unnest(p_attendee_names) n WHERE length(btrim(n)) < 2) THEN
    RAISE EXCEPTION 'smc_invalid_attendees';
  END IF;
  IF p_age_confirmed IS NOT TRUE THEN RAISE EXCEPTION 'smc_age_not_confirmed'; END IF;

  IF v_event.capacity IS NULL THEN RAISE EXCEPTION 'smc_capacity_missing'; END IF;

  v_price := COALESCE(v_event.price_override, v_product.default_price);
  IF v_price IS NULL OR v_price <= 0 THEN RAISE EXCEPTION 'smc_price_missing'; END IF;

  SELECT * INTO v_taken FROM public.smc_seats_taken(p_event_id);
  IF v_event.capacity - v_taken.confirmed - v_taken.held < p_quantity THEN
    RAISE EXCEPTION 'smc_sold_out';
  END IF;

  INSERT INTO public.smc_registrations (
    product_id, event_id, quantity, unit_price, total_amount,
    lead_name, lead_email, lead_whatsapp, attendee_names,
    age_confirmed, terms_version, marketing_opt_in, payment_method,
    status, hold_expires_at
  ) VALUES (
    v_product.id, v_event.id, p_quantity, v_price, v_price * p_quantity,
    btrim(p_lead_name), lower(btrim(p_lead_email)), btrim(p_lead_whatsapp),
    ARRAY(SELECT btrim(n) FROM unnest(p_attendee_names) n),
    TRUE, p_terms_version, COALESCE(p_marketing_opt_in, FALSE), p_payment_method,
    'pending', NOW() + make_interval(mins => p_hold_minutes)
  )
  RETURNING * INTO v_reg;

  RETURN v_reg;
END;
$fn$;

-- Attach the Stripe Checkout Session; the hold lasts until the session
-- expires plus a grace period.
CREATE OR REPLACE FUNCTION public.smc_attach_checkout_session(
  p_registration_id UUID,
  p_session_id      TEXT,
  p_session_expires TIMESTAMPTZ,
  p_grace_minutes   INTEGER
)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $fn$
  UPDATE public.smc_registrations
  SET stripe_session_id = p_session_id,
      hold_expires_at   = p_session_expires + make_interval(mins => p_grace_minutes)
  WHERE id = p_registration_id AND status = 'pending' AND stripe_session_id IS NULL;
$fn$;

-- Checkout completed but payment still processing (PromptPay):
-- keep the seats held until Stripe reports success or failure.
CREATE OR REPLACE FUNCTION public.smc_mark_awaiting_payment(p_session_id TEXT, p_payment_intent TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $fn$
  UPDATE public.smc_registrations
  SET status = 'awaiting_payment',
      stripe_payment_intent_id = COALESCE(p_payment_intent, stripe_payment_intent_id)
  WHERE stripe_session_id = p_session_id AND status = 'pending';
$fn$;

-- Release a hold: payment failed, session expired, or checkout abandoned.
-- Never touches a paid registration.
CREATE OR REPLACE FUNCTION public.smc_release_registration(p_session_id TEXT, p_status TEXT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF p_status NOT IN ('failed','expired','cancelled') THEN
    RAISE EXCEPTION 'smc_invalid_release_status';
  END IF;
  UPDATE public.smc_registrations
  SET status = p_status, last_error = p_reason
  WHERE stripe_session_id = p_session_id AND status IN ('pending','awaiting_payment');
END;
$fn$;

-- Turn a verified-paid registration into a confirmed booking, in ONE transaction:
-- booking + attendees + queued emails + registration status.
-- Idempotent: a repeat call for an already-fulfilled session returns the same booking.
-- A late success after the hold was released re-checks capacity; if the event
-- is now full the registration becomes paid_over_capacity and no ticket is issued.
CREATE OR REPLACE FUNCTION public.smc_fulfill_registration(
  p_session_id       TEXT,
  p_payment_intent   TEXT,
  p_amount_total     INTEGER,   -- smallest currency unit (satang), as reported by Stripe
  p_livemode         BOOLEAN,
  p_ticket_token     TEXT,
  p_admin_recipient  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_reg      public.smc_registrations%ROWTYPE;
  v_event    public.event_dates%ROWTYPE;
  v_taken    RECORD;
  v_booking  UUID;
  i          INTEGER;
BEGIN
  SELECT * INTO v_reg FROM public.smc_registrations WHERE stripe_session_id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'smc_registration_not_found'; END IF;

  IF v_reg.status = 'paid' THEN
    RETURN jsonb_build_object('outcome','already_fulfilled','booking_id',v_reg.booking_id,'registration_id',v_reg.id);
  END IF;
  IF v_reg.status = 'paid_over_capacity' THEN
    RETURN jsonb_build_object('outcome','over_capacity','booking_id',NULL,'registration_id',v_reg.id);
  END IF;

  IF p_amount_total IS DISTINCT FROM v_reg.total_amount * 100 THEN
    UPDATE public.smc_registrations SET last_error = 'amount_mismatch:' || COALESCE(p_amount_total::TEXT,'null')
    WHERE id = v_reg.id;
    RAISE EXCEPTION 'smc_amount_mismatch';
  END IF;

  SELECT * INTO v_event FROM public.event_dates WHERE id = v_reg.event_id FOR UPDATE;

  -- Late success: the hold was already released, so the seats must be re-checked.
  IF v_reg.status IN ('failed','expired','cancelled') THEN
    SELECT * INTO v_taken FROM public.smc_seats_taken(v_reg.event_id, v_reg.id);
    IF v_event.capacity IS NOT NULL
       AND v_event.capacity - v_taken.confirmed - v_taken.held < v_reg.quantity THEN
      UPDATE public.smc_registrations
      SET status = 'paid_over_capacity', livemode = p_livemode,
          stripe_payment_intent_id = COALESCE(p_payment_intent, stripe_payment_intent_id),
          last_error = 'late_success_event_full'
      WHERE id = v_reg.id;
      IF p_admin_recipient IS NOT NULL AND length(p_admin_recipient) > 0 THEN
        INSERT INTO public.email_outbox (kind, registration_id, recipient, idempotency_key)
        VALUES ('smc_admin_alert', v_reg.id, p_admin_recipient, 'smc-overcap-' || v_reg.id)
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      RETURN jsonb_build_object('outcome','over_capacity','booking_id',NULL,'registration_id',v_reg.id);
    END IF;
  END IF;

  INSERT INTO public.bookings (
    night_slug, night_name, event_date, event_id, product_id,
    guest_name, guest_email, guest_phone, guest_whatsapp,
    quantity, price_per_person, total_paid, currency, discount_amount,
    source, status, stripe_session_id, stripe_payment_id, ticket_token,
    storefront, price_tier, payment_method, is_test, notes
  ) VALUES (
    v_event.night_slug, v_event.night_name, v_event.event_date, v_event.id, v_reg.product_id,
    v_reg.lead_name, v_reg.lead_email, v_reg.lead_whatsapp, v_reg.lead_whatsapp,
    v_reg.quantity, v_reg.unit_price, v_reg.total_amount, 'thb', 0,
    'website', 'confirmed', p_session_id, p_payment_intent, p_ticket_token,
    'bnt', 'regular', v_reg.payment_method, NOT p_livemode,
    'Attendees: ' || array_to_string(v_reg.attendee_names, ', ')
  )
  RETURNING id INTO v_booking;

  FOR i IN 1 .. cardinality(v_reg.attendee_names) LOOP
    INSERT INTO public.booking_attendees (booking_id, position, full_name, is_lead)
    VALUES (v_booking, i, v_reg.attendee_names[i], i = 1);
  END LOOP;

  INSERT INTO public.email_outbox (kind, booking_id, registration_id, recipient, idempotency_key)
  VALUES ('smc_confirmation', v_booking, v_reg.id, v_reg.lead_email, 'smc-confirmation-' || v_booking);

  IF p_admin_recipient IS NOT NULL AND length(p_admin_recipient) > 0 THEN
    INSERT INTO public.email_outbox (kind, booking_id, registration_id, recipient, idempotency_key)
    VALUES ('smc_admin_alert', v_booking, v_reg.id, p_admin_recipient, 'smc-admin-' || v_booking);
  END IF;

  UPDATE public.smc_registrations
  SET status = 'paid', booking_id = v_booking, livemode = p_livemode,
      stripe_payment_intent_id = COALESCE(p_payment_intent, stripe_payment_intent_id),
      last_error = NULL
  WHERE id = v_reg.id;

  RETURN jsonb_build_object('outcome','fulfilled','booking_id',v_booking,'registration_id',v_reg.id);
END;
$fn$;

-- Claim due emails with a lease so concurrent senders never pick the same row.
CREATE OR REPLACE FUNCTION public.smc_claim_outbox(p_limit INTEGER, p_lease_seconds INTEGER)
RETURNS SETOF public.email_outbox
LANGUAGE sql
SET search_path = ''
AS $fn$
  UPDATE public.email_outbox o
  SET status = 'sending',
      attempts = o.attempts + 1,
      locked_until = NOW() + make_interval(secs => p_lease_seconds)
  WHERE o.id IN (
    SELECT id FROM public.email_outbox
    WHERE (status = 'pending' AND next_attempt_at <= NOW())
       OR (status = 'sending' AND locked_until < NOW())
    ORDER BY next_attempt_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  AND o.attempts < o.max_attempts
  RETURNING o.*;
$fn$;

-- Record the outcome of one send attempt. Failures back off exponentially
-- (1, 2, 4, 8, 16 min …) and stop at max_attempts with status 'failed'.
CREATE OR REPLACE FUNCTION public.smc_complete_outbox(
  p_id UUID, p_success BOOLEAN, p_provider_message_id TEXT, p_error TEXT
)
RETURNS VOID
LANGUAGE sql
SET search_path = ''
AS $fn$
  UPDATE public.email_outbox
  SET status = CASE
                 WHEN p_success THEN 'sent'
                 WHEN attempts >= max_attempts THEN 'failed'
                 ELSE 'pending'
               END,
      sent_at = CASE WHEN p_success THEN NOW() ELSE sent_at END,
      provider_message_id = COALESCE(p_provider_message_id, provider_message_id),
      last_error = CASE WHEN p_success THEN NULL ELSE p_error END,
      next_attempt_at = CASE WHEN p_success THEN next_attempt_at
                             ELSE NOW() + make_interval(mins => power(2, GREATEST(attempts - 1, 0))::INTEGER) END,
      locked_until = NULL
  WHERE id = p_id AND status = 'sending';
$fn$;

-- ── Function privileges: service role only ───────────────────
REVOKE EXECUTE ON FUNCTION public.smc_seats_taken(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_event_availability(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_create_registration(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_attach_checkout_session(UUID, TEXT, TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_mark_awaiting_payment(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_release_registration(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_fulfill_registration(TEXT, TEXT, INTEGER, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_claim_outbox(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.smc_complete_outbox(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.smc_seats_taken(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_event_availability(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_create_registration(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_attach_checkout_session(UUID, TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_mark_awaiting_payment(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_release_registration(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_fulfill_registration(TEXT, TEXT, INTEGER, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_claim_outbox(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.smc_complete_outbox(UUID, BOOLEAN, TEXT, TEXT) TO service_role;
