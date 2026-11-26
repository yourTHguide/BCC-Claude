-- Phase 3C (Nov 2026): host invite links and commission.
-- A host creates one invite per guest (date + guest name/email/phone) and
-- sends the link. A booking paid through that link is credited to the host:
-- ฿ commission per paid ticket, earned once the night has happened, refunded
-- tickets excluded. One booking per link; unused links expire after 7 days.
-- Additive only: a new table and two nullable columns on bookings.

create table if not exists public.host_invites (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,              -- random, in the link
  host_user_id          uuid not null references public.admin_users(user_id) on delete restrict,
  host_name             text not null,                     -- shown to the guest and in the link
  host_email            text,                              -- to refuse self-referral
  event_id              uuid not null references public.event_dates(id) on delete restrict,
  guest_name            text not null,
  guest_email           text not null,
  guest_phone           text,
  commission_per_ticket integer not null check (commission_per_ticket >= 0),  -- THB, fixed when the link is made
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null,
  used_at               timestamptz,                       -- set once, when a payment claims the link
  booking_id            uuid references public.bookings(id) on delete set null,
  cancelled_at          timestamptz
);
create index if not exists host_invites_host_idx on public.host_invites (host_user_id, created_at desc);
create index if not exists host_invites_event_idx on public.host_invites (event_id);
alter table public.host_invites enable row level security;   -- service role only

alter table public.bookings
  add column if not exists host_invite_id uuid references public.host_invites(id) on delete set null,
  add column if not exists host_commission_paid_at timestamptz;
-- One booking per invite, even under webhook retries.
create unique index if not exists bookings_host_invite_once on public.bookings (host_invite_id) where host_invite_id is not null;
