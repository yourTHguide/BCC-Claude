-- Rollback for 20261013000001_smc_registration.sql (production applied 14 Oct 2026).
-- NOT applied. Run only if the owner decides to remove SMC from the database.
-- Removes exactly what the migration added; existing BCC/NIB data is untouched.
-- Remove any SMC catalogue rows (product 'smc', its event_dates/product_content)
-- first, and only if no real SMC bookings exist.

DROP FUNCTION IF EXISTS public.smc_complete_outbox(UUID, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.smc_claim_outbox(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.smc_fulfill_registration(TEXT, TEXT, INTEGER, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.smc_release_registration(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.smc_mark_awaiting_payment(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.smc_attach_checkout_session(UUID, TEXT, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.smc_create_registration(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS public.smc_event_availability(UUID);
DROP FUNCTION IF EXISTS public.smc_seats_taken(UUID, UUID);

DROP TABLE IF EXISTS public.email_outbox;
DROP TABLE IF EXISTS public.booking_attendees;
DROP TABLE IF EXISTS public.stripe_webhook_events;
DROP TABLE IF EXISTS public.smc_registrations;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS is_test;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS payment_method;
