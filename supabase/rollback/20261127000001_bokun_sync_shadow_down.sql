-- Rollback for 20261127000001_bokun_sync_shadow.sql. Removes only the
-- Bókun sync tables (a copy of Bókun data; Bókun itself is the source).
-- Stop the schedule first: select cron.unschedule('bokun-sync');
drop table if exists public.bokun_sync_log;
drop table if exists public.bokun_sync_runs;
drop table if exists public.bokun_bookings;
