-- BCC Phase 2 — product_content for bangkok-club-crawl — PRODUCTION.
-- STATUS: NOT APPLIED. Run only after Guide approves Phase 2 (it changes live
-- data immediately, independent of any deploy). Rollback:
-- supabase/rollback/bcc_phase2_product_content_down.sql
--
-- Why: these rows feed the booking confirmation email (What's Included / Not
-- Included / itinerary) and /events/bangkok-club-crawl. Today they still say
-- "2–4 complimentary shots", "1 drink minimum at free-entry venues", a
-- 2:30 AM finish and a "marked as a no-show" penalty — all of which conflict
-- with the founder-confirmed terms (lib/bccTerms.ts, 17 Nov 2026).
--
-- Final founder decisions (17 Nov 2026): inclusions are four curated venues,
-- local hosts, group transport, arranged venue entry and 3–4 shots. No VIP
-- claims, no drink deals, NO DJ/venue cover charge for guests, no
-- passport-only ID rule, venues vary by night, no fixed end time.
-- important_info is shown in the confirmation email, so it holds joining
-- essentials only; the email links to /booking-terms for the full policy.

UPDATE product_content c
SET
  whats_included = '[
    "Four curated nightlife venues",
    "Local hosts who run the night for your group",
    "Group transport between venues",
    "Arranged venue entry",
    "3–4 complimentary shots during the night (no complimentary full-sized drinks)"
  ]'::jsonb,
  whats_not_included = '[
    "At least one drink purchased at every venue — required, not included in your ticket",
    "Any other drinks beyond the complimentary shots",
    "Transport to or from the meeting point",
    "Food and personal spending"
  ]'::jsonb,
  important_info = '[
    "Check-in and start: 9:30 PM in the Sukhumvit Soi 11 area. The exact meet-up venue is shared in our WhatsApp group chat by 7 PM on the day.",
    "At least one drink purchase is required at each venue, paid separately.",
    "Minimum age 20 — bring valid photo ID. Smart casual dress code.",
    "Running late? Message your host in the WhatsApp group. After 10:20 PM, contact your host there directly.",
    "Charge your phone — WhatsApp is your lifeline for the night."
  ]'::jsonb,
  itinerary = '[
    {"title": "9:30 – 10:30 PM", "description": "Check in and meet the group at the first bar, with a welcome shot to kick off the night."},
    {"title": "10:45 – 11:45 PM", "description": "Move to the second venue — unique décor and great atmosphere."},
    {"title": "12:00 – 1:00 AM", "description": "Hit an upbeat venue to dance and soak in the Bangkok nightlife energy."},
    {"title": "1:30 AM – Late", "description": "Wrap up at a high-energy spot to end the night on a memorable note."}
  ]'::jsonb,
  updated_at = now()
FROM products p
WHERE p.id = c.product_id AND p.slug = 'bangkok-club-crawl';
