-- Bókun sync, step 2 (shadow mode, Nov 2026). New tables only; nothing
-- existing is changed. In shadow mode the sync reads Bókun, keeps one row per
-- Bókun booking here, and logs what it WOULD do (create a night, open a
-- night). It never writes to ota_bookings or event_dates, so live nights,
-- seat counts and the website are unaffected.
-- Service role only (RLS on, no policies), like the other admin tables.

create table if not exists public.bokun_bookings (
  bokun_booking_id text primary key,       -- Bókun's own booking id
  bokun_code       text,                   -- e.g. ABNB-109973534
  platform_code    text,                   -- the platform's code (TA…, GYG…, Viator number) = ota_bookings.booking_ref
  source           text not null,          -- airbnb | getyourguide | viator | other
  channel_title    text,
  status           text not null,          -- Bókun status as given (CONFIRMED, CANCELLED, …)
  event_date       date not null,
  guests           integer not null default 0,
  guest_name       text,
  email            text,                   -- the guest's real email only
  email_masked     text,                   -- platform forwarding address: never a contact email, never on any list
  phone            text,
  product_id       bigint,
  fingerprint      text not null,          -- detects changes between reads
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  last_changed_at  timestamptz not null default now()
);
create index if not exists bokun_bookings_event_date_idx on public.bokun_bookings (event_date);
create index if not exists bokun_bookings_platform_code_idx on public.bokun_bookings (upper(platform_code));
alter table public.bokun_bookings enable row level security;

create table if not exists public.bokun_sync_runs (
  id          uuid primary key default gen_random_uuid(),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  mode        text not null default 'shadow' check (mode in ('shadow', 'live')),
  trigger     text not null check (trigger in ('schedule', 'manual')),
  ok          boolean,
  fetched     integer,
  added       integer,
  changed     integer,
  error       text
);
create index if not exists bokun_sync_runs_started_idx on public.bokun_sync_runs (started_at desc);
alter table public.bokun_sync_runs enable row level security;

-- What the sync did (live) or would have done (shadow), once per night.
create table if not exists public.bokun_sync_log (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid references public.bokun_sync_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  mode       text not null check (mode in ('shadow', 'live')),
  kind       text not null check (kind in ('create_night', 'open_night')),
  event_date date not null,
  detail     jsonb not null default '{}'::jsonb,
  unique (mode, kind, event_date)
);
alter table public.bokun_sync_log enable row level security;
