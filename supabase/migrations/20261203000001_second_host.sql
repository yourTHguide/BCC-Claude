-- Phase 3D part 4 (Nov 2026): a second host per night (e.g. Van 2).
-- Both hosts see the night and all its guests; each writes their own report
-- and is paid their own fee once their report is in. event_dates.host_fee_final
-- / host_payment_status stay the night's totals for Closeout and Operations
-- (sum of the hosts' fees; Paid when every host is paid).
alter table public.event_dates add column if not exists host_assigned_2 text;

alter table public.host_reports drop constraint if exists host_reports_event_id_key;
create unique index if not exists host_reports_event_host_key on public.host_reports (event_id, host_user_id);
alter table public.host_reports
  add column if not exists fee_thb integer check (fee_thb is null or fee_thb >= 0),
  add column if not exists paid_at timestamptz;
