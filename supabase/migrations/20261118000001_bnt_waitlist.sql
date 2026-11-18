-- Phase 3 (Nov 2026): email waitlist for BEST events with no open dates
-- (first use: New in Bangkok "coming soon"). Additive only: one new table,
-- no change to any existing table, booking or payment path.
-- Written only by the server (/api/waitlist, service role). RLS on with no
-- policies, so the public anon key can neither read nor write it.
create table if not exists public.bnt_waitlist (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  email text not null,
  name text,
  source text,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint bnt_waitlist_email_lower check (email = lower(email)),
  constraint bnt_waitlist_product_email_key unique (product_slug, email)
);

alter table public.bnt_waitlist enable row level security;

comment on table public.bnt_waitlist is
  'BEST Nightlife Thailand event waitlist (email). Server-only writes via /api/waitlist.';
