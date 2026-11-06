-- Per-guest record of the confirmed-meetup email, so a late booking can be
-- sent the meetup details without re-emailing everyone already sent.
-- Applied to production 2026-11-06.
alter table public.bookings add column if not exists meetup_sent_at timestamptz;
alter table public.ota_bookings add column if not exists meetup_sent_at timestamptz;
comment on column public.bookings.meetup_sent_at is 'When this guest was last sent the confirmed-meetup email (null = never).';
comment on column public.ota_bookings.meetup_sent_at is 'When this guest was last sent the confirmed-meetup email (null = never).';
