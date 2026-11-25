-- Phase 3B (Nov 2026): Bangkok Club Crawl sold-out waitlist + reopen notice.
-- Reuses the existing BEST waitlist tables (bnt_waitlist, announcements,
-- deliveries, unsubscribe tokens) instead of adding a new system.
--
-- Additive and backward-compatible:
--   * new nullable columns only; no column dropped or retyped
--   * every existing row is consent_scope 'event_dates' with no date and
--     passes every new check unchanged
--   * the (product_slug, email) unique constraint becomes an equivalent
--     partial unique index for 'event_dates' rows (same rule for every
--     existing row), plus (event_date_id, email) for 'sold_out_date' rows
-- No change to bookings, event_dates, products, Stripe or prices.
-- Event instances with sign-ups cannot be hard-deleted (FK restrict), so
-- customer sign-ups are never removed as a side effect.
-- Rollback: supabase/rollback/20261122000001_bcc_soldout_waitlist_down.sql

-- 1. Sign-ups: optional event instance + party size.
alter table public.bnt_waitlist
  add column if not exists event_date_id uuid references public.event_dates(id) on delete restrict,
  add column if not exists event_date date,   -- snapshot for display / audit
  add column if not exists night_slug text,   -- snapshot for display / audit
  add column if not exists party_size smallint;

alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_consent_scope_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates', 'sold_out_date'));

-- A sold-out sign-up must name one date, a party size and carry its dated
-- consent; a product-dates sign-up must not carry a date.
do $$ begin
  alter table public.bnt_waitlist
    add constraint bnt_waitlist_scope_shape_check check (
      (consent_scope = 'event_dates' and event_date_id is null and party_size is null)
      or (consent_scope = 'sold_out_date' and event_date_id is not null and event_date is not null
          and party_size between 1 and 24 and consented_at is not null and consent_text is not null)
    );
exception when duplicate_object then null; end $$;

create unique index if not exists bnt_waitlist_product_email_uidx
  on public.bnt_waitlist (product_slug, email) where consent_scope = 'event_dates';
create unique index if not exists bnt_waitlist_date_email_uidx
  on public.bnt_waitlist (event_date_id, email) where consent_scope = 'sold_out_date';
-- Replaced by bnt_waitlist_product_email_uidx (identical for every existing row).
alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_product_email_key;

-- 2. Announcements: a second kind, scoped to one event instance.
alter table public.bnt_waitlist_announcements
  add column if not exists kind text not null default 'product_dates',
  add column if not exists event_date_id uuid references public.event_dates(id) on delete restrict,
  add column if not exists max_party_size smallint,   -- largest party the admin approved to notify
  add column if not exists seats_at_draft smallint;   -- seats left when drafted (audit)

do $$ begin
  alter table public.bnt_waitlist_announcements
    add constraint bnt_waitlist_announcements_kind_check check (
      (kind = 'product_dates' and event_date_id is null)
      or (kind = 'sold_out_reopen' and event_date_id is not null and max_party_size between 1 and 24)
    );
exception when duplicate_object then null; end $$;

-- At most one unfinished reopen notice per date (double clicks, two admins).
create unique index if not exists bnt_waitlist_announcements_one_open_reopen_uidx
  on public.bnt_waitlist_announcements (event_date_id)
  where kind = 'sold_out_reopen' and status in ('draft', 'sending');

-- 3. Deliveries: 'skipped' = re-checked at send time and not sent (party
-- too large for the seats left, already booked, unsubscribed...). Nothing
-- went to the provider, so it never needs review.
alter table public.bnt_waitlist_deliveries drop constraint if exists bnt_waitlist_deliveries_status_check;
alter table public.bnt_waitlist_deliveries
  add constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed', 'unconfirmed', 'skipped'));

comment on column public.bnt_waitlist.event_date_id is
  'Set only for consent_scope sold_out_date: the one Bangkok Club Crawl event instance this person asked about. Never used for any other date or product.';
comment on column public.bnt_waitlist.party_size is
  'Seats wanted (sold_out_date only). A reopen notice goes only to people whose party fits the seats left.';
