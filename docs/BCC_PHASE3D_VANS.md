# Phase 3D: vans (Nov 2026)

Owner decisions: 10 guests + 1 host per van; van 1 runs at 5, van 2 at 4; everyone pays upfront; van 2 sells until the owner closes it; groups never split (a party that doesn't fit van 1 goes to van 2; hosts can swap on the night). **7 PM** = go / no-go reminder for every night with guests; **8 PM** = reminder only if van 2 still has guests and is undecided. The owner decides; options (refund / new date) are sent with one click, at any time. Booking page: "Only X spots left" from 4 down, plus "Unlock Van 2 — N more guests"; never "x/10 booked". Two hosts per night each write their own report and both see the full guest list.

## Part 1–2 (built 27 Nov 2026)
- Migration `20261130000001_vans.sql`: `event_dates.van_count` (null / 1 / 2), `event_dates.van2_state` (open / running / closed), `van_reminders` (one per night per kind). Additive; rollback in `supabase/rollback/`. Applied to staging.
- `capacity` stays the single seat gate (calendar, checkout, waitlist, Bókun): no vans = 12, 1 van = 10, 2 vans = 20; closing van 2 keeps sold seats and stops sales.
- `lib/vans.ts`: split by booking order without splitting groups, status vs minimums, capacity, guest message. `/api/events` returns `seatsMessage`; `/book` shows it.
- Owner night panel → **Vans**: No vans / 1 van / 2 vans, who is in each van, Run van 2 / Close van 2 / Reopen sales. Club Crawl nights only.
- `/api/cron/van-reminders?kind=7pm|8pm` (Bearer `VAN_REMINDER_SECRET`); schedule in `supabase/production/cron_van_reminders.sql` (12:00 / 13:00 UTC), not applied.

## Still to build
- Part 3: short-van options email (refund / move to another date), guest choice page, owner one-click approve (existing refund / reschedule). OTA guests listed for manual handling.
- Part 4: second host per night (`host_assigned_2`), both see all guests, one report per host.
