# BCC Phase 2: release runbook (PR #9 + product content update)

Prepared 17 Nov 2026. **Nothing here has been run yet.** Each step that changes production waits for Guide's go-ahead.

Out of scope for this release (by decision): Stripe Adaptive Pricing, renaming "TGIF Bangkok" / "Signature Night", and the public AI connector.

## 1. Database content check (`supabase/production/bcc_phase2_product_content.sql`)
Matches the approved terms:
- **Included:** four curated venues, local hosts, group transport, arranged venue entry, **3–4 complimentary shots** (no full-sized drinks). No VIP, drink deals or cover charges.
- **Not included:** first line is "At least one drink purchased at every venue — required, not included in your ticket".
- **Good to know (shown in the confirmation email):** five short joining essentials. The email links to `/booking-terms` for the full policy instead of repeating it.
- **Itinerary:** "9:30 PM — First stop", "Second stop", "Third stop", "Final stop — Late". **No end time.** The old 10:45/12:00/1:30–2:30 timetable is removed.
- **Removed:** the "marked as a no-show" penalty, the passport-only rule, the DJ cover charge, "bring ฿2,000–3,000".

**The "by 7 PM" statement:** for all 9 nights with logged sends (25 Sep – 13 Nov), the first "Tonight is confirmed" email (venue + WhatsApp link) went out between **2:14 PM and 6:48 PM**, never after 7 PM. But with bookings now open until 9:30 PM, a guest can book *after* 7 PM. So the wording (approved 17 Nov) is: "The exact meet-up venue is shared in our WhatsApp group chat by 7 PM on the day. Booked after 7 PM? We'll send it to you directly after you book." That relies on the operator step in section 3 (the "Send to N new guests" button). The same wording is on `/booking-success`. The reschedule email keeps "by 7 PM", since rescheduled guests are always booked in advance.

**Safety guard:** the update only applies if the content is unchanged since review (`updated_at = 2026-08-24 08:43:05.378196+00`). Expected result `UPDATE 1`; `UPDATE 0` means someone edited it, so stop and re-review.

**Dry run (17 Nov):** both scripts were run against a temporary, session-only copy of the row (the live table was not written to):
- the update matched 1 row and changed all four fields;
- the rollback restored all four fields exactly (jsonb equality = true);
- the live row was untouched afterwards.

## 2. Capacity (confirmed behaviour)
- **No capacity set on a date = unlimited**, exactly as today. All 12 upcoming BCC dates currently have no capacity.
- **When set:** seats left = capacity − (confirmed direct tickets + OTA tickets for that date). The calendar caps the ticket picker at seats left and hides full dates. Checkout refuses orders that don't fit.
- **Never raised automatically.** Only a person changes it.

**Operator checklist:**
1. **Standard is 12 per date** (one van). Set on all upcoming dates at release. Dates added later (schedule extend / Add date) start with **no capacity** = unlimited, so set 12 on each new date: Dashboard → **Products** → **Bangkok Club Crawl** → dates table → **Edit** → **Capacity 12** → Save.
2. Raise a date to **22** only **after the second van and staffing are confirmed** for that date: Edit → Capacity **22** → Save.
3. Second van falls through → set it back to **12**. Existing bookings are kept; it only stops new sales above 12.
4. "Bkgs" in that table counts booking *records* (direct + OTA), not guests. A 3-ticket booking is 1. Check guest numbers in the night's guest list.
5. Clear the Capacity field (empty) to make a date unlimited again.

## 3. 7 PM decision and cancelled nights (confirmed behaviour)
- **The 7 PM minimum-five decision is manual.** Nothing in the system cancels or confirms a night automatically.
- **If the night goes ahead:** set Operation Verdict → **Operation Confirmed**, then **Send Confirmed Meetup**. Bookings stay open until 9:30 PM. Anyone who books after the send: the same button then reads **"Send to N new guests"**, and it only emails guests who haven't had it yet.
- **If BCC cancels:** set Operation Verdict → **Cancelled / Rescheduled**. **After this release**, that alone stops new bookings immediately (calendar and checkout). Belt and braces: also press **Close** on that date in Products.
- **Guests are not refunded or notified automatically.** Use the Bookings tab per guest: **Cancel & Refund** (sends the cancellation email) or **Reschedule** (sends the reschedule email). Refund automation is unchanged.
- Every night also closes to new bookings at 9:30 PM automatically.

## 4. Release sequence (needs Guide's approval to start)
0. **Pre-check:** PR #9 has the latest commit and the Vercel check is green.
1. **Merge PR #9** (Guide, on GitHub: Merge pull request → Confirm merge).
2. **Wait for the production deploy** (about 2 minutes). Claude verifies on the live domains:
   - `/weekends`, `/book`, `/booking-terms` and `/` show the new copy;
   - `/tgif` and `/saturday-signature` 308 → `/weekends`;
   - `/api/events?storefront=bcc` still returns the 12 upcoming nights;
   - BEST pages unchanged;
   - both Stripe webhooks still reachable;
   - no runtime errors.

   **Any failure → stop, then roll back the code (5a).**
3. **Apply the content update** (Claude, via Supabase, immediately after step 2 passes): run `bcc_phase2_product_content.sql` and expect `UPDATE 1`. Doing it right after the deploy keeps the gap between the new site and old email content to a few minutes. Bookings made in that gap get the old lists in their confirmation email.
4. **Verify the content:** read back the row; `/events/bangkok-club-crawl` shows the new lists. No test booking or payment is made.
5. **Set standard capacity** (Claude, approved): run `bcc_phase2_capacity_12.sql` and expect `UPDATE 12` (the 12 upcoming dates, 20 Nov to 26 Dec). Verify on `/api/events` that each date shows 12 seats left (no bookings yet). Rollback: `bcc_phase2_capacity_12_down.sql`.
6. **Done.** Follow-up (not in this release): make new BCC dates start at 12 automatically instead of unlimited.

## 5. Rollback plan
- **5a Code:** Vercel → bcc-claude → Deployments → the previous production deployment (commit `7b66602`, the Phase 1 release) → **Instant Rollback**. This is immediate and needs no rebuild. A git revert of the merge commit is the permanent follow-up.
- **5b Content:** run `supabase/rollback/bcc_phase2_product_content_down.sql`. It restores the exact original values (dry-run tested). Expect `UPDATE 1`.
- **5c Capacity:** run `supabase/rollback/bcc_phase2_capacity_12_down.sql` (only resets dates still at 12).
- **Order:** if everything is needed, roll back the code first, then content and capacity. Content alone can be rolled back at any time, and the new code works with either version of the content.
- **No data migration** is involved: no tables or columns change, and no bookings are touched.
