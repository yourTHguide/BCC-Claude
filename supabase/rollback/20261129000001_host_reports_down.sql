-- Rollback for 20261129000001_host_reports.sql. Refuses while any report or
-- host expense exists (export first). Approved expenses already copied into
-- `expenses` stay there. Empty the host-receipts bucket in Storage before
-- deleting it.
do $$ begin
  if exists (select 1 from public.host_reports) or exists (select 1 from public.host_expenses) then
    raise exception 'host reports/expenses exist; export them before rolling back';
  end if;
end $$;
drop table if exists public.host_expenses;
drop table if exists public.host_reports;
delete from storage.buckets where id = 'host-receipts';
