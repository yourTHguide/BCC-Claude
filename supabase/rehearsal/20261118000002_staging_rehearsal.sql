-- STAGING ONLY — project "BCC - Claude Staging" (jyhtznpethgzypblppnt).
-- NEVER run on production (oomhftxgvikzxlvqdcmr).
--
-- Rollback rehearsal for migration 20261118000002_bnt_lead_operations.
-- One transaction, ROLLBACK at the end: staging is left exactly as it was.
-- Steps: rollback script -> rows in today's production (Phase 3) format ->
-- migration run twice -> constraint checks -> result table -> ROLLBACK.
-- How to run: Supabase dashboard -> staging project -> SQL editor -> paste
-- the whole file -> Run. Read the result table; every "check:" row should
-- say rejected/accepted/yes as labelled, the two comparisons should be true.

begin;

create temp table _pre on commit drop as select
  (select count(*) from public.bnt_experience_inquiries) inq, (select count(*) from public.bnt_contact_messages) con,
  (select count(*) from public.bnt_waitlist) wl, (select count(*) from public.bnt_waitlist_deliveries) del;

-- 1. Rollback script (supabase/rollback/20261118000002_bnt_lead_operations_down.sql)
drop table if exists public.bnt_waitlist_deliveries;
drop table if exists public.bnt_waitlist_announcements;
alter table public.bnt_waitlist
  drop constraint if exists bnt_waitlist_consent_scope_check,
  drop constraint if exists bnt_waitlist_unsubscribe_token_key,
  drop column if exists alert_error, drop column if exists alert_sent_at, drop column if exists alert_status,
  drop column if exists unsubscribed_at, drop column if exists unsubscribe_token, drop column if exists consented_at,
  drop column if exists consent_text, drop column if exists consent_scope;
alter table public.bnt_contact_messages
  drop constraint if exists bnt_contact_messages_alert_status_check, drop constraint if exists bnt_contact_messages_status_check,
  drop column if exists retention_hold, drop column if exists status_changed_at, drop column if exists alert_error,
  drop column if exists alert_sent_at, drop column if exists alert_status, drop column if exists status, drop column if exists source;
alter table public.bnt_experience_inquiries
  drop constraint if exists bnt_experience_inquiries_alert_status_check, drop constraint if exists bnt_experience_inquiries_status_check,
  drop column if exists retention_hold, drop column if exists status_changed_at, drop column if exists alert_error,
  drop column if exists alert_sent_at, drop column if exists alert_status, drop column if exists status, drop column if exists form_version,
  drop column if exists source, drop column if exists notes, drop column if exists request_details, drop column if exists experience,
  drop column if exists email;
create temp table _r on commit drop as select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_experience_inquiries') inq_cols,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_contact_messages') contact_cols,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_waitlist') wl_cols,
  to_regclass('public.bnt_waitlist_announcements') is null and to_regclass('public.bnt_waitlist_deliveries') is null new_tables_gone;

-- 2. Rows in today's production (Phase 3) format
insert into public.bnt_experience_inquiries (name, whatsapp, occasion, is_flexible_date, preferred_vibe, inquiry_type)
values ('REHEARSAL p3 with email', '+66812345678', 'Romantic', true, E'[Flexible Date] Email: Guest@Example.com\nVibe: Chill', 'Private Inquiry · Yacht Party'),
       ('REHEARSAL p0 plain', '+66812345679', 'Celebration', false, E'Vibe: Party\nNotes: email me at notes@example.com', 'Private Inquiry');
insert into public.bnt_contact_messages (name, whatsapp, message) values ('REHEARSAL contact', '+66812345678', 'hi');
insert into public.bnt_waitlist (product_slug, email, name, source) values ('new-in-bkk', 'rehearsal-a@example.test', null, 'website'), ('new-in-bkk', 'rehearsal-b@example.test', 'B', 'website');
create temp table _before on commit drop as
  select md5(string_agg(t::text, '|' order by t.name)) h from (select name, whatsapp, occasion, is_flexible_date, preferred_vibe, inquiry_type from public.bnt_experience_inquiries) t;

-- 3. Migration (supabase/migrations/20261118000002_bnt_lead_operations.sql), run twice
do $mig$
declare i int;
begin
for i in 1..2 loop
  alter table public.bnt_experience_inquiries
    add column if not exists email text, add column if not exists experience text, add column if not exists request_details text,
    add column if not exists notes text, add column if not exists source text, add column if not exists form_version smallint,
    add column if not exists status text not null default 'new', add column if not exists alert_status text,
    add column if not exists alert_sent_at timestamptz, add column if not exists alert_error text,
    add column if not exists status_changed_at timestamptz, add column if not exists retention_hold boolean not null default false;
  begin alter table public.bnt_experience_inquiries add constraint bnt_experience_inquiries_status_check check (status in ('new', 'contacted', 'closed', 'spam')); exception when duplicate_object then null; end;
  begin alter table public.bnt_experience_inquiries add constraint bnt_experience_inquiries_alert_status_check check (alert_status is null or alert_status in ('pending', 'sent', 'failed')); exception when duplicate_object then null; end;
  update public.bnt_experience_inquiries set email = lower(substring(preferred_vibe from '(?:^|\n|\] )Email: ([^\s\n]+@[^\s\n]+)')) where email is null and preferred_vibe ~ '(?:^|\n|\] )Email: [^\s\n]+@[^\s\n]+';
  update public.bnt_experience_inquiries set experience = nullif(trim(split_part(inquiry_type, ' · ', 2)), '') where experience is null and inquiry_type like '% · %';
  update public.bnt_experience_inquiries set source = 'bnt_home_private_inquiry' where source is null;
  alter table public.bnt_contact_messages
    add column if not exists source text, add column if not exists status text not null default 'new', add column if not exists alert_status text,
    add column if not exists alert_sent_at timestamptz, add column if not exists alert_error text,
    add column if not exists status_changed_at timestamptz, add column if not exists retention_hold boolean not null default false;
  begin alter table public.bnt_contact_messages add constraint bnt_contact_messages_status_check check (status in ('new', 'contacted', 'closed', 'spam')); exception when duplicate_object then null; end;
  begin alter table public.bnt_contact_messages add constraint bnt_contact_messages_alert_status_check check (alert_status is null or alert_status in ('pending', 'sent', 'failed')); exception when duplicate_object then null; end;
  update public.bnt_contact_messages set source = 'bnt_contact_page' where source is null;
  alter table public.bnt_waitlist
    add column if not exists consent_scope text not null default 'event_dates', add column if not exists consent_text text,
    add column if not exists consented_at timestamptz, add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
    add column if not exists unsubscribed_at timestamptz, add column if not exists alert_status text,
    add column if not exists alert_sent_at timestamptz, add column if not exists alert_error text;
  update public.bnt_waitlist set consented_at = created_at where consented_at is null;
  begin alter table public.bnt_waitlist add constraint bnt_waitlist_unsubscribe_token_key unique (unsubscribe_token); exception when duplicate_object or duplicate_table then null; end;
  begin alter table public.bnt_waitlist add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates')); exception when duplicate_object then null; end;
  create table if not exists public.bnt_waitlist_announcements (id uuid primary key default gen_random_uuid(), product_slug text not null, event_date_ids uuid[] not null default '{}', dates_summary text not null, subject text not null, intro text, status text not null default 'draft', created_by text, created_at timestamptz not null default now(), approved_by text, approved_at timestamptz, completed_at timestamptz, constraint bnt_waitlist_announcements_status_check check (status in ('draft', 'sending', 'sent', 'cancelled')));
  create table if not exists public.bnt_waitlist_deliveries (id uuid primary key default gen_random_uuid(), announcement_id uuid not null references public.bnt_waitlist_announcements(id) on delete cascade, waitlist_id uuid not null references public.bnt_waitlist(id) on delete cascade, status text not null default 'pending', resend_id text, error text, created_at timestamptz not null default now(), sent_at timestamptz, constraint bnt_waitlist_deliveries_once unique (announcement_id, waitlist_id), constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed')));
  alter table public.bnt_waitlist_deliveries add column if not exists attempted_at timestamptz, add column if not exists attempts smallint not null default 0, add column if not exists resolved_by text, add column if not exists resolved_at timestamptz;
  alter table public.bnt_waitlist_deliveries drop constraint if exists bnt_waitlist_deliveries_status_check;
  alter table public.bnt_waitlist_deliveries add constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed', 'unconfirmed'));
  create index if not exists bnt_waitlist_deliveries_waitlist_idx on public.bnt_waitlist_deliveries (waitlist_id);
  alter table public.bnt_waitlist_announcements enable row level security;
  alter table public.bnt_waitlist_deliveries enable row level security;
  if i = 1 then
    create temp table _run1 on commit drop as select md5(string_agg(t::text, '|' order by t.name)) h from (select name, email, experience, source, status, retention_hold from public.bnt_experience_inquiries) t;
  end if;
end loop;
end $mig$;

-- 4. Constraint enforcement
create temp table _c (k text, v text) on commit drop;
do $chk$
declare a uuid; w uuid; w2 uuid;
begin
  select id into w from public.bnt_waitlist where email='rehearsal-a@example.test';
  select id into w2 from public.bnt_waitlist where email='rehearsal-b@example.test';
  insert into public.bnt_waitlist_announcements (product_slug, dates_summary, subject) values ('new-in-bkk','x','x') returning id into a;
  insert into public.bnt_waitlist_deliveries (announcement_id, waitlist_id) values (a, w);
  begin insert into public.bnt_waitlist_deliveries (announcement_id, waitlist_id) values (a, w); insert into _c values ('duplicate delivery (expect rejected)','ALLOWED'); exception when unique_violation then insert into _c values ('duplicate delivery (expect rejected)','rejected'); end;
  begin update public.bnt_waitlist_deliveries set status='unconfirmed' where announcement_id=a; insert into _c values ('status unconfirmed (expect accepted)','accepted'); exception when check_violation then insert into _c values ('status unconfirmed (expect accepted)','REJECTED'); end;
  begin update public.bnt_waitlist_deliveries set status='bogus' where announcement_id=a; insert into _c values ('invalid delivery status (expect rejected)','ALLOWED'); exception when check_violation then insert into _c values ('invalid delivery status (expect rejected)','rejected'); end;
  begin update public.bnt_waitlist set consent_scope='marketing' where id=w; insert into _c values ('widen consent to marketing (expect rejected)','ALLOWED'); exception when check_violation then insert into _c values ('widen consent to marketing (expect rejected)','rejected'); end;
  begin insert into public.bnt_waitlist (product_slug, email) values ('new-in-bkk','rehearsal-a@example.test'); insert into _c values ('duplicate sign-up (expect rejected)','ALLOWED'); exception when unique_violation then insert into _c values ('duplicate sign-up (expect rejected)','rejected'); end;
  begin insert into public.bnt_waitlist (product_slug, email) values ('new-in-bkk','UPPER@example.test'); insert into _c values ('uppercase email (expect rejected)','ALLOWED'); exception when check_violation then insert into _c values ('uppercase email (expect rejected)','rejected'); end;
  begin insert into public.bnt_contact_messages (name, whatsapp, status) values ('x','+66812345678','won'); insert into _c values ('invalid lead status (expect rejected)','ALLOWED'); exception when check_violation then insert into _c values ('invalid lead status (expect rejected)','rejected'); end;
  begin insert into public.bnt_experience_inquiries (name, whatsapp, alert_status) values ('x','+66812345678','maybe'); insert into _c values ('invalid alert status (expect rejected)','ALLOWED'); exception when check_violation then insert into _c values ('invalid alert status (expect rejected)','rejected'); end;
  delete from public.bnt_waitlist where id = w;
  insert into _c values ('erase subscriber cascades deliveries (expect yes)', case when exists (select 1 from public.bnt_waitlist_deliveries where waitlist_id = w) then 'NO' else 'yes' end);
  insert into _c values ('other subscriber untouched (expect yes)', case when exists (select 1 from public.bnt_waitlist where id = w2) then 'yes' else 'NO' end);
end $chk$;

-- 5. Results (read these before the ROLLBACK runs)
select 'staging rows before rehearsal' k, format('inquiries=%s contacts=%s waitlist=%s deliveries=%s', inq, con, wl, del) v from _pre
union all select 'after rollback script (expect 11/5/7, true)', format('inquiry cols=%s contact cols=%s waitlist cols=%s new tables gone=%s', inq_cols, contact_cols, wl_cols, new_tables_gone) from _r
union all select 'original Phase 3 data unchanged (expect true)', ((select h from _before) = (select md5(string_agg(t::text, '|' order by t.name)) from (select name, whatsapp, occasion, is_flexible_date, preferred_vibe, inquiry_type from public.bnt_experience_inquiries where name like 'REHEARSAL%') t))::text
union all select 'second migration run changed nothing (expect true)', ((select h from _run1) = (select md5(string_agg(t::text, '|' order by t.name)) from (select name, email, experience, source, status, retention_hold from public.bnt_experience_inquiries) t))::text
union all select 'backfill: '||name, format('email=%s experience=%s source=%s status=%s hold=%s', coalesce(email,'none'), coalesce(experience,'none'), source, status, retention_hold) from public.bnt_experience_inquiries where name like 'REHEARSAL%'
union all select 'contact backfill', format('source=%s status=%s', source, status) from public.bnt_contact_messages where name='REHEARSAL contact'
union all select 'waitlist backfill', format('scope=%s consented_at=%s token=%s', consent_scope, consented_at is not null, unsubscribe_token is not null) from public.bnt_waitlist where email='rehearsal-b@example.test'
union all select 'columns after migration (expect 23/12/15/12/12)', format('inq=%s contact=%s waitlist=%s ann=%s deliv=%s',
   (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_experience_inquiries'),
   (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_contact_messages'),
   (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_waitlist'),
   (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_waitlist_announcements'),
   (select count(*) from information_schema.columns where table_schema='public' and table_name='bnt_waitlist_deliveries'))
union all select 'RLS on new tables (expect true)', (select string_agg(relname||'='||relrowsecurity, ' ') from pg_class where relname in ('bnt_waitlist_announcements','bnt_waitlist_deliveries'))
union all select 'check: '||k, v from _c;

rollback;
