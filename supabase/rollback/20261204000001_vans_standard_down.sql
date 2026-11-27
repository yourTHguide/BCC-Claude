-- Rollback for 20261204000001_vans_standard.sql: removes the default rule.
-- Nights keep their van setting; set capacity back by hand if needed.
drop trigger if exists bcc_night_van_defaults on public.event_dates;
drop function if exists public.bcc_night_van_defaults();
