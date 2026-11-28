# My account (guest self-service) — Nov 2026

- `/account`: guest enters the email they booked with → 6-digit code (15 min, 5 tries, max 5 codes/hour, 30 s between). Same answer for unknown emails (nobody can find out who booked).
- Signed in 30 days (httpOnly cookie `bcc_account`). Only hashes of codes and session keys are stored (`guest_login_codes`, `guest_sessions`, migration `20261205000001`).
- Shows: credit (with "Book with my credit" → `/book?credit=account`), upcoming bookings with ticket links, "Choose refund or new date" when a night isn't running, past & cancelled, and name / phone editing. OTA bookings show with "your ticket is in the app you booked with".
- First sign-in links older bookings made with the same email to the guest record.
- Links: home nav + footer, Weekends nav, confirmation email, my-booking page.
- Code: `lib/guestAuth.ts`, `lib/account.ts`, `app/api/account/*`, `app/account/page.tsx`. Tests: `tests/guest-account.test.ts`.

## Brand name
Guests see **Bangkok Club Crawl** everywhere (owner, 28 Nov 2026). "BKK" only in the domain and social handles. The plain (no-theme) night is named "Bangkok Club Crawl" (migration `20261205000002`).

## Logins
One owner login for the dashboard (28 Nov 2026). The owner's second email is no longer a dashboard login and is used as a test guest email.
