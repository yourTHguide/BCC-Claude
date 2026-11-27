-- My account (Nov 2026): guests sign in with a 6-digit code sent to their
-- email (valid 15 minutes, 5 tries), then stay signed in for 30 days.
-- Only hashes are stored; the code and the session key never sit in the
-- database. Server-only tables (RLS on, no policies).

create table if not exists public.guest_login_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(email)),
  code_hash   text not null,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists guest_login_codes_email_idx on public.guest_login_codes (email, created_at desc);
alter table public.guest_login_codes enable row level security;

create table if not exists public.guest_sessions (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid not null references public.guests(id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index if not exists guest_sessions_guest_idx on public.guest_sessions (guest_id);
alter table public.guest_sessions enable row level security;
