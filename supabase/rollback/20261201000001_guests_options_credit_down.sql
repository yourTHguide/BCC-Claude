-- Rollback for 20261201000001_guests_options_credit.sql. Refuses while any
-- option or credit exists (money owed to guests must not be lost).
do $$ begin
  if exists (select 1 from public.booking_options) or exists (select 1 from public.guest_credits) then
    raise exception 'booking options or guest credits exist; settle and export them first';
  end if;
end $$;
drop table if exists public.guest_credits;
drop table if exists public.booking_options;
drop table if exists public.guest_activity;
alter table public.ota_bookings drop column if exists guest_id;
alter table public.bookings drop column if exists guest_id;
drop table if exists public.guests;
