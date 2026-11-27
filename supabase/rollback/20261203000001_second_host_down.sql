-- Rollback for 20261203000001_second_host.sql. Refuses while any night has two reports.
do $$ begin
  if exists (select event_id from public.host_reports group by event_id having count(*) > 1) then
    raise exception 'some nights have two host reports; resolve them first';
  end if;
end $$;
alter table public.host_reports drop column if exists paid_at, drop column if exists fee_thb;
drop index if exists public.host_reports_event_host_key;
alter table public.host_reports add constraint host_reports_event_id_key unique (event_id);
alter table public.event_dates drop column if exists host_assigned_2;
