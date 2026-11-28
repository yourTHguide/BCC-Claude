-- Review request email (owner, 28 Nov 2026): the day after the crawl (2 PM
-- Bangkok), each checked-in website guest gets one personal thank-you with
-- Google / TripAdvisor buttons and a private feedback box. One per booking;
-- at most one per guest email every 60 days. Server-only (RLS, no policies).
create table if not exists public.review_requests (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null unique references public.bookings(id) on delete cascade,
  guest_email  text not null,
  event_date   date not null,
  token        text not null unique,
  status       text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  error        text,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  feedback     text,
  feedback_at  timestamptz
);
create index if not exists review_requests_email_idx on public.review_requests (guest_email, created_at desc);
alter table public.review_requests enable row level security;
