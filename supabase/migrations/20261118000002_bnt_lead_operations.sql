-- Phase 3 finalization (Nov 2026): BEST lead operations.
-- Additive and backward-compatible: only ADD COLUMN IF NOT EXISTS, new
-- constraints, two new tables, and backfills that copy (never move or
-- delete) data. No existing column is changed or dropped; historical
-- preferred_vibe / inquiry_type text is left exactly as it was.
-- Touches only bnt_experience_inquiries, bnt_contact_messages, bnt_waitlist
-- and two new bnt_waitlist_* tables. Nothing in bookings, event_dates,
-- products, Stripe or BCC.
-- Rollback: supabase/rollback/20261118000002_bnt_lead_operations_down.sql

-- 1. Private inquiries: one column per answer, plus light lead tracking.
alter table public.bnt_experience_inquiries
  add column if not exists email text,
  add column if not exists experience text,
  add column if not exists request_details text,   -- guest's step-3 answers + free-text notes
  add column if not exists notes text,             -- internal team notes
  add column if not exists source text,            -- which form/page (not ad attribution: Phase 4)
  add column if not exists form_version smallint,  -- null/1 = legacy packed text, 2 = structured
  add column if not exists status text not null default 'new',
  add column if not exists alert_status text,
  add column if not exists alert_sent_at timestamptz,
  add column if not exists alert_error text,
  add column if not exists status_changed_at timestamptz,          -- last status change by staff (retention clock)
  add column if not exists retention_hold boolean not null default false; -- active relationship / dispute / legal

do $$ begin
  alter table public.bnt_experience_inquiries
    add constraint bnt_experience_inquiries_status_check
    check (status in ('new', 'contacted', 'closed', 'spam'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.bnt_experience_inquiries
    add constraint bnt_experience_inquiries_alert_status_check
    check (alert_status is null or alert_status in ('pending', 'sent', 'failed'));
exception when duplicate_object then null; end $$;

-- Backfill from Phase 3 rows (email was written as "Email: x" in
-- preferred_vibe; experience as "Private Inquiry · <title>"). Copies only.
update public.bnt_experience_inquiries
   set email = lower(substring(preferred_vibe from '(?:^|\n|\] )Email: ([^\s\n]+@[^\s\n]+)'))
 where email is null
   and preferred_vibe ~ '(?:^|\n|\] )Email: [^\s\n]+@[^\s\n]+';

update public.bnt_experience_inquiries
   set experience = nullif(trim(split_part(inquiry_type, ' · ', 2)), '')
 where experience is null
   and inquiry_type like '% · %';

update public.bnt_experience_inquiries
   set source = 'bnt_home_private_inquiry'
 where source is null;

-- 2. Contact messages: same light tracking.
alter table public.bnt_contact_messages
  add column if not exists source text,
  add column if not exists status text not null default 'new',
  add column if not exists alert_status text,
  add column if not exists alert_sent_at timestamptz,
  add column if not exists alert_error text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists retention_hold boolean not null default false;

do $$ begin
  alter table public.bnt_contact_messages
    add constraint bnt_contact_messages_status_check
    check (status in ('new', 'contacted', 'closed', 'spam'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.bnt_contact_messages
    add constraint bnt_contact_messages_alert_status_check
    check (alert_status is null or alert_status in ('pending', 'sent', 'failed'));
exception when duplicate_object then null; end $$;

update public.bnt_contact_messages set source = 'bnt_contact_page' where source is null;

-- 3. Waitlist: consent record, unsubscribe, alert tracking.
-- consent_scope 'event_dates' = "email me about new dates for THIS product".
-- It is deliberately the only allowed value: any broader use (newsletters,
-- other products such as a future Bangkok Mixer) needs a new, separate
-- opt-in and a deliberate migration, not a silent reuse of these sign-ups.
alter table public.bnt_waitlist
  add column if not exists consent_scope text not null default 'event_dates',
  add column if not exists consent_text text,
  add column if not exists consented_at timestamptz,
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists alert_status text,
  add column if not exists alert_sent_at timestamptz,
  add column if not exists alert_error text;

update public.bnt_waitlist set consented_at = created_at where consented_at is null;

do $$ begin
  alter table public.bnt_waitlist
    add constraint bnt_waitlist_unsubscribe_token_key unique (unsubscribe_token);
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.bnt_waitlist
    add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates'));
exception when duplicate_object then null; end $$;

comment on column public.bnt_waitlist.notified_at is
  'Last time this subscriber was sent an announcement (see bnt_waitlist_deliveries for history).';

-- 4. Announcements (human-approved) and per-recipient deliveries.
create table if not exists public.bnt_waitlist_announcements (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null,
  event_date_ids uuid[] not null default '{}',
  dates_summary text not null,
  subject text not null,
  intro text,
  status text not null default 'draft',
  created_by text,
  created_at timestamptz not null default now(),
  approved_by text,
  approved_at timestamptz,
  completed_at timestamptz,
  constraint bnt_waitlist_announcements_status_check
    check (status in ('draft', 'sending', 'sent', 'cancelled'))
);

create table if not exists public.bnt_waitlist_deliveries (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.bnt_waitlist_announcements(id) on delete cascade,
  waitlist_id uuid not null references public.bnt_waitlist(id) on delete cascade,
  status text not null default 'pending',
  resend_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint bnt_waitlist_deliveries_once unique (announcement_id, waitlist_id),
  constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed'))
);

-- Delivery recovery (pre-release review): a row is claimed (pending), then
-- the send is *attempted* (attempted_at set atomically), then the outcome is
-- recorded. pending + attempted_at set + no outcome = we don't know whether
-- Resend accepted it (timeout / interrupted request). Such rows are never
-- re-sent automatically; an admin resolves them ('unconfirmed' = leave it,
-- or explicitly re-queue). 'failed' is only used when Resend definitely
-- rejected the message, so retrying a failed row cannot duplicate.
alter table public.bnt_waitlist_deliveries
  add column if not exists attempted_at timestamptz,
  add column if not exists attempts smallint not null default 0,
  add column if not exists resolved_by text,
  add column if not exists resolved_at timestamptz;

alter table public.bnt_waitlist_deliveries drop constraint if exists bnt_waitlist_deliveries_status_check;
alter table public.bnt_waitlist_deliveries
  add constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed', 'unconfirmed'));

create index if not exists bnt_waitlist_deliveries_waitlist_idx on public.bnt_waitlist_deliveries (waitlist_id);

-- Server-only (service role). RLS on, no policies: the public anon key can
-- neither read nor write these tables.
alter table public.bnt_waitlist_announcements enable row level security;
alter table public.bnt_waitlist_deliveries enable row level security;

comment on table public.bnt_waitlist_announcements is
  'BEST waitlist announcements. Drafted and sent only by an admin from /dashboard/leads after confirming dates, price and availability. Never sent automatically.';
comment on table public.bnt_waitlist_deliveries is
  'One row per subscriber per announcement (unique). Prevents duplicate sends and records when each email went out.';
