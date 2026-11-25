-- Phase 3B (25 Nov 2026): optional "keep me updated" list for Bangkok Club
-- Crawl, offered as a separate, unticked box on the sold-out waitlist form.
-- Additive: one more allowed consent_scope value and its uniqueness rule.
-- consent_scope 'bcc_updates' = "email me about new Bangkok Club Crawl nights
-- and events". Product-level (no date, no party size), its own consent text
-- and timestamp, its own unsubscribe token (the row's). It is never mixed with
-- 'sold_out_date' (one date) or 'event_dates' (New in Bangkok).
-- Nothing sends to this list yet; the form box stays hidden in production
-- until the privacy notice covers it (BCC_UPDATES_OPTIN).
-- Rollback: supabase/rollback/20261125000001_bcc_updates_optin_down.sql

alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_consent_scope_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_consent_scope_check check (consent_scope in ('event_dates', 'sold_out_date', 'bcc_updates'));

alter table public.bnt_waitlist drop constraint if exists bnt_waitlist_scope_shape_check;
alter table public.bnt_waitlist
  add constraint bnt_waitlist_scope_shape_check check (
    (consent_scope = 'event_dates' and event_date_id is null and party_size is null)
    or (consent_scope = 'sold_out_date' and event_date_id is not null and event_date is not null
        and party_size between 1 and 24 and consented_at is not null and consent_text is not null)
    or (consent_scope = 'bcc_updates' and event_date_id is null and party_size is null
        and consented_at is not null and consent_text is not null)
  );

create unique index if not exists bnt_waitlist_updates_email_uidx
  on public.bnt_waitlist (product_slug, email) where consent_scope = 'bcc_updates';
