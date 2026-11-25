-- Rollback for 20261125000001_bcc_updates_optin.sql.
-- Roll back the code first. Export the list if you want to keep it:
--   select * from bnt_waitlist where consent_scope = 'bcc_updates';
-- Refuses to run while such rows exist, so the rollback never deletes
-- customer data by itself.
do $$ begin
  if exists (select 1 from public.bnt_waitlist where consent_scope = 'bcc_updates') then
    raise exception 'bcc_updates rows exist: export them and remove them deliberately before rolling back';
  end if;
end $$;

drop index if exists public.bnt_waitlist_updates_email_uidx;
alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_scope_shape_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_scope_shape_check check (
    (consent_scope = 'event_dates' and event_date_id is null and party_size is null)
    or (consent_scope = 'sold_out_date' and event_date_id is not null and event_date is not null
        and party_size between 1 and 24 and consented_at is not null and consent_text is not null)
  );
alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_consent_scope_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates', 'sold_out_date'));
