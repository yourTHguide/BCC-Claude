-- SMC email retry schedule — STAGING ONLY. Prepared, not yet applied.
--
-- Every 5 minutes, staging's database calls the preview's email-retry route,
-- which sends any SMC email still pending (it never creates or changes bookings).
--
-- Secrets are read from Supabase Vault at run time, so none appear here or in
-- cron.job. Before applying, the owner adds three Vault secrets in the Supabase
-- dashboard (Project "BCC - Claude Staging" → Project Settings → Vault):
--   smc_retry_url      https://<preview-branch-domain>/api/smc/email-retry
--   smc_retry_secret   same value as Vercel Preview SMC_EMAIL_RETRY_SECRET
--   smc_vercel_bypass  Vercel "Protection Bypass for Automation" secret
--                      (sent as a request header, never in the URL)

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'smc-email-retry',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smc_retry_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smc_retry_secret'),
      'x-vercel-protection-bypass', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smc_vercel_bypass')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  WHERE EXISTS (
    SELECT 1 FROM public.email_outbox
    WHERE (status = 'pending' AND next_attempt_at <= NOW())
       OR (status = 'sending' AND locked_until < NOW())
  );
  $job$
);
