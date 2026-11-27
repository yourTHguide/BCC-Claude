-- Phase 3D part 3b (Nov 2026): guests use their credit to book again.
-- bookings.credit_used: credit applied to a booking (THB). total_paid stays the
--   money actually charged (what Stripe/finance match); revenue = total_paid + credit_used.
-- guest_credits hold: while a guest is at Stripe checkout paying the difference,
--   the credit is held for that checkout (30 min) so it can't be used twice.
alter table public.bookings add column if not exists credit_used integer not null default 0 check (credit_used >= 0);
alter table public.guest_credits
  add column if not exists hold_key text,
  add column if not exists hold_amount integer,
  add column if not exists hold_until timestamptz;
