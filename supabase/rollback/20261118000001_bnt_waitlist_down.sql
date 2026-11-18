-- Rollback for 20261118000001_bnt_waitlist.sql. Deletes all waitlist sign-ups;
-- export them first if any exist:  select * from public.bnt_waitlist;
drop table if exists public.bnt_waitlist;
