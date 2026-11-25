-- Rollback for 20261122000001_bcc_soldout_waitlist.sql.
-- 1. Roll back the CODE first (promote the previous Vercel deployment).
-- 2. Export sold-out sign-ups and reopen notices you want to keep:
--      select * from bnt_waitlist where consent_scope = 'sold_out_date';
--      select * from bnt_waitlist_announcements where kind = 'sold_out_reopen';
--      select d.* from bnt_waitlist_deliveries d join bnt_waitlist_announcements a on a.id = d.announcement_id where a.kind = 'sold_out_reopen';
-- 3. Run this. It refuses to run while sold-out rows exist, so customer
--    data is never deleted by the rollback itself. After exporting, an
--    owner removes those rows deliberately, then re-runs.
-- New in Bangkok sign-ups (consent_scope 'event_dates') are untouched.

do $$ begin
  if exists (select 1 from public.bnt_waitlist where consent_scope = 'sold_out_date')
     or exists (select 1 from public.bnt_waitlist_announcements where kind = 'sold_out_reopen') then
    raise exception 'sold-out waitlist rows exist: export them and remove them deliberately before rolling back';
  end if;
end $$;

update public.bnt_waitlist_deliveries set status = 'failed', error = coalesce(error, 'skipped') where status = 'skipped';
alter table public.bnt_waitlist_deliveries drop constraint if exists bnt_waitlist_deliveries_status_check;
alter table public.bnt_waitlist_deliveries
  add constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed', 'unconfirmed'));

drop index if exists public.bnt_waitlist_announcements_one_open_reopen_uidx;
alter table public.bnt_waitlist_announcements
  drop constraint if exists bnt_waitlist_announcements_kind_check,
  drop column if exists seats_at_draft,
  drop column if exists max_party_size,
  drop column if exists event_date_id,
  drop column if exists kind;

alter table public.bnt_waitlist
  add constraint bnt_waitlist_product_email_key unique (product_slug, email);
drop index if exists public.bnt_waitlist_date_email_uidx;
drop index if exists public.bnt_waitlist_product_email_uidx;
alter table public.bnt_waitlist
  drop constraint if exists bnt_waitlist_scope_shape_check,
  drop constraint if exists bnt_waitlist_consent_scope_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates'));
alter table public.bnt_waitlist
  drop column if exists party_size,
  drop column if exists night_slug,
  drop column if exists event_date,
  drop column if exists event_date_id;
