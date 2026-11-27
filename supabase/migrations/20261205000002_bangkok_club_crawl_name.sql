-- Brand name (owner decision, 28 Nov 2026): guests see "Bangkok Club Crawl"
-- everywhere; "BKK" stays only in the domain and social handles.
-- Renames the plain (no-theme) night from "BKK Club Crawl". Name only.
update public.event_dates       set night_name = 'Bangkok Club Crawl' where night_name = 'BKK Club Crawl';
update public.bookings          set night_name = 'Bangkok Club Crawl' where night_name = 'BKK Club Crawl';
update public.product_schedules set night_name = 'Bangkok Club Crawl' where night_name = 'BKK Club Crawl';
