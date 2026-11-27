alter table public.guest_credits drop column if exists hold_until, drop column if exists hold_amount, drop column if exists hold_key;
alter table public.bookings drop column if exists credit_used;
