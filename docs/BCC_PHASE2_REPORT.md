# BCC Phase 2: operating terms and booking transparency (17 Nov 2026)

Branch `bcc/phase2-operating-terms`, cut from production `main` (`7b66602`). Scope: Bangkok Club Crawl only. No changes to pricing, checkout, Stripe, webhooks, tickets or availability logic.

## Single source of truth
`lib/bccTerms.ts` holds the founder-confirmed terms: start time, meeting area, shots, the mandatory drink rule, late arrival, minimum group, cancellation, rescheduling, age and dress code. Every surface below now reads from it.

## Changed files and pages

| File | Page / surface | Change |
|---|---|---|
| `lib/bccTerms.ts` (new) | n/a | Terms constants plus Included / Not Included lists |
| `components/WeekendsPage.tsx` | `/weekends` | 9:00 → 9:30 PM; meeting area and map pin moved to Sukhumvit Soi 11; Included / Not Included; Good to Know; dress code; new **Booking Terms** and **Running Late?** content. Good to Know, Dress Code, Booking Terms, Running Late? and This Is For You If are now one **"The Details"** list of collapsible rows, closed by default. The drink rule also stays visible in Not Included and on `/book`. |
| `components/FAQ.tsx` | `/` (homepage FAQ) | 3 questions → 9, built from the terms |
| `app/book/BookingCalendarClient.tsx` | `/book` (BCC site only) | New **"Before you book"** summary directly above the Book Now button. The drink rule is shown in bold. |
| `app/booking-success/BookingSuccessClient.tsx` | `/booking-success` (BCC) | Step 4 added: late-arrival instructions |
| `app/tgif/page.tsx`, `app/saturday-signature/page.tsx` | `/tgif`, `/saturday-signature` | Shots, meeting area, drink rule, cancellation/minimum-group, late arrival, age, dress code |
| `emails/confirmed-meetup.ts` | "Tonight is confirmed" email (BCC) | Dress code from the terms; late-arrival note under the WhatsApp button. BEST bookings keep their old text unchanged. |
| `supabase/production/bcc_phase2_product_content.sql` + rollback | Confirmation email lists, `/events/bangkok-club-crawl` | **Not applied.** Updates the database product content. Run only after approval. |

## Before → after (main items)

| Topic | Before | After |
|---|---|---|
| Start time (`/weekends`) | "9:00 PM – Late" | "9:30 PM – Late" |
| Meeting area | "Asoke – Phrompong (Sukhumvit)"; map pin on Asok Intersection; "Sukhumvit 11 / Asoke area" | "Sukhumvit Soi 11, Bangkok — the exact venue is confirmed in your booking instructions and the event WhatsApp group" |
| Shots | "2–4 complimentary shots" | "3–4 complimentary shots during the night. No complimentary full-sized drinks are included." |
| Drinks | "One drink minimum per venue (your choice)" | "Each guest is required to purchase at least one drink at every venue. Drinks purchased at the venues are not included in your ticket." Shown in Experience details, Not Included, Booking Terms, FAQ and the `/book` summary. |
| Included | "All cover charges + Priority entry" | "Priority entry at every venue". "All cover charges" was removed because the product configuration lists a DJ-night cover charge as *not* included. |
| Late arrival | (none) | 9:30 start; message the host in the WhatsApp group; after 10:20 PM you must contact the host directly; late joining not guaranteed; no individual pickups or transfers |
| Organizer cancellation (FAQ) | "Full refund within 3–5 business days. Notified by WhatsApp and email." | "If we cancel a night, you'll be offered a full refund or a move to another available date. We'll let you know by email." The cancellation email itself says 5–10 business days. |
| Minimum group | "Confirmed or cancelled at 7 PM" | "Each night needs a minimum of 5 guests. If fewer than 5 are booked, we decide at 7:00 PM on the night whether it goes ahead." |
| Guest cancellation | (none on BCC pages) | Non-refundable once the night operates, subject to consumer protection law; rescheduling on request, subject to availability, not guaranteed; third-party bookings follow that platform's terms |
| Price | "฿1,200" | Unchanged, plus "special price when you book directly… third-party platforms may charge a different price" |
| Age / ID | "Bring your passport — required for entry at most stops" / "Minimum age 20" | "Minimum age 20. Please bring valid photo ID — venues may check it at the door." |
| Dress code | "No shorts, tank tops, sportswear, elephant pants, sandals or flip-flops. Smart shoes required at the nightclub." | "Smart casual, suited to upscale nightlife venues. Please skip tank tops, sportswear, flip-flops, sandals and elephant pants." |

## Verification (local production build, BCC host)
1. **Start/check-in:** 9:30 PM everywhere. No "9:00 PM" remains on `/`, `/weekends`, `/tgif`, `/saturday-signature` or `/booking-success`.
2. **Meeting area:** Sukhumvit Soi 11 everywhere. No "Asoke" remains.
3. **Late-arrival instructions:** on `/weekends`, FAQ, `/book`, `/booking-success`, the night pages, and in the "Tonight is confirmed" email that carries the WhatsApp link.
4. **Shots:** "3–4". No "2–4" remains in the site code.
5. **Drink rule:** visible in the `/book` summary before checkout (tested with a sample date; checkout was blocked in the test, so no Stripe call was made).
6. **Price:** still ฿1,200, coming from the database and checkout. No pricing code changed.
7. **Cancellation terms:** the same wording on every surface, all from `lib/bccTerms.ts`.
8. **Minimum 5 / 7 PM:** represented. Checkout gating is unchanged (see flags).
9. **Age / dress code:** consistent everywhere.
10. **Infrastructure:** no changes to `/api/*`, checkout, Stripe, webhooks, tickets or availability. `tsc` and `next build` pass. BEST pages and New in Bangkok/SMC flows are untouched (the BCC blocks are gated on the BCC storefront).

## Stripe currency investigation (read-only, no changes)
- **Transaction currency:** THB. Every BCC session is `currency: thb`, `amount_total: 120000` (฿1,200). No fees, tax or surcharges are added by our code (`total_details` all zero). Promo codes are enabled.
- **Presentation:** **Adaptive Pricing is ON** (`adaptive_pricing.enabled: true` on every session, BCC, New in Bangkok and SMC alike; it's an account-level Stripe setting, not set in our code). Guests with foreign cards are shown, and pay, a converted amount in their own currency. Recent live examples: USD 36.83 and 37.17, EUR 33.28, SGD 47.70, ZAR 207.81. Thai and PromptPay payments stay in THB.
- **Foreign customers see their local currency by default.** THB is offered as the other option. This explains the audit's USD finding.
- **Fees and conversion:** under Adaptive Pricing, Stripe's conversion rate includes a conversion margin paid by the guest. The two USD charges above imply different rates (about ฿32.6 and ฿32.3 per USD), so a foreign guest pays slightly more than ฿1,200 at market rate. You still receive ฿1,200.
- **Is ฿1,200 clear before payment?** Yes on our pages: the price, the total and the `/book` summary are all in ฿. On the Stripe page itself, a foreign-card guest first sees their own currency.
- **Recommendation (needs approval; nothing changed):** either
  - **(A)** turn Adaptive Pricing **off** in the Stripe Dashboard (Settings → Payments → Adaptive Pricing), so every guest sees and pays ฿1,200, and their bank does any conversion; or
  - **(B)** keep it on and add one line to the `/book` summary: "Your ticket is priced in Thai Baht (฿1,200). If your card is from outside Thailand, checkout may show an approximate amount in your currency, including a conversion fee."

  **(A)** matches "฿1,200" advertising most cleanly.

## Business rules needing your confirmation
1. **Same-day booking cutoff:** the calendar and checkout still accept bookings for tonight until midnight (they only block past dates and nights marked closed). Your terms say until immediately before 9:30 PM. Enforcing that is a booking-logic change, so it isn't in this PR.
2. **Cancelled nights:** new bookings are blocked only when the night is set to *closed* (`is_open = false`) in the dashboard. Please confirm your cancel process always does this.
3. **Group size claims:** "Limited to 12 guests" (`/weekends`, `/tgif`) vs "Capped at 24 guests / two vans / two hosts" (`/saturday-signature`). The database has no capacity set. Left as is.
4. **Review counts:** "800+ five-star reviews", "797 reviews", "700+ nights. All rated 5 stars", "700+ five-star reviews". Unverified and inconsistent. Left as is.
5. **"฿1,000 for members"** on `/weekends`: not part of the confirmed terms. Left as is.
6. **Dress code / ID items dropped to match your list:** "no shorts", "smart shoes required at the nightclub", "ankle-strap sandals are fine" (women), "physical passport required". Re-add any you want.
7. **Inclusions kept because the product configuration supports them:** VIP/priority entry, Private Party Van / transport between venues (`/tgif` also says "walkable route… on foot"), and special drink deals. Please confirm.
8. **DJ-night cover charge** (in the product configuration as *not included*): not shown on the website. Should it be disclosed?
9. **"Bring cash ฿2,000–3,000"** (in the confirmation-email content): kept in the SQL draft. Remove if it reads as a minimum spend.
10. **Public BCC info connector** (outside this repo, used by AI assistants): lists Signature Night at **"THB 1,500"**, an end time of 2:00–3:00 AM, and a different dress code. It needs updating wherever it's hosted.
11. **"Tonight is confirmed" email:** says "MEET-UP TIME 9:30 PM" for every product, including any BEST product that reuses it. Out of BCC scope; noted only.

## Not changed (on hold)
Prices, event times in the database, checkout, Stripe settings, webhooks, refund automation, the end time, venue-substitution policy, no-show penalties, rescheduling fees, and tax/fee treatment.
