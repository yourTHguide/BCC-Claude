-- Vans are the standard (owner decision, 28 Nov 2026): every Club Crawl
-- night runs 1 van (10 seats) or 2 vans (20). No "no vans" option.
-- 1) New Club Crawl nights get 1 van / 10 seats however they are created
--    (weekly schedules, Add night, Bókun import, moved guests).
-- 2) Future nights switch to 1 van / 10 seats, or 2 vans / 20 if more than
--    10 guests are already booked (nobody loses a seat).

create or replace function public.bcc_night_van_defaults() returns trigger language plpgsql as $$
begin
  if new.product_id = (select id from public.products where slug = 'bangkok-club-crawl') then
    new.van_count := coalesce(new.van_count, 1);
    if new.capacity is null or (tg_op = 'INSERT' and new.capacity = 12) then
      new.capacity := 10 * new.van_count;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bcc_night_van_defaults on public.event_dates;
create trigger bcc_night_van_defaults before insert on public.event_dates
  for each row execute function public.bcc_night_van_defaults();

with bcc as (
  select e.id, e.event_date, e.night_slug from public.event_dates e
  join public.products p on p.id = e.product_id
  where p.slug = 'bangkok-club-crawl' and e.event_date >= (now() at time zone 'Asia/Bangkok')::date and e.van_count is null
), taken as (
  select bcc.id,
    coalesce((select sum(quantity) from public.bookings b where b.event_date = bcc.event_date and b.night_slug = bcc.night_slug and b.status = 'confirmed'), 0)
    + coalesce((select sum(quantity) from public.ota_bookings o where o.event_date = bcc.event_date and o.night_slug = bcc.night_slug and coalesce(o.booking_status, '') not in ('refunded', 'didnt_happen_refund_owed')), 0) as n
  from bcc
)
update public.event_dates e
set van_count = case when t.n > 10 then 2 else 1 end,
    capacity  = case when t.n > 10 then 20 else 10 end
from taken t where e.id = t.id;
