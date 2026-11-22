-- STAGING ONLY (jyhtznpethgzypblppnt). Raises at the end so everything rolls back.
begin;
create temp table _pre as select (select count(*) from public.bnt_waitlist) wl, (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from public.bnt_waitlist t) h;
create temp table _log(step text, result text);
insert into public.bnt_waitlist (product_slug, email, source) values ('new-in-bkk','rehearsal-pre@example.test','website');
-- migration, twice (idempotent)

alter table public.bnt_waitlist
  add column if not exists event_date_id uuid references public.event_dates(id) on delete restrict,
  add column if not exists event_date date,   -- snapshot for display / audit
  add column if not exists night_slug text,   -- snapshot for display / audit
  add column if not exists party_size smallint;

alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_consent_scope_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates', 'sold_out_date'));

do $$ begin
  alter table public.bnt_waitlist
    add constraint bnt_waitlist_scope_shape_check check (
      (consent_scope = 'event_dates' and event_date_id is null and party_size is null)
      or (consent_scope = 'sold_out_date' and event_date_id is not null and event_date is not null
          and party_size between 1 and 24 and consented_at is not null and consent_text is not null)
    );
exception when duplicate_object then null; end $$;

create unique index if not exists bnt_waitlist_product_email_uidx
  on public.bnt_waitlist (product_slug, email) where consent_scope = 'event_dates';
create unique index if not exists bnt_waitlist_date_email_uidx
  on public.bnt_waitlist (event_date_id, email) where consent_scope = 'sold_out_date';
alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_product_email_key;

alter table public.bnt_waitlist_announcements
  add column if not exists kind text not null default 'product_dates',
  add column if not exists event_date_id uuid references public.event_dates(id) on delete restrict,
  add column if not exists max_party_size smallint,   -- largest party the admin approved to notify
  add column if not exists seats_at_draft smallint;   -- seats left when drafted (audit)

do $$ begin
  alter table public.bnt_waitlist_announcements
    add constraint bnt_waitlist_announcements_kind_check check (
      (kind = 'product_dates' and event_date_id is null)
      or (kind = 'sold_out_reopen' and event_date_id is not null and max_party_size between 1 and 24)
    );
exception when duplicate_object then null; end $$;

create unique index if not exists bnt_waitlist_announcements_one_open_reopen_uidx
  on public.bnt_waitlist_announcements (event_date_id)
  where kind = 'sold_out_reopen' and status in ('draft', 'sending');

alter table public.bnt_waitlist_deliveries drop constraint if exists bnt_waitlist_deliveries_status_check;
alter table public.bnt_waitlist_deliveries
  add constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed', 'unconfirmed', 'skipped'));

comment on column public.bnt_waitlist.event_date_id is
  'Set only for consent_scope sold_out_date: the one Bangkok Club Crawl event instance this person asked about. Never used for any other date or product.';
comment on column public.bnt_waitlist.party_size is
  'Seats wanted (sold_out_date only). A reopen notice goes only to people whose party fits the seats left.';

alter table public.bnt_waitlist
  add column if not exists event_date_id uuid references public.event_dates(id) on delete restrict,
  add column if not exists event_date date,   -- snapshot for display / audit
  add column if not exists night_slug text,   -- snapshot for display / audit
  add column if not exists party_size smallint;

alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_consent_scope_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates', 'sold_out_date'));

do $$ begin
  alter table public.bnt_waitlist
    add constraint bnt_waitlist_scope_shape_check check (
      (consent_scope = 'event_dates' and event_date_id is null and party_size is null)
      or (consent_scope = 'sold_out_date' and event_date_id is not null and event_date is not null
          and party_size between 1 and 24 and consented_at is not null and consent_text is not null)
    );
exception when duplicate_object then null; end $$;

create unique index if not exists bnt_waitlist_product_email_uidx
  on public.bnt_waitlist (product_slug, email) where consent_scope = 'event_dates';
create unique index if not exists bnt_waitlist_date_email_uidx
  on public.bnt_waitlist (event_date_id, email) where consent_scope = 'sold_out_date';
alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_product_email_key;

alter table public.bnt_waitlist_announcements
  add column if not exists kind text not null default 'product_dates',
  add column if not exists event_date_id uuid references public.event_dates(id) on delete restrict,
  add column if not exists max_party_size smallint,   -- largest party the admin approved to notify
  add column if not exists seats_at_draft smallint;   -- seats left when drafted (audit)

do $$ begin
  alter table public.bnt_waitlist_announcements
    add constraint bnt_waitlist_announcements_kind_check check (
      (kind = 'product_dates' and event_date_id is null)
      or (kind = 'sold_out_reopen' and event_date_id is not null and max_party_size between 1 and 24)
    );
exception when duplicate_object then null; end $$;

create unique index if not exists bnt_waitlist_announcements_one_open_reopen_uidx
  on public.bnt_waitlist_announcements (event_date_id)
  where kind = 'sold_out_reopen' and status in ('draft', 'sending');

alter table public.bnt_waitlist_deliveries drop constraint if exists bnt_waitlist_deliveries_status_check;
alter table public.bnt_waitlist_deliveries
  add constraint bnt_waitlist_deliveries_status_check check (status in ('pending', 'sent', 'failed', 'unconfirmed', 'skipped'));

comment on column public.bnt_waitlist.event_date_id is
  'Set only for consent_scope sold_out_date: the one Bangkok Club Crawl event instance this person asked about. Never used for any other date or product.';
comment on column public.bnt_waitlist.party_size is
  'Seats wanted (sold_out_date only). A reopen notice goes only to people whose party fits the seats left.';
do $t$
declare e uuid; e2 uuid; p uuid; a uuid; w uuid;
begin
  select id into p from public.products where slug='bangkok-club-crawl';
  insert into public.event_dates (event_date, night_slug, night_name, is_open, product_id, capacity) values ('2027-01-08','tgif','TGIF REHEARSAL',true,p,2) returning id into e;
  insert into public.event_dates (event_date, night_slug, night_name, is_open, product_id, capacity) values ('2027-01-09','saturday-signature','SAT REHEARSAL',true,p,2) returning id into e2;
  insert into _log values ('existing NIB row still valid', (select count(*)::text from public.bnt_waitlist where email='rehearsal-pre@example.test'));
  begin insert into public.bnt_waitlist (product_slug,email,source) values ('new-in-bkk','rehearsal-pre@example.test','website'); insert into _log values ('dup NIB email','ACCEPTED (bad)');
  exception when unique_violation then insert into _log values ('dup NIB email','rejected'); end;
  insert into public.bnt_waitlist (product_slug,email,consent_scope,consent_text,consented_at,event_date_id,event_date,night_slug,party_size) values ('bangkok-club-crawl','rehearsal-pre@example.test','sold_out_date','x',now(),e,'2027-01-08','tgif',2) returning id into w;
  insert into _log values ('same email on BCC date','accepted');
  insert into public.bnt_waitlist (product_slug,email,consent_scope,consent_text,consented_at,event_date_id,event_date,night_slug,party_size) values ('bangkok-club-crawl','rehearsal-pre@example.test','sold_out_date','x',now(),e2,'2027-01-09','saturday-signature',1);
  insert into _log values ('same email on second BCC date','accepted');
  begin insert into public.bnt_waitlist (product_slug,email,consent_scope,consent_text,consented_at,event_date_id,event_date,night_slug,party_size) values ('bangkok-club-crawl','rehearsal-pre@example.test','sold_out_date','x',now(),e,'2027-01-08','tgif',3); insert into _log values ('dup BCC date email','ACCEPTED (bad)');
  exception when unique_violation then insert into _log values ('dup BCC date email','rejected'); end;
  begin insert into public.bnt_waitlist (product_slug,email,consent_scope,event_date_id,event_date,party_size) values ('bangkok-club-crawl','noconsent@example.test','sold_out_date',e,'2027-01-08',2); insert into _log values ('sold-out without consent','ACCEPTED (bad)');
  exception when check_violation then insert into _log values ('sold-out without consent','rejected'); end;
  begin insert into public.bnt_waitlist (product_slug,email,consent_scope,consent_text,consented_at,event_date_id,event_date,party_size) values ('bangkok-club-crawl','big@example.test','sold_out_date','x',now(),e,'2027-01-08',25); insert into _log values ('party 25','ACCEPTED (bad)');
  exception when check_violation then insert into _log values ('party 25','rejected'); end;
  begin insert into public.bnt_waitlist (product_slug,email,consent_scope,event_date_id,party_size) values ('new-in-bkk','nibdate@example.test','event_dates',e,2); insert into _log values ('NIB row with date','ACCEPTED (bad)');
  exception when check_violation then insert into _log values ('NIB row with date','rejected'); end;
  begin delete from public.event_dates where id=e; insert into _log values ('delete date with signups','ALLOWED (bad)');
  exception when foreign_key_violation then insert into _log values ('delete date with signups','blocked'); end;
  insert into public.bnt_waitlist_announcements (product_slug,dates_summary,subject,kind,event_date_id,max_party_size) values ('bangkok-club-crawl','s','x','sold_out_reopen',e,2) returning id into a;
  begin insert into public.bnt_waitlist_announcements (product_slug,dates_summary,subject,kind,event_date_id,max_party_size) values ('bangkok-club-crawl','s','x','sold_out_reopen',e,2); insert into _log values ('second open reopen same date','ACCEPTED (bad)');
  exception when unique_violation then insert into _log values ('second open reopen same date','rejected'); end;
  begin insert into public.bnt_waitlist_announcements (product_slug,dates_summary,subject,kind) values ('bangkok-club-crawl','s','x','sold_out_reopen'); insert into _log values ('reopen w/o date','ACCEPTED (bad)');
  exception when check_violation then insert into _log values ('reopen w/o date','rejected'); end;
  insert into public.bnt_waitlist_announcements (product_slug,dates_summary,subject) values ('new-in-bkk','s','x');
  insert into _log values ('legacy NIB announcement insert','accepted');
  insert into public.bnt_waitlist_deliveries (announcement_id,waitlist_id,status) values (a,w,'skipped');
  insert into _log values ('skipped delivery','accepted');
  begin insert into public.bnt_waitlist_deliveries (announcement_id,waitlist_id) values (a,w); insert into _log values ('dup delivery','ACCEPTED (bad)');
  exception when unique_violation then insert into _log values ('dup delivery','rejected'); end;
  -- rollback script guard then full rollback after clearing synthetic rows
  begin
    if exists (select 1 from public.bnt_waitlist where consent_scope='sold_out_date') then raise exception 'guard'; end if;
    insert into _log values ('rollback guard','DID NOT FIRE (bad)');
  exception when raise_exception then insert into _log values ('rollback guard with rows','refuses'); end;
  delete from public.bnt_waitlist_deliveries where announcement_id=a;
  delete from public.bnt_waitlist_announcements where kind='sold_out_reopen';
  delete from public.bnt_waitlist where consent_scope='sold_out_date';
end $t$;


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
do $t$ begin
  insert into _log values ('after rollback: constraint restored', (select count(*)::text from pg_constraint where conname='bnt_waitlist_product_email_key'));
  insert into _log values ('after rollback: new cols gone', (select (count(*)=0)::text from information_schema.columns where table_name='bnt_waitlist' and column_name in ('event_date_id','party_size')));
  delete from public.bnt_waitlist where email='rehearsal-pre@example.test';
  insert into _log values ('rows identical to before', (select ((select count(*) from public.bnt_waitlist)=(select wl from _pre))::text));
  raise exception 'REHEARSAL RESULT (rolled back): %', (select string_agg(step||' => '||result, ' | ') from _log);
end $t$;
