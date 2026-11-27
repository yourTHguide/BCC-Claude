-- Van reminders — PRODUCTION. NOT APPLIED YET (owner go-ahead with Phase 3D).
-- 7 PM and 8 PM Bangkok (12:00 and 13:00 UTC) the database calls
-- /api/cron/van-reminders, which emails the owner tonight's van numbers
-- (7 PM: every night with guests; 8 PM: only if van 2 is still open with
-- guests). It never changes bookings. Uses pg_cron + pg_net (already enabled).
--
-- Vault secrets (Supabase → Project Settings → Vault):
--   van_reminder_url     added with this file
--   ops_cron_secret  added by the owner: same value as Vercel Production
--                        OPS_CRON_SECRET (24+ characters).
-- Stop: select cron.unschedule('van-reminder-7pm'); select cron.unschedule('van-reminder-8pm');

SELECT cron.schedule('van-reminder-7pm', '0 12 * * *', $job$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'van_reminder_url') || '?kind=7pm',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret')),
    body    := '{}'::jsonb, timeout_milliseconds := 30000)
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret');
$job$);

SELECT cron.schedule('van-reminder-8pm', '0 13 * * *', $job$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'van_reminder_url') || '?kind=8pm',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret')),
    body    := '{}'::jsonb, timeout_milliseconds := 30000)
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret');
$job$);

-- Hourly: options reminders (24 h) and credit (48 h), same secret.
SELECT cron.schedule('booking-options-timers', '17 * * * *', $job$
  SELECT net.http_post(
    url     := replace((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'van_reminder_url'), '/van-reminders', '/booking-options'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000)
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret')
    AND EXISTS (SELECT 1 FROM public.booking_options WHERE status = 'sent');
$job$);

-- 9 AM Bangkok (02:00 UTC): Mission Control to-do email, only when something is waiting.
SELECT cron.schedule('mission-control-digest', '0 2 * * *', $job$
  SELECT net.http_post(
    url     := replace((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'van_reminder_url'), '/van-reminders', '/daily-digest'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret')),
    body    := '{}'::jsonb, timeout_milliseconds := 30000)
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'ops_cron_secret');
$job$);

SELECT vault.create_secret('https://www.bestnightlifethailand.com/api/cron/van-reminders', 'van_reminder_url', 'Van reminders endpoint (production)');
