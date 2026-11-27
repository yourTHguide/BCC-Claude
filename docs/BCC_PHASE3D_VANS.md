# Phase 3D: vans (Nov 2026)

Owner decisions: 10 guests + 1 host per van; van 1 runs at 5, van 2 at 4; everyone pays upfront; van 2 sells until the owner closes it; groups never split (a party that doesn't fit van 1 goes to van 2; hosts can swap on the night). **7 PM** = go / no-go reminder for every night with guests; **8 PM** = reminder only if van 2 still has guests and is undecided. The owner decides; options (refund / new date) are sent with one click, at any time. Booking page: "Only X spots left" from 4 down, plus "Unlock Van 2 — N more guests"; never "x/10 booked". Two hosts per night each write their own report and both see the full guest list.

## Part 1–2 (built 27 Nov 2026)
- Migration `20261130000001_vans.sql`: `event_dates.van_count` (null / 1 / 2), `event_dates.van2_state` (open / running / closed), `van_reminders` (one per night per kind). Additive; rollback in `supabase/rollback/`. Applied to staging.
- `capacity` stays the single seat gate (calendar, checkout, waitlist, Bókun): no vans = 12, 1 van = 10, 2 vans = 20; closing van 2 keeps sold seats and stops sales.
- `lib/vans.ts`: split by booking order without splitting groups, status vs minimums, capacity, guest message. `/api/events` returns `seatsMessage`; `/book` shows it.
- Owner night panel → **Vans**: No vans / 1 van / 2 vans, who is in each van, Run van 2 / Close van 2 / Reopen sales. Club Crawl nights only.
- `/api/cron/van-reminders?kind=7pm|8pm` (Bearer `OPS_CRON_SECRET`); schedule in `supabase/production/cron_van_reminders.sql` (12:00 / 13:00 UTC), not applied.

## Part 3a (built 27 Nov 2026)
Owner decisions: emails for a night under 5 and for van 2 under 4 (same layout, different reason); buttons open the guest's own booking page (secure link, no login); choose a full refund, a move (pick a night and/or write a preference) or credit; the owner approves each. No reply: reminder at 24 h, credit at 48 h. Credit valid 12 months, refundable on request until used (keeps the "refund or move" promise and consumer rules).
- Migration `20261201000001_guests_options_credit.sql`: `guests` (one per email, all brands), `bookings.guest_id` / `ota_bookings.guest_id` (existing bookings linked), `guest_activity` (history), `booking_options`, `guest_credits`. Rollback refuses while options or credits exist. Applied to staging (23 bookings linked).
- Night panel → Vans → "Not enough guests?": **Night won't run → send options** / **Van 2 won't run → send options** (also closes van 2), OTA guests listed; each guest's choice with **Approve refund / move / credit** (or switch to refund / credit). Approvals use the dashboard's own refund and reschedule (usual guest emails).
- Guest page `/my-booking/<token>` with a 3-month calendar: nights on sale or confirmed with room (●) plus every Friday/Saturday; a weekend without a night is created OFF when the owner approves the move (`booking_options.preferred_date`, migration `20261201000002`). API `/api/my-booking/<token>` (no email shown).
- `/api/cron/booking-options` hourly (24 h reminder, 48 h credit), same `OPS_CRON_SECRET`; schedule added to `supabase/production/cron_van_reminders.sql`.
- New paid bookings create or reuse the guest record and log "booked".
- Booking page: "Van 2 is filling up — N already in, just need M more and it's on!".
- Terms (organizer cancellation) and privacy notice (guest profile, credit) updated.

## Part 3b (built 27 Nov 2026): using credit
- Migration `20261202000001_credit_use.sql`: `bookings.credit_used`, `guest_credits.hold_key / hold_amount / hold_until`.
- Guest page → **Book with my credit** → `/book?credit=<token>` (banner shows the credit; button shows what's left to pay).
- Credit covers it → `/api/credit-booking`: booked with no payment step (source `credit`, `total_paid` 0, `credit_used`), usual confirmation email and ticket.
- Credit covers part → checkout with a one-off Stripe coupon for the credit; credit held 30 min for that checkout; used when the payment arrives (webhook). Minimum ฿20 charged.
- Owner **Refund credit** (night panel, under the guest) → Stripe refund of what's left to the original card (`/api/admin/credits`). Expired credit (12 months) closed by the hourly timer.
- Operations revenue = `total_paid + credit_used`.

## Part 4 (built 27 Nov 2026): second host per night
- Migration `20261203000001_second_host.sql`: `event_dates.host_assigned_2`; `host_reports` unique per (night, host) instead of per night; `host_reports.fee_thb` / `paid_at` (each host's fee and payment). Applied to staging.
- Calendar night panel: **Second host (Van 2)**. Both hosts see the night, all guests (both vans), brief, check-in, expenses; each writes their own report.
- Owner review: one card per host (report, fee, Mark paid); suggested fee = night suggestion ÷ number of hosts. Night totals (`host_fee_final`, `host_payment_status`) follow: sum of fees; Paid when every host is paid — Closeout/Operations unchanged.
- Nights paid before per-host fees keep their night-level fee for the single host (`hostPay` in `lib/hostPayout.ts`).
- Reports list, My earnings and Mission Control work per host.
- Part 4: second host per night (`host_assigned_2`), both see all guests, one report per host.

## Vans are the standard (28 Nov 2026)
- Owner decision: no "no vans" option. Every Club Crawl night is **1 van (10 seats)** or **2 vans (20)**.
- Migration `20261204000001_vans_standard.sql`: database rule gives every new Club Crawl night 1 van / 10 seats (schedules, Add night, Bókun import, moved guests); future nights switched to 1 van / 10 (2 vans / 20 where more than 10 were already booked). Staging: 52 × 1 van, 2 × 2 vans.
- The **Van 2 host** is chosen inside the Vans box under Van 2 (`set_host2`).
