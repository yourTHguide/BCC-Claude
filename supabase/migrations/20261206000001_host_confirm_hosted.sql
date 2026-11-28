-- Nights before reports started (26 Nov 2026) need no report: the host just
-- confirms they hosted. Marked so the owner sees why there's no content.
alter table public.host_reports add column if not exists confirmed_only boolean not null default false;
