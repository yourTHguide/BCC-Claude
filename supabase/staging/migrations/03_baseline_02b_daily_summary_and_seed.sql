-- Applied to STAGING (jyhtznpethgzypblppnt) as migration "baseline_02b_daily_summary_and_seed".
-- Source: see supabase/staging/README.md. Do not run against production.
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  ed.event_date,
  ed.night_slug,
  ed.night_name,
  ed.is_open,
  ed.host_assigned,
  COALESCE(SUM(b.quantity), 0) AS website_guests,
  COALESCE(SUM(b.total_paid), 0) AS website_revenue,
  COALESCE(SUM(o.quantity), 0) AS ota_guests,
  COALESCE(SUM(o.total_paid), 0) AS ota_revenue,
  COALESCE(SUM(b.quantity), 0) + COALESCE(SUM(o.quantity), 0) AS total_guests,
  COALESCE(SUM(b.total_paid), 0) + COALESCE(SUM(o.total_paid), 0) AS total_revenue,
  COALESCE(SUM(ex.amount), 0) AS total_expenses
FROM event_dates ed
LEFT JOIN bookings b
  ON b.event_date = ed.event_date
  AND b.night_slug = ed.night_slug
  AND b.status = 'confirmed'
LEFT JOIN ota_bookings o
  ON o.event_date = ed.event_date
  AND o.night_slug = ed.night_slug
LEFT JOIN expenses ex
  ON ex.event_date = ed.event_date
  AND ex.night_slug = ed.night_slug
GROUP BY ed.event_date, ed.night_slug, ed.night_name, ed.is_open, ed.host_assigned
ORDER BY ed.event_date DESC;
REVOKE SELECT ON public.daily_summary FROM anon, authenticated;
INSERT INTO products (id, slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt)
VALUES ('bbacd61d-1063-4b69-a0d6-4fd147ef98ea', 'bangkok-club-crawl', 'Bangkok Club Crawl', 'active', 1200, '21:30:00', TRUE, FALSE)
ON CONFLICT (slug) DO NOTHING;
