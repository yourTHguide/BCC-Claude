-- Rollback for 20261128000001_host_invites.sql. Refuses while any booking is
-- credited to a host, so no commission record is lost by accident.
do $$ begin
  if exists (select 1 from public.bookings where host_invite_id is not null) then
    raise exception 'bookings are credited to host invites; export them before rolling back';
  end if;
end $$;
drop index if exists public.bookings_host_invite_once;
alter table public.bookings drop column if exists host_commission_paid_at;
alter table public.bookings drop column if exists host_invite_id;
drop table if exists public.host_invites;
