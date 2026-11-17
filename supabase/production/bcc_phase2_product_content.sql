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
-- Kept from the existing configuration (not contradicted by the terms):
-- transport between venues, VIP entry, drink deals, host, DJ-night cover
-- charge note, ID guidance, cash/eat/phone tips. Those marked FLAG in the
-- Phase 2 report still need Guide's confirmation.

UPDATE product_content c
SET
  whats_included = '[
    "Four curated nightlife venues",
    "Dedicated local host all night",
    "3–4 complimentary shots during the night (no complimentary full-sized drinks)",
    "VIP entry at all stops",
    "Free transport between venues",
    "Exclusive drink deals"
  ]'::jsonb,
  whats_not_included = '[
    "At least one drink purchased at every venue — required, not included in your ticket",
    "Any other drinks beyond the complimentary shots",
    "Cover charge on DJ nights only — entry is free on all regular nights",
    "Ride home"
  ]'::jsonb,
  important_info = '[
    "Every Friday and Saturday. Check-in and start: 9:30 PM.",
    "Meeting area: Sukhumvit Soi 11, Bangkok. The exact meet-up venue depends on the route and is shared in our WhatsApp group chat by 7 PM on the event day.",
    "Each guest is required to purchase at least one drink at every venue. Drinks purchased at the venues are not included in your ticket.",
    "Please arrive on time. Running late? Let your host know in the event WhatsApp group chat. After 10:20 PM, you must contact your host directly through the WhatsApp group. Late joining cannot be guaranteed once the night is underway, and we cannot offer individual pickups or transfers.",
    "Minimum 5 participants. If fewer than 5 are booked, we decide at 7:00 PM on the event day whether the night goes ahead. If we cancel, you will be offered a full refund or a move to another available date.",
    "Direct bookings are non-refundable once the night goes ahead, subject to applicable consumer protection law. You can ask to reschedule; it depends on availability and is not guaranteed. Bookings made through a third-party platform follow that platform''s terms.",
    "Minimum age 20. Bring valid photo ID — venues may check it at the door. ID: physical passport required for under 25; digital ID may work if 25+.",
    "Dress code: smart casual, suited to upscale nightlife venues. Please skip tank tops, sportswear, flip-flops, sandals and elephant pants.",
    "Eat before you go — grab a meal before the crawl for energy.",
    "Bring cash: ฿2,000–3,000 for drinks, cover charges, and tips.",
    "Charge your phone — WhatsApp is your lifeline for the night.",
    "Your host is there to help — ask anything during the night."
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
