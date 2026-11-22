# Phase 3B — Unified waitlist & sold-out recovery (Bangkok Club Crawl)

Scope: bkkclubcrawl.com `/book` and `/dashboard/leads` only. No change to prices (฿1,200), checkout, Stripe, capacity rules, webhooks or booking records. New in Bangkok stays paused.

## What it does

**Guest side (`/book`)**
- A Friday/Saturday Club Crawl night that is **genuinely full** (open, published, priced, before its 9:30 PM cutoff, capacity > 0, every seat taken) now shows on the calendar as **FULL** instead of vanishing.
- Clicking it shows:
  1. **Primary:** the next night that can actually be booked for this party size. It comes from the live `/api/events` list, so no date is ever made up. If no night fits, the page says so.
  2. **Secondary:** a waitlist for that exact date. The guest gives name, email, number of seats and ticks an unticked consent box. The consent text names the night and date and says the waitlist does not reserve a seat or guarantee entry. That wording is saved on the row along with the time.
- Other states are never offered a waitlist: cancelled, unpublished, closed (including capacity 0), started (cutoff), past, no price. A deep link `/book?date=YYYY-MM-DD` to one of these says why it can't be booked.
- `/book?date=…&night=…&qty=N` (the link in the reopen email) selects that night and pre-fills the party size, capped at the seats left. Booking then goes through normal checkout, which re-checks capacity and price.

**Admin side (`/dashboard/leads` → "BCC sold-out" tab, owner/admin only)**
- One card per upcoming date with sign-ups. Each card shows the live state, seats taken/left, people waiting and seats wanted, a party-size breakdown, and how many were notified or unsubscribed. Expand a card to see each sign-up with Unsubscribe and Delete buttons.
- When seats come back (a booking cancelled or capacity raised in the calendar), the date reads "Seats open":
  1. **Notify parties of up to N** (N can't be more than the seats left), then **Check who it would reach**. This only reads data and shows the count.
  2. **Save draft & preview**, then **Send test to me** (goes to the logged-in admin only).
  3. Tick the confirmation, then **Approve & send**.
- Every send batch re-checks the date: it must still be bookable, with the same night, time and price, and have seats left. The seat limit drops to the seats left at that moment.
- Every send batch also re-checks each person: still consented, not unsubscribed, not already notified for this date (in any notice), not already holding a confirmed booking for that night, valid email, and party size within the limit. Anyone who fails is marked **skipped** and gets no email.
- Uncertain provider outcomes (timeout, 5xx) are held as "uncertain" and never re-sent automatically. This is the existing Phase 3 flow: review in Resend using the `delivery_id` tag, then choose "Don't re-send" or "Queue again".

## Data model (migration `20261122000001_bcc_soldout_waitlist.sql`)

Reuses the Phase 3 tables. There is no new service.

| Table | Change |
|---|---|
| `bnt_waitlist` | New nullable `event_date_id` (FK, `on delete restrict`), `event_date`, `night_slug`, `party_size`. New consent scope `sold_out_date`. A check requires a date, a party size of 1–24, `consent_text` and `consented_at` on sold-out rows, and no date on `event_dates` rows. Uniqueness: `(product_slug,email)` for `event_dates` rows (same rule as before), `(event_date_id,email)` for `sold_out_date` rows. |
| `bnt_waitlist_announcements` | New `kind` (`product_dates` default, or `sold_out_reopen`), `event_date_id`, `max_party_size`, `seats_at_draft`. Only one unfinished reopen notice per date (partial unique index). |
| `bnt_waitlist_deliveries` | New status `skipped`. The existing unique `(announcement, subscriber)` constraint and the atomic `attempted_at` claim prevent double sends. |

Audiences never mix. New in Bangkok sends select `consent_scope='event_dates' AND product_slug='new-in-bkk'`. Reopen sends select `consent_scope='sold_out_date' AND event_date_id=<that date>`. A sold-out sign-up can't be pulled into another date, another product or marketing. Unsubscribe uses the row's own token, so it stops that one list only.

**New in Bangkok stays paused.** The NIB announcement date picker (`loadOpenDates`) now lists only dates checkout would accept on bestnightlifethailand.com: product active and `visible_bnt`, date open, not cancelled, not past its cutoff, priced, and not full. While New in Bangkok is Draft in production, nothing can be announced. Existing NIB subscribers keep their `event_dates` scope.

## Spam and abuse controls
- Hidden honeypot field, plus a minimum fill time (2.5 s). Bots get a normal-looking reply and nothing is stored.
- Server-side validation: name required, email format, party size 1–24, consent must be `true`, event UUID format.
- Eligibility is re-checked from the database on every sign-up. The page is never trusted.
- One row per email per date (unique index). Repeat sign-ups update the party size instead of adding a row.
- At most 3 active upcoming sold-out sign-ups per email address.
- Works on the BCC host only. Returns 404 on bestnightlifethailand.com.
- No per-sign-up team alert email, so a flood can't spam the team inbox. The dashboard shows the counts.

## Feature switch
`BCC_SOLDOUT_WAITLIST` (server env):
- unset: **on** in Preview and local dev, **off** in Production.
- `on`: on everywhere.
- `off`: off everywhere.

When off, sold-out nights still show FULL with the next-night offer. Only the waitlist form is hidden and `POST /api/waitlist/sold-out` returns 404. Unsubscribe and admin tools always work.

## Test results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `next build` | pass |
| `npm test` (13 unit tests, `tests/phase3b-waitlist.test.ts`): state classification for every state, Fri/Sat, cutoff timing, BCC-only, consent wording, next-night picker incl. party size + no-fabrication, seat cap, send-time recipient re-check incl. cross-audience rejection | 13/13 pass |
| Local browser run of `/book` (Playwright, all API calls intercepted, no DB/Stripe/email): sold-out panel, next night for party of 2 → Fri 4 Dec (6 left), party of 1 → Sat 28 Nov (1 left), consent required, POST payload, "Book this night" selects it, cancelled deep link explains + no waitlist, flag off hides form | pass |
| Staging migration rehearsal (`supabase/rehearsal/20261122000001_staging_rehearsal.sql`, single transaction, always rolled back) | **pending**: see Blockers |
| Live staging endpoint test and synthetic unsubscribe confirmation | **pending**: see Operator steps 3–4 |

## Rollout (in order)

1. **Staging DB** (`jyhtznpethgzypblppnt` only). Run the rehearsal file in the SQL editor. Every line must read rejected/accepted/blocked/refuses/true as labelled. It raises at the end, so nothing is kept. Then apply `supabase/migrations/20261122000001_bcc_soldout_waitlist.sql`.
2. **Preview** (Vercel deployment of this branch, pointed at staging, test-mode Stripe, `RESEND_API_KEY` absent or sandbox).
   - On staging, create one synthetic future Friday BCC date named `TEST 3B` with capacity 2. Add one staging booking for it: `is_test = true`, quantity 2, status confirmed.
   - Open `/book?date=<that date>`. Expect FULL, a next-night offer (or "none"), and the waitlist form.
   - Sign up as `TEST 3B` with a test inbox address you control. Sign up again: still one row. Try a cancelled or closed date: no form.
3. **Reopen dry run on Preview.** Set the synthetic booking to quantity 1 (one seat opens). In `/dashboard/leads` → BCC sold-out: check the audience (expect 1 with party ≤ 1, or 0 if you signed up for 2), save the draft, preview it, then send a test to yourself. Approve & send only with a sandbox or test recipient.
4. **Live unsubscribe confirmation on the synthetic row (required before the first real campaign).**
   - Open the unsubscribe link from the test email, or go to `<preview>/waitlist/unsubscribe?token=<row's unsubscribe_token>`.
   - Confirm. Check `unsubscribed_at` is set on **that row only**, and that no NIB row or other date changed.
   - Run `curl -X POST '<preview>/api/waitlist/unsubscribe?token=<token>'` (the one-click path) and expect `{"success":true}`.
   - Re-run "Check who it would reach" and expect the synthetic person excluded.
5. **Cleanup on staging.** Delete the synthetic booking, waitlist row, announcement (deliveries cascade) and event date, in that order:
   ```sql
   delete from bnt_waitlist_announcements where kind='sold_out_reopen' and subject like '%TEST 3B%';
   delete from bnt_waitlist where name = 'TEST 3B';
   delete from bookings where is_test and night_name = 'TEST 3B';
   delete from event_dates where night_name = 'TEST 3B';
   ```
6. **Production prerequisites** (owner):
   - `CHECKOUT_DYNAMIC_PRICING=true` in Production. The legacy checkout path does not enforce capacity, so "sold out" would not be real. Confirm this before release.
   - Update the **Bangkok Club Crawl privacy notice**. It currently says BCC has "no marketing mailing list" and lists no waitlist. Proposed row: *"Join the waitlist for a sold-out night | Name, email, number of seats, which night, when you signed up, the exact wording you agreed to | To email you once if seats for that night open up — nothing else | Your consent (s.19), which you can withdraw at any time"*. Proposed retention: *until the night has passed, then deleted within 30 days (kept as a suppression record if you unsubscribed)*.
7. **Production DB.** Apply the migration to `oomhftxgvikzxlvqdcmr` **before** merging. It is additive, and the current code keeps working with it.
8. **Merge** and Vercel deploys. The waitlist form stays **off** in Production.
9. When the notice is live, set `BCC_SOLDOUT_WAITLIST=on` in Vercel Production and redeploy.

## Rollback
- **Fast:** set `BCC_SOLDOUT_WAITLIST=off` and redeploy. Sign-ups stop. Sold-out display and next-night offer remain, and they are read-only.
- **Code:** promote the previous Vercel deployment or revert the merge. Old code ignores the new columns. The NIB route still works with the partial unique index.
- **DB:** run `supabase/rollback/20261122000001_bcc_soldout_waitlist_down.sql`. It **refuses to run while sold-out rows exist**, so customer data is never deleted by a rollback. Export first (queries in the file), and have an owner remove the rows deliberately before re-running. NIB rows are untouched.

## Operator notes (small team)
- Seats reopen → the date card turns "Seats open". Notify **only when you're happy to sell those seats**. The email goes to everyone whose party fits, and seats go to whoever books first.
- One notice per date at a time. Each person gets at most one notice per date.
- "Skipped" is normal and needs no action. It means the person was already booked, unsubscribed, or their party was bigger than the seats left at send time.
- "Uncertain" → wait 2 minutes, check Resend → Emails (search the address or the `delivery_id` tag), then decide.
- Retention: after a night has passed, its sign-ups have no further use. Delete them from the card list (or by SQL) within 30 days, as proposed for the notice.

## Blockers / open items
1. The staging migration rehearsal didn't run in this session. The Supabase tool asked for a confirmation that wasn't answered in time. Staging is unchanged. Run step 1 above, or re-authorize the tool.
2. There is no Preview runtime evidence yet. Steps 2–5 need a Preview deployment wired to staging, plus a test inbox.
3. The privacy notice update and the `CHECKOUT_DYNAMIC_PRICING` confirmation are owner decisions (step 6).
