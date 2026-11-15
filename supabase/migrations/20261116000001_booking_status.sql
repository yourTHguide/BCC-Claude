-- Finance reconciliation (16 Nov 2026): one booking status used everywhere,
-- the originally booked date for reschedules, the Stripe charge id finance
-- matches on, and whether a night actually ran.
--
-- booking_status (NULL = upcoming / not settled yet):
--   attended                  guest came            → guest + revenue
--   no_show                   paid, didn't come     → revenue only
--   late_cancel_paid          cancelled late, paid  → revenue only
--   rescheduled               moved to this night   → guest + revenue (booked_for_date = original night)
--   didnt_happen_refund_owed  night didn't run      → neither (record kept)
--   refunded                  refund confirmed      → neither (record kept)

alter table bookings
  add column if not exists booking_status text,
  add column if not exists booked_for_date date,
  add column if not exists stripe_charge_id text;
alter table ota_bookings
  add column if not exists booking_status text,
  add column if not exists booked_for_date date;

alter table bookings drop constraint if exists bookings_booking_status_check;
alter table bookings add constraint bookings_booking_status_check check (booking_status is null or booking_status in
  ('attended','no_show','late_cancel_paid','rescheduled','didnt_happen_refund_owed','refunded'));
alter table ota_bookings drop constraint if exists ota_bookings_booking_status_check;
alter table ota_bookings add constraint ota_bookings_booking_status_check check (booking_status is null or booking_status in
  ('attended','no_show','late_cancel_paid','rescheduled','didnt_happen_refund_owed','refunded'));

-- night_status (NULL = not settled yet): ran | didnt_run | didnt_run_late_cancel_income
alter table event_dates add column if not exists night_status text;
alter table event_dates drop constraint if exists event_dates_night_status_check;
alter table event_dates add constraint event_dates_night_status_check check (night_status is null or night_status in
  ('ran','didnt_run','didnt_run_late_cancel_income'));
