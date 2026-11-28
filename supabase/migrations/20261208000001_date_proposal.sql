-- Propose a new date (owner, 28 Nov 2026). From the Bookings tab the owner
-- picks a night and proposes it to the guest by email; the guest accepts the
-- new date, keeps it as credit, or asks for a full refund. Same personal page,
-- reminders and 48 h credit as the "not enough guests" options.
alter table public.booking_options drop constraint if exists booking_options_reason_check;
alter table public.booking_options add constraint booking_options_reason_check check (reason in ('night_short', 'van2_short', 'date_proposal'));
alter table public.booking_options add column if not exists proposed_event_id uuid references public.event_dates(id) on delete set null;
alter table public.booking_options add column if not exists owner_message text;
alter table public.booking_options drop constraint if exists booking_options_choice_check;
alter table public.booking_options add constraint booking_options_choice_check check (choice in ('refund', 'move', 'credit', 'accept'));
