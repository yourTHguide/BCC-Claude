-- Phase 3D vans, part 1–2 (Nov 2026). Additive only.
-- A Club Crawl night can run with vans: 10 guests + 1 host each. Van 1 runs at
-- 5 guests, van 2 at 4. The existing capacity column stays the single seat
-- gate everywhere (calendar, checkout, waitlist, Bókun): 2 vans = 20 seats,
-- 1 van = 10; closing van 2 lowers capacity so sales stop. Owner decides at
-- 7 PM (go / no-go) and, if van 2 is still open with guests, at 8 PM.

alter table public.event_dates
  add column if not exists van_count integer check (van_count is null or van_count in (1, 2)),  -- null = no vans (old 12-seat nights)
  add column if not exists van2_state text not null default 'open' check (van2_state in ('open', 'running', 'closed'));

-- One reminder email per night per kind, even if the scheduler retries.
create table if not exists public.van_reminders (
  event_id uuid not null references public.event_dates(id) on delete cascade,
  kind     text not null check (kind in ('7pm', '8pm')),
  sent_at  timestamptz not null default now(),
  primary key (event_id, kind)
);
alter table public.van_reminders enable row level security;   -- service role only
