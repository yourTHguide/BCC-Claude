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

## Still to build
- Part 3b: using credit to book again (checkout pays all or part with credit).
- Part 4: second host per night (`host_assigned_2`), both see all guests, one report per host.
