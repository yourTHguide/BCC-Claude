# BCC Mission Control (Nov 2026)

The owner's dashboard home (`/dashboard`, first tab "🛰️ Mission Control"; Calendar / Bookings / Operations are the other tabs).

- **Tonight**: each night tonight with guests / checked in, vans vs minimums, host, meet-up and WhatsApp set. Tap → the night's panel.
- **To do** (worked out from live data; items disappear once done), grouped 🔴 Tonight & urgent (go/no-go and van 2 decisions from 6 PM; incidents until the night's host pay is marked paid) · 🟠 Guests (choices to approve, guests not answered yet) · 🟡 Hosts (expenses, set fee, ready to pay, commission earned) · 🔵 Bookings & money (Bókun imports and nights ready to open from the saved Bókun copy, refunds owed, last month's OTA payouts not matched from the 5th, weekend nights under 6 months ahead).
- **Numbers** (from the Operations report, by night date): this week vs last, this month so far vs the same days last month, next 30 days seats sold, owed (host pay ready + commission earned) and guest credit held.
- **Next 7 nights**: guests/capacity, vans, host / meet-up / WhatsApp checks.
- `/dashboard?night=<id>&date=<YYYY-MM-DD>` opens a night's panel (used by the links).
- **9 AM email** (`/api/cron/daily-digest`, Bearer `OPS_CRON_SECRET`), only when something is waiting; schedule in `supabase/production/cron_van_reminders.sql`.
- Code: `lib/missionControl.ts`, `app/api/admin/mission-control`, `app/dashboard/MissionControl.tsx`. Tests: `tests/mission-control.test.ts`.
