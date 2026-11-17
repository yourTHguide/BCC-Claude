# BCC Phase 2: operating terms, booking rules and transparency (17 Nov 2026)

Branch `bcc/phase2-operating-terms`, cut from production `main` (`7b66602`). Scope: Bangkok Club Crawl only, using the founder's final decisions of 17 Nov 2026. No pricing, Stripe, webhook, ticket or refund changes.

## Single source of truth
- `lib/bccTerms.ts` holds the guest-facing terms: start time, meeting area, inclusions, shots, the mandatory drink rule, late arrival, minimum group, cancellation, rescheduling, age, dress code and group size.
- `lib/bookingAvailability.ts` holds the booking rules. The calendar and checkout both use it.

## Booking rules (new; approved in the final decisions)

| Rule | Before | After |
|---|---|---|
| Same-day cutoff | BCC nights stayed bookable until midnight. Checkout didn't check the date at all, so any still-open past night could be bought directly. | BCC closes at its start time (9:30 PM Bangkok) on the night, in both the calendar and checkout. Past dates are refused for every product. New in Bangkok keeps its date-only rule (BCC-only scope). |
| Cancelled nights | Choosing "Cancelled / Rescheduled" in the dashboard only recorded the verdict; the night stayed bookable. | Nights with that verdict, or recorded as "didn't run", never appear in the calendar and are refused at checkout. Refund automation is unchanged. |
| Capacity | `capacity` existed per date (dashboard → Products → dates) but was never enforced. | When a date has a capacity, seats taken (confirmed direct bookings + OTA bookings, the same count the dashboard shows) are subtracted. The calendar caps the ticket stepper at seats left and hides full nights. Checkout refuses orders that don't fit ("Only 2 spots left for this date"). No capacity set = no limit, as before. Capacity is never raised automatically. |
| Error message | Any refusal showed "Something went wrong" | The guest sees checkout's reason (closed / full / not open) |

**Action for you:** set each date's capacity in the dashboard (usually 12; raise to ~22 only when a second van is arranged). Until a capacity is set, a date stays unlimited, as it is today.

## Changed files and pages

| File | Page / surface | Change |
|---|---|---|
| `lib/bccTerms.ts` (new) | n/a | Confirmed terms, inclusions summary, group-size wording |
| `lib/bookingAvailability.ts` (new) | n/a | Cutoff, cancelled-night and capacity rules |
| `app/api/events/route.ts` | Calendar data | Applies the three rules; returns `remaining` seats |
| `app/api/create-checkout/route.ts` | Checkout | Same three rules, checked before any Stripe call. The Stripe session itself is unchanged. |
| `app/book/BookingCalendarClient.tsx` | `/book` | "Before you book" summary (BCC only); stepper capped at seats left; refusal messages shown; Saturday tag "FLAGSHIP · SATURDAY" → "SATURDAY NIGHTS" |
| `components/WeekendsPage.tsx` | `/weekends` | 9:30 PM; Sukhumvit Soi 11 and map pin; "Small groups — usually around 10–12 guests"; inclusions; drink rule; "Advance booking recommended"; "example route — venues vary by night"; "The Details" collapsible rows; member price and review count removed |
| `components/FAQ.tsx` | Homepage FAQ | 9 answers built from the terms |
| `components/Hero.tsx`, `FinalCTA.tsx`, `Reviews.tsx`, `Stops.tsx` | Homepage | Review counts removed; "From ฿1,200" → "฿1,200"; "Venues vary by night" |
| `app/weekends/page.tsx`, `lib/seo.ts` | Page tags | "VIP entry / capped at 12 guests" removed from the descriptions |
| `app/tgif`, `app/saturday-signature`, `components/NightPage.tsx` | Deleted | Retired; both URLs 308 → `/weekends` (one hop, including from the BEST domain) |
| `next.config.js` | Redirects | Retired night pages → `/weekends` |
| `app/booking-success/BookingSuccessClient.tsx` | `/booking-success` | Late-arrival step |
| `emails/confirmed-meetup.ts` | "Tonight is confirmed" email (BCC) | Confirmed dress code, ID line, late-arrival note. BEST text unchanged. |
| `supabase/production/bcc_phase2_product_content.sql` + rollback | Confirmation-email lists, `/events/bangkok-club-crawl` | **Not applied.** Run only after approval. |

## Before → after (main copy)

| Topic | Before | After |
|---|---|---|
| Start time | "9:00 PM – Late" (`/weekends`) | "9:30 PM – Late" everywhere |
| Meeting area | "Asoke – Phrompong", map on Asok Intersection | "Sukhumvit Soi 11, Bangkok" + exact venue in booking instructions / WhatsApp group |
| Group size | "Limited to 12 guests" / "Capped at 24, two vans, two hosts" | "Small groups — usually around 10–12 guests" (no fixed cap or guarantee) |
| Inclusions | "All cover charges + Priority entry", "VIP entry", "Special drink deals", "Private Party Van (if needed)" | Four curated venues, local hosts, group transport between venues, arranged venue entry, 3–4 complimentary shots (no full-sized drinks) |
| Drinks | "One drink minimum per venue (your choice)" | "Each guest is required to purchase at least one drink at every venue. Drinks purchased at the venues are not included in your ticket." (Not Included, Good to Know, FAQ, `/book` summary) |
| Venues | Fixed four-stop lineup | "An example route — venues vary by night" / "Venues vary by night" |
| Reviews | "800+ five-star reviews", "797 reviews", "700+ nights. All rated 5 stars" | No numbers: "What guests say" / "Straight from our guests" (the review widget itself stays) |
| Member price | "฿1,000 for members" (sticky bar) | Removed. "From ฿1,200" → "฿1,200". |
| Advance booking | "Book at least 3–4 days ahead" | "Advance booking recommended" |
| Age / ID | "Bring your passport — required…" | "Minimum age 20. Valid photo ID required." |
| Dress code | Included "no shorts", "smart shoes" | Smart casual for upscale venues; no tank tops, sportswear, flip-flops, sandals, elephant pants |
| Late arrival | (none) | WhatsApp group; after 10:20 PM contact host directly; late joining not guaranteed; no pickups or transfers |
| Cancellation | "Full refund within 3–5 business days" | Minimum 5 / 7 PM decision; if we cancel, a full refund or reschedule; direct bookings non-refundable once the night operates (subject to consumer law); rescheduling subject to availability; third-party platform terms apply |

## Tests
- **Booking rules (unit tests, 14 cases, all pass):**
  - Bookable at 21:29:59 Bangkok time, closed at 21:30:00 and after midnight.
  - Future dates stay open; New in Bangkok keeps its rule; a missing start time falls back to the date rule.
  - "Cancelled / Rescheduled" and "didn't run" are blocked; "Operation Confirmed" and "Pending" are not.
- **Capacity count (mock data):** test and cancelled bookings and "didn't happen" OTA bookings are excluded. Capacity 12 with 8 taken → 4 allowed, 5 refused.
- **Browser (local production build, sample calendar data, checkout blocked, no Stripe call):**
  - With 2 seats left, the stepper stops at 2.
  - The "Before you book" summary shows the inclusions and the drink rule, and no member price.
  - The `/weekends` "The Details" rows open and close on mobile and desktop.
- **Copy sweep (`/`, `/weekends`):** no "฿1,000", "member", 700+/800+/797, "VIP", "drink deals", "Party Van", "cover", "3–4 days", "passport", "From ฿", "9:00 PM" or "2–4".
- **Redirects:** `/tgif` and `/saturday-signature` → `/weekends` on BCC (308), and → `https://www.bkkclubcrawl.com/weekends` from BEST in one hop.
- `tsc` and `next build` pass. No `/api` webhook, ticket or Stripe-session code changed. BEST pages are untouched apart from the shared redirect list.

## Stripe currency investigation (read-only; nothing changed)
- **Transaction currency:** every BCC session is THB, `amount_total` 120000 (฿1,200). No fees, tax or surcharges are added.
- **Adaptive Pricing is ON** (an account-level Stripe setting). Foreign-card guests see and pay their own currency, e.g. USD 36.83, EUR 33.28, SGD 47.70, ZAR 207.81. Stripe's conversion includes a margin paid by the guest. You still receive ฿1,200.
- **Recommendation:** turn Adaptive Pricing off in the Stripe Dashboard (Settings → Payments → Adaptive Pricing), so every guest sees and pays ฿1,200. This needs your approval; it is not part of this PR.

## Public BCC information connector (audit only)
The connector AI assistants query (`list_nights`, `get_night_details`, `answer_faq`) is **not in this repository or in NightlifeAntigravity**. Its data matches the old NightlifeAntigravity static site's night lineup, and I couldn't find its hosting. It currently publishes:
- **8 weekly nights**, including retired ones: Solo Traveler's (Tue, THB 900), Digital Nomad (Wed, THB 1,000), Girls Night (Thu, THB 900), 30+ Social (Thu, THB 1,200), LGBT+ (Sun, THB 1,000).
- **"BCC Signature Night" at THB 1,500** as a separate flagship (should be THB 1,200, the same experience as Friday).
- **"New in Bangkok Night" (Wed, THB 800)**: a BEST product, not BCC (database price ฿490, early bird ฿390). Check its scope before editing it.
- An end time ("Night ends 2:00–3:00 AM"); "VIP Entry — skip the queue at every stop"; "Welcome Shots — one round"; "Capped Group Size".
- FAQ: dress code "no flip flops or singlets"; "Full refund if we cancel" (no reschedule option); "private groups of 8 or more".

**Needed:** tell me where the connector is hosted (or who maintains it) and I'll update it in its own change. Correct BCC data: Friday and Saturday, ฿1,200 direct, 9:30 PM start, the confirmed inclusions, no end time.

## Still open (not blocking)
1. **Capacity values:** set per date in the dashboard (see above).
2. **Database content SQL:** approve to run it (the confirmation emails still say "2–4 shots", a 2:30 AM finish and a "no-show" line until then).
3. **Night names:** the database still names nights "TGIF Bangkok" / "Signature Night" (shown on `/book`, Stripe and emails). Renaming is a data change. Say if you want, e.g., "Bangkok Club Crawl — Friday".
4. **Rooftop description** on `/weekends` mentions "DJ + live performers" (venue atmosphere, not a charge). It sits under the "example route" note.
5. **Pending Stripe sessions:** capacity counts paid bookings only. Two guests paying at the same moment for the last seat could both get through. This is rare at 10–12 seats; a hold system would be a later change.
6. **"Tonight is confirmed" email:** says 9:30 PM for any product that reuses it (BEST scope; noted only).

## Not changed
Prices, Stripe settings, webhooks, refund automation, ticketing, end time, venue-substitution policy, no-show penalties, rescheduling fees, and tax/fee treatment.
