-- Rollback for 20261118000002_bnt_lead_operations.sql.
-- Roll back the CODE first (promote the previous Vercel deployment): the
-- current code writes these columns. Export anything you want to keep first:
--   select * from bnt_waitlist_announcements; select * from bnt_waitlist_deliveries;
--   select id, email, experience, request_details, notes, status from bnt_experience_inquiries where form_version = 2;
-- WARNING: dropping request_details loses structured answers for inquiries
-- submitted after this release (older rows still have them in preferred_vibe).
-- Nothing below touches rows' original Phase 3 columns.

drop table if exists public.bnt_waitlist_deliveries;
drop table if exists public.bnt_waitlist_announcements;

alter table public.bnt_waitlist
  drop constraint if exists bnt_waitlist_consent_scope_check,
  drop constraint if exists bnt_waitlist_unsubscribe_token_key,
  drop column if exists alert_error,
  drop column if exists alert_sent_at,
  drop column if exists alert_status,
  drop column if exists unsubscribed_at,
  drop column if exists unsubscribe_token,
  drop column if exists consented_at,
  drop column if exists consent_text,
  drop column if exists consent_scope;

alter table public.bnt_contact_messages
  drop constraint if exists bnt_contact_messages_alert_status_check,
  drop constraint if exists bnt_contact_messages_status_check,
  drop column if exists retention_hold,
  drop column if exists status_changed_at,
  drop column if exists alert_error,
  drop column if exists alert_sent_at,
  drop column if exists alert_status,
  drop column if exists status,
  drop column if exists source;

alter table public.bnt_experience_inquiries
  drop constraint if exists bnt_experience_inquiries_alert_status_check,
  drop constraint if exists bnt_experience_inquiries_status_check,
  drop column if exists retention_hold,
  drop column if exists status_changed_at,
  drop column if exists alert_error,
  drop column if exists alert_sent_at,
  drop column if exists alert_status,
  drop column if exists status,
  drop column if exists form_version,
  drop column if exists source,
  drop column if exists notes,
  drop column if exists request_details,
  drop column if exists experience,
  drop column if exists email;
