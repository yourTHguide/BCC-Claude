-- Restores the old name on the plain night (club-crawl slug only).
update public.event_dates       set night_name = 'BKK Club Crawl' where night_name = 'Bangkok Club Crawl' and night_slug = 'club-crawl';
update public.bookings          set night_name = 'BKK Club Crawl' where night_name = 'Bangkok Club Crawl' and night_slug = 'club-crawl';
update public.product_schedules set night_name = 'BKK Club Crawl' where night_name = 'Bangkok Club Crawl';
