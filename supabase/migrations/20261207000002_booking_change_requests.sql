-- Self-service changes in My account (owner, 28 Nov 2026). Tickets are
-- non-refundable; a guest can move their booking to another night, or turn it
-- into credit (12 months), on their own from 7+ days before the night.
-- Inside 7 days it becomes a request the owner approves or declines.
create table if not exists public.booking_change_requests (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references public.bookings(id) on delete cascade,
  guest_id        uuid references public.guests(id) on delete set null,
  kind            text not null check (kind in ('move', 'credit')),
  target_event_id uuid references public.event_dates(id) on delete set null,
  note            text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_note   text
);
create unique index if not exists booking_change_requests_one_pending on public.booking_change_requests (booking_id) where status = 'pending';
create index if not exists booking_change_requests_status_idx on public.booking_change_requests (status, created_at);
alter table public.booking_change_requests enable row level security;
