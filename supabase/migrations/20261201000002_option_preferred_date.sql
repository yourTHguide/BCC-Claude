-- A guest moving to another date can pick any Friday/Saturday in the next
-- 3 months, even before that night exists (owner decision, 27 Nov 2026).
alter table public.booking_options add column if not exists preferred_date date;
