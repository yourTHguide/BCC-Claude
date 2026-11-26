-- Host after-event report and host-paid expenses (Nov 2026). Additive only.
--
-- host_reports: one per night, written by the host after the night. Draft
--   until submitted; the owner reviews it. Guest notes (tags, next stop,
--   comment), a vibe paragraph, one short comment per venue, incidents.
-- host_expenses: what a host paid out of pocket, with an optional receipt.
--   Waits for the owner's approval; on approval a row is copied into the
--   existing `expenses` table (expense_id), so Operations/Closeout totals only
--   ever include approved host expenses. Rejected ones are never counted.
-- Receipts live in a PRIVATE storage bucket, read through short-lived links.

create table if not exists public.host_reports (
  id                     uuid primary key default gen_random_uuid(),
  event_id               uuid not null unique references public.event_dates(id) on delete restrict,
  host_user_id           uuid not null references public.admin_users(user_id) on delete restrict,
  host_name              text not null,
  status                 text not null default 'draft' check (status in ('draft', 'submitted')),
  vibe                   text,
  guests                 jsonb not null default '[]'::jsonb,   -- [{ key, name, quantity, attendance, tags[], nextStop, comment }]
  venues                 jsonb not null default '[]'::jsonb,   -- [{ venue, comment }]
  incidents              jsonb not null default '[]'::jsonb,   -- [{ type, what, action }]
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  submitted_at           timestamptz,
  incident_alert_sent_at timestamptz
);
create index if not exists host_reports_host_idx on public.host_reports (host_user_id);
alter table public.host_reports enable row level security;   -- service role only

create table if not exists public.host_expenses (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.event_dates(id) on delete restrict,
  host_user_id  uuid not null references public.admin_users(user_id) on delete restrict,
  host_name     text not null,
  category      text not null check (category in ('taxi', 'van', 'drinks', 'entry', 'other')),
  note          text,
  amount        integer not null check (amount > 0 and amount <= 100000),   -- THB
  receipt_path  text,                                                        -- object in the host-receipts bucket
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at   timestamptz,
  review_note   text,
  expense_id    uuid references public.expenses(id) on delete set null,     -- the approved copy
  created_at    timestamptz not null default now()
);
create index if not exists host_expenses_event_idx on public.host_expenses (event_id);
create index if not exists host_expenses_host_idx on public.host_expenses (host_user_id, created_at desc);
alter table public.host_expenses enable row level security;  -- service role only

-- Private bucket for receipts (images or PDF, up to 5 MB). No public access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('host-receipts', 'host-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;
