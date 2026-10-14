-- SMC email retry schedule — PRODUCTION. Applied 14 Oct 2026 (owner-approved)
-- as migration "smc_email_retry_cron".
--
-- Every 5 minutes, if an SMC email is due, the database calls
-- https://www.bestnightlifethailand.com/api/smc/email-retry, which sends pending
-- SMC emails (it never creates or changes bookings). Production has no Vercel
-- deployment protection, so no bypass header is needed.
--
-- Vault secrets (Supabase → Project Settings → Vault):
--   smc_retry_url     added with this migration
--   smc_retry_secret  added by the owner: same value as Vercel Production
--                     SMC_EMAIL_RETRY_SECRET. Until it exists the job does nothing.

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
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smc_retry_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'smc_retry_secret')
    AND EXISTS (
      SELECT 1 FROM public.email_outbox
      WHERE (status = 'pending' AND next_attempt_at <= NOW())
         OR (status = 'sending' AND locked_until < NOW())
    );
  $job$
);

SELECT vault.create_secret('https://www.bestnightlifethailand.com/api/smc/email-retry', 'smc_retry_url', 'SMC email retry endpoint (production)');
