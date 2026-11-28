-- "Your night" page (owner, 28 Nov 2026): one link for every guest
-- (bkkclubcrawl.com/night). The guest leaves the name on their booking,
-- email, WhatsApp number and the date they booked. We match it against that
-- date's bookings (website, imported OTA, and Bókun live); only matched guests
-- ever get the WhatsApp group link and meeting point. Unmatched entries are
-- re-checked every 15 minutes and then shown to the owner to match or ignore.
create table if not exists public.night_joins (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  name            text not null,
  email           text,
  phone           text not null,            -- +<country><number>, digits only after +
  event_date      date not null,
  device_hash     text not null,            -- the guest's phone/browser (cookie), hashed
  status          text not null default 'pending' check (status in ('matched', 'pending', 'ignored')),
  match_kind      text check (match_kind in ('bookings', 'ota_bookings', 'bokun', 'owner')),
  booking_id      uuid,                      -- bookings.id or ota_bookings.id
  bokun_booking_id text,
  event_id        uuid references public.event_dates(id) on delete set null,
  matched_name    text,
  matched_at      timestamptz,
  checks          integer not null default 0,
  last_checked_at timestamptz,
  sent_at         timestamptz,               -- owner sent the group link on WhatsApp
  guest_id        uuid references public.guests(id) on delete set null
);
create index if not exists night_joins_date_idx on public.night_joins (event_date, status);
create index if not exists night_joins_device_idx on public.night_joins (device_hash, created_at desc);
alter table public.night_joins enable row level security;
