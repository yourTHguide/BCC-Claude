-- Rollback for 20261130000001_vans.sql. Turn vans off first (van_count null,
-- capacity back to 12) on any night that uses them.
drop table if exists public.van_reminders;
alter table public.event_dates drop column if exists van2_state;
alter table public.event_dates drop column if exists van_count;
