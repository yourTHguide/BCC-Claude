-- Only safe once no 'date_proposal' / 'accept' rows exist.
alter table public.booking_options drop constraint if exists booking_options_choice_check;
alter table public.booking_options add constraint booking_options_choice_check check (choice in ('refund', 'move', 'credit'));
alter table public.booking_options drop column if exists owner_message;
alter table public.booking_options drop column if exists proposed_event_id;
alter table public.booking_options drop constraint if exists booking_options_reason_check;
alter table public.booking_options add constraint booking_options_reason_check check (reason in ('night_short', 'van2_short'));
