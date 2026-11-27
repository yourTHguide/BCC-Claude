-- Phase 3D part 3a (Nov 2026): guest records, "not enough guests" options,
-- and credit. Additive; existing bookings are linked to guest records.
--
-- guests: one per email (lower-case), across brands. The start of guest
--   accounts; bookings and OTA bookings point at it (guest_id).
-- guest_activity: what happened to a guest's bookings (booked, refunded,
--   moved, credited, chose an option…), for history and repeat-guest care.
-- booking_options: when a night (under 5) or van 2 (under 4) doesn't run, each
--   website guest gets a personal link to choose a full refund, a move to
--   another date (with a preference), or credit. The owner approves each.
--   24 h without a choice → reminder; 48 h → credit (refundable on request).
-- guest_credits: money kept for a guest's next booking, valid 12 months,
--   refundable on request until used.

create table if not exists public.guests (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(email) and email like '%@%'),
  name       text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.guests enable row level security;

alter table public.bookings add column if not exists guest_id uuid references public.guests(id) on delete set null;
alter table public.ota_bookings add column if not exists guest_id uuid references public.guests(id) on delete set null;
create index if not exists bookings_guest_idx on public.bookings (guest_id);
create index if not exists ota_bookings_guest_idx on public.ota_bookings (guest_id);

create table if not exists public.guest_activity (
  id         uuid primary key default gen_random_uuid(),
  guest_id   uuid not null references public.guests(id) on delete cascade,
  kind       text not null,          -- booked | option_sent | option_chosen | refunded | moved | credited | credit_used | credit_refunded
  booking_id uuid,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists guest_activity_guest_idx on public.guest_activity (guest_id, created_at desc);
alter table public.guest_activity enable row level security;

create table if not exists public.booking_options (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings(id) on delete restrict,
  guest_id           uuid references public.guests(id) on delete set null,
  event_id           uuid not null references public.event_dates(id) on delete restrict,
  reason             text not null check (reason in ('night_short', 'van2_short')),
  token              text not null unique,
  sent_at            timestamptz not null default now(),
  reminder_sent_at   timestamptz,
  choice             text check (choice in ('refund', 'move', 'credit')),
  preferred_event_id uuid references public.event_dates(id) on delete set null,
  preference_note    text,
  chosen_at          timestamptz,
  status             text not null default 'sent' check (status in ('sent', 'chosen', 'resolved', 'cancelled')),
  resolution         text check (resolution in ('refunded', 'moved', 'credited')),
  resolved_at        timestamptz,
  resolved_note      text
);
-- One open option per booking at a time.
create unique index if not exists booking_options_one_open on public.booking_options (booking_id) where status in ('sent', 'chosen');
create index if not exists booking_options_event_idx on public.booking_options (event_id);
alter table public.booking_options enable row level security;

create table if not exists public.guest_credits (
  id                uuid primary key default gen_random_uuid(),
  guest_id          uuid not null references public.guests(id) on delete restrict,
  amount            integer not null check (amount > 0),      -- THB
  used_amount       integer not null default 0 check (used_amount >= 0),
  reason            text not null,
  source_booking_id uuid references public.bookings(id) on delete set null,
  option_id         uuid references public.booking_options(id) on delete set null,
  status            text not null default 'active' check (status in ('active', 'used', 'refunded', 'expired')),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  resolved_at       timestamptz,
  note              text
);
create index if not exists guest_credits_guest_idx on public.guest_credits (guest_id);
alter table public.guest_credits enable row level security;

-- Link existing website bookings to guest records (latest name/phone per email).
insert into public.guests (email, name, phone)
select distinct on (lower(trim(guest_email))) lower(trim(guest_email)), nullif(trim(guest_name), ''), nullif(trim(coalesce(guest_phone, guest_whatsapp)), '')
from public.bookings
where guest_email like '%@%'
order by lower(trim(guest_email)), created_at desc
on conflict (email) do nothing;
update public.bookings b set guest_id = g.id from public.guests g where b.guest_id is null and g.email = lower(trim(b.guest_email));
-- OTA bookings with a real (not platform-forwarding) email.
update public.ota_bookings o set guest_id = g.id from public.guests g
where o.guest_id is null and o.guest_email like '%@%' and g.email = lower(trim(o.guest_email));
