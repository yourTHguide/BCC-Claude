-- SMC staging seed — catalogue data only (no personal data).
-- Apply to STAGING only. For production, the same rows are created at launch
-- through the operator dashboard or an approved data migration.
-- Product stays in 'draft': the public page and checkout treat it as
-- unavailable on production until launch is approved.

INSERT INTO public.products (slug, name, status, default_price, default_start_time, visible_bcc, visible_bnt)
VALUES ('smc', 'Single Meet Club', 'draft', 400, '19:30:00', FALSE, TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_content (
  product_id, tagline, short_description, meeting_point, duration_minutes,
  whats_included, whats_not_included, important_info
)
SELECT p.id,
  'Good people. Great nights.',
  'A monthly social night for Bangkok singles who''d rather meet in real life.',
  jsonb_build_object(
    'visibility', 'public',
    'display_name', 'Tony''s Restaurant & Bar',
    'address', 'Sukhumvit Soi 11, Bangkok',
    'maps_url', 'https://www.google.com/maps/search/?api=1&query=Tony%27s%20Restaurant%20%26%20Bar%20Sukhumvit%20Soi%2011%20Bangkok',
    'instructions', 'Show your QR ticket at the SMC check-in when you arrive.'
  ),
  NULL,
  '["Entry to Single Meet Club", "One welcome drink", "Conversation prompts and icebreaker games"]'::jsonb,
  '["Additional drinks and food"]'::jsonb,
  '["Guests must be 20 or older. ID may be requested at the door.", "Tickets are non-refundable for guest-initiated cancellations, no-shows or late arrival.", "Transfers to another eligible guest may be requested up to 24 hours before the event and are subject to organiser approval."]'::jsonb
FROM public.products p WHERE p.slug = 'smc'
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO public.event_dates (event_date, night_slug, night_name, is_open, product_id, capacity)
SELECT DATE '2026-10-29', 'smc', 'Single Meet Club', TRUE, p.id, 40
FROM public.products p WHERE p.slug = 'smc'
ON CONFLICT (event_date, night_slug) DO NOTHING;
