-- Bókun sync schedule — PRODUCTION. NOT APPLIED YET: only with the owner's
-- go-ahead, after migration 20261127000001_bokun_sync_shadow is applied and
-- the code is live on production.
--
-- Every 10 minutes the database calls
-- https://www.bestnightlifethailand.com/api/cron/bokun-sync, which reads
-- Bókun and (shadow mode) only records what it would do.
-- Uses pg_cron + pg_net, already enabled for the SMC email retry: no new service, no cost.
--
-- Vault secrets (Supabase → Project Settings → Vault):
--   bokun_sync_url     added with this file
--   bokun_sync_secret  added by the owner: same value as Vercel Production
--                      BOKUN_SYNC_SECRET (24+ characters). Until it exists the job does nothing.
-- Stop it any time: select cron.unschedule('bokun-sync');

SELECT cron.schedule(
  'bokun-sync',
  '*/10 * * * *',
  $job$
  SELECT net.http_post(
    url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bokun_sync_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'bokun_sync_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'bokun_sync_secret');
  $job$
);

SELECT vault.create_secret('https://www.bestnightlifethailand.com/api/cron/bokun-sync', 'bokun_sync_url', 'Bókun sync endpoint (production)');
