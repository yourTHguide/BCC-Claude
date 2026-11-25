# Phase 3B — Unified waitlist & sold-out recovery (Bangkok Club Crawl)

Scope: bkkclubcrawl.com `/book` and `/dashboard/leads` only. No change to prices (฿1,200), checkout, Stripe, capacity rules, webhooks or booking records. New in Bangkok stays paused.

## Status (25 Nov 2026)

**Phase:** Phase 3B, the last part of Phase 3 (Phase 3 / PR #11 is merged). Draft PR #12, not merged. Phase 4 has not started.

**How the work was done**
| When | Who / tool | What |
|---|---|---|
| 22 Nov | Claude Code (cloud) | Built the feature; migration, rollback, rehearsal file; unit tests; draft PR #12 |
| 22 Nov | Owner, staging SQL editor | Ran the rollback rehearsal: 18/18 checks passed (owner-reported) |
| 22 Nov | Claude Code | Read-only baseline check; applied the migration to staging and verified it; created the staging fixture (`TEST 3B`, Fri 5 Feb 2027) and confirmed the Preview reads staging |
| 22 Nov | PR review (ChatGPT-assisted checking) | Found the release blocker: reopen recipients were marked failed by the old NIB rule |
| 22–23 Nov | Claude Code | Fixed the blocker (`bc2c67b`), added route-level regression and local acceptance suites (`206fc35`) |
| 23 Nov | Owner, local Claude Code (checking, from ChatGPT review) | `82d14af` + `a01c5ed`: every email path now goes through `lib/sendEmail.ts`; on Vercel Preview it only delivers to `bangkokclubcrawl@gmail.com` and blocks any other `to`/`cc`/`bcc` before the provider is called (SMC outbox too). Production is unchanged. Test: `tests/preview-email.test.ts` |
| 23–25 Nov | Owner, on Preview | Signed up for the sold-out fixture night with the test inbox (party 1, dated consent stored); reopened 1 seat by raising capacity to 3; drafted a reopen notice for parties of 1 (not yet approved) |
| 25 Nov | Claude Code | Reviewed the 23 Nov commits; combined branch: `tsc` OK, `next build` OK, `npm test` 28/28 |

**Left before merge**
1. Preview: approve & send the drafted reopen notice (it can only reach the test inbox), then use the email's unsubscribe link and confirm.
2. Preview checkout with a Stripe **test** card, only after confirming the Preview `STRIPE_SECRET_KEY` is `sk_test_…` in Vercel (not readable from Claude's session).
3. Owner: confirm `CHECKOUT_DYNAMIC_PRICING=true` in Production (capacity is only enforced on that path).
4. Apply `supabase/migrations/20261122000001_bcc_soldout_waitlist.sql` to **production** (`oomhftxgvikzxlvqdcmr`) **before** merging: `/dashboard/leads` reads the new columns.
5. Mark PR #12 ready and merge (Vercel deploys production). The public waitlist form stays **off** in production; the FULL label and next-night offer go live.

**After merge (can wait)**
- Production smoke check: `/book` loads, `/dashboard/leads` loads, a full Fri/Sat shows FULL.
- Update the Bangkok Club Crawl privacy notice, then set `BCC_SOLDOUT_WAITLIST=on` to open sign-ups.
- Remove the staging fixture (Rollout step 5).

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
| `npm test`: 27 tests in three suites (all local; in-memory database; Resend and Stripe are recording stubs; global `fetch` blocked) | 27/27 pass |
| · `tests/phase3b-waitlist.test.ts` (13 unit tests): state classification for every state, Fri/Sat, cutoff timing, BCC-only, consent wording, next-night picker incl. party size + no-fabrication, seat cap, send-time recipient re-check incl. cross-audience rejection | 13/13 pass |
| · `tests/waitlist-send.route.test.ts` (7, real send + unsubscribe handlers): eligible BCC reopen delivery, NIB isolation both ways, scoped unsubscribe before and after claim, retryable lookup/eligibility errors. Regression for the PR-review blocker: against the pre-fix route 5/7 fail (eligible recipient `sent 0 / failed 1`) | 7/7 pass |
| · `tests/acceptance.route.test.ts` (7, real `/api/events`, `/api/waitlist/sold-out`, `/api/create-checkout`, `/api/admin/leads`, announcements, unsubscribe and `/api/waitlist` handlers): BCC calendar sold-out listing at ฿1,200; next bookable night by party size; sign-up with dated consent, duplicate, other states, spam, wrong host; checkout ฿1,200 (`unit_amount` 120000) with capacity enforcement (full → 409, over seats left → 409); seats reopen → reporting → notice → reporting; one-click link → confirm page → final button POST, other list retained, reporting; NIB sign-up scoped, BCC not joinable through it, NIB announcements paused until published and bookable | 7/7 pass |
| Local browser run of the unsubscribe confirm page (Playwright, API intercepted): Bangkok Club Crawl branding on the BCC host, final "Unsubscribe" button sends `{token}` by POST only on click, done state says other lists are unaffected, missing token handled | pass |
| Local browser run of `/book` (Playwright, all API calls intercepted, no DB/Stripe/email): sold-out panel, next night for party of 2 → Fri 4 Dec (6 left), party of 1 → Sat 28 Nov (1 left), consent required, POST payload, "Book this night" selects it, cancelled deep link explains + no waitlist, flag off hides form | pass |
| Staging rollback rehearsal (`supabase/rehearsal/20261122000001_staging_rehearsal.sql`, single transaction, always rolled back): run manually by the owner in the staging SQL editor | **done**: owner reports all 18 checks passed (see "Staging rehearsal record") |
| Post-rehearsal read-only verification of staging, run by Claude | **done**: schema and row counts match the saved baseline; no rehearsal test data found |
| Staging migration applied (`20261122000001_bcc_soldout_waitlist.sql`) | **done, verified**: see "Staging migration record" |
| Preview read-only GET against the staging fixture (`28e6006f-…`, Fri 5 Feb 2027, 2/2 taken): `state: sold_out`, `waitlist: true`, exact ID match | **done** |
| Preview form submission, reopen send to a test inbox, live unsubscribe on a synthetic row, Preview checkout | **pending**: Rollout steps 2–5; needs owner confirmation of the Preview Stripe and Resend keys (below) |

### Preview payment and mail mode
- **Mail: now restricted in code** (commits `82d14af`, `a01c5ed`): on Vercel Preview, `lib/sendEmail.ts` only delivers to `bangkokclubcrawl@gmail.com`; anything else is refused before the provider is called. The waitlist send records such a refusal as `failed` (nothing sent).
- **Stripe: still not verified** (details below).

Earlier notes:
- Vercel environment variables can't be read from this session (403), so the Preview's Stripe and Resend keys for branch `claude/determined-fermi-vda23p` are **unverified**.
- `docs/smc/PHASE0_STAGING.md` records a Stripe Sandbox `sk_test_…` key, a separate staging Resend key and a test admin inbox, but as **branch-scoped entries for `feature/single-meet-club`**. It also notes "Preview (all branches)" `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` entries whose values aren't recorded, and that the live Stripe and Resend keys' Preview targets were removed.
- `PHASE4_CHECKPOINT.md` (older) recorded Preview sharing the **live** Stripe key; PHASE0_STAGING says that target was removed. Which key the all-branches entry holds now is not documented.
- Observed: this branch's Preview server reads staging `jyhtznpethgzypblppnt` (fixture ID match), consistent with an all-branches staging entry.
- Before any Preview checkout or send: the owner confirms in Vercel that Preview (all branches) `STRIPE_SECRET_KEY` is `sk_test_…` and that `RESEND_API_KEY` for Preview is absent or a staging/sandbox key. With no Resend key, the reopen send refuses with 503 and sends nothing.

### Staging rehearsal record (`jyhtznpethgzypblppnt`, BCC - Claude Staging)

**1. Rehearsal: run by the owner, results as reported by the owner.** The owner ran the rehearsal file manually in the staging SQL editor and reported that all 18 checks returned the expected result. Claude did not see that output; the attempts through the Supabase tool timed out at its confirmation prompt and did not run. The 18 expected results are:
- **rejected (8):** duplicate New in Bangkok email; duplicate email on the same BCC date; sold-out sign-up without consent; party size 25; New in Bangkok row with a date; second open reopen notice for the same date; reopen notice with no date; duplicate delivery.
- **accepted (5):** existing New in Bangkok row still valid; same email on two different BCC dates (two checks); old-style New in Bangkok announcement insert; `skipped` delivery status.
- **blocked (1):** deleting a date that has sign-ups.
- **refuses (1):** the rollback guard while sold-out rows exist.
- **after rollback (3):** original `bnt_waitlist_product_email_key` restored = 1; new columns gone = true; row count equal to before = true.

**2. Read-only verification: run directly by Claude after the owner's rehearsal.** One read-only query against `jyhtznpethgzypblppnt` (no writes, rehearsal not re-run), compared with the baseline Claude saved before the rehearsal:

| Item | Baseline | After | Result |
|---|---|---|---|
| `bnt_waitlist` rows | 0 | 0 | match |
| `bnt_waitlist_announcements` rows | 0 | 0 | match |
| `bnt_waitlist_deliveries` rows | 0 | 0 | match |
| `event_dates` rows | 15 | 15 | match |
| `bnt_waitlist` columns | 15 original | same 15; no `event_date_id`, `event_date`, `night_slug`, `party_size` | match |
| `bnt_waitlist_announcements` columns | 12 | same 12; no `kind`, `event_date_id`, `max_party_size`, `seats_at_draft` | match |
| Constraints on the three waitlist tables | 12, incl. `bnt_waitlist_product_email_key` | same 12; no `scope_shape_check` or `kind_check` | match |
| Indexes on the waitlist tables | 7 | same 7; none of the 3 new partial unique indexes | match |
| Consent-scope check | `event_dates` only | `event_dates` only | match |
| Delivery-status check | pending, sent, failed, unconfirmed | same 4 values (no `skipped`) | match |
| Rehearsal test data (`REHEARSAL` event dates, `@example.test` waitlist rows) | none | none found | match |

Staging is exactly as it was before the rehearsal. (The migration was applied afterwards; see the next section.)

### Staging migration record (`jyhtznpethgzypblppnt`, BCC - Claude Staging)

- **Applied by:** Claude, via the Supabase `apply_migration` tool, after confirming the project name and ref and re-checking the baseline (unchanged). Supabase returned success with no confirmation prompt.
- **Repo file:** `supabase/migrations/20261122000001_bcc_soldout_waitlist.sql`, identical to the PR #12 branch (introduced in commit `7dee460`).
- **Staging migration history entry:** `20261122045151 bcc_soldout_waitlist`. Supabase stamps its own apply-time version; the SQL is the repo file.
- **Read-only verification afterwards:**

| Check | Expected | Found | Result |
|---|---|---|---|
| `bnt_waitlist` rows | 0 | 0 | match |
| `bnt_waitlist_announcements` rows | 0 | 0 | match |
| `bnt_waitlist_deliveries` rows | 0 | 0 | match |
| `event_dates` rows | 15 | 15 | match |
| `bnt_waitlist` columns | 15 → 19 (+ `event_date_id` uuid, `event_date` date, `night_slug` text, `party_size` smallint; all nullable) | 19, as expected | match |
| `bnt_waitlist_announcements` columns | 12 → 16 (+ `kind` text not null default `product_dates`, `event_date_id`, `max_party_size`, `seats_at_draft`) | 16, as expected | match |
| Constraints on the three tables | 12 → 15: + `bnt_waitlist_scope_shape_check`, `bnt_waitlist_event_date_id_fkey` (restrict), `bnt_waitlist_announcements_kind_check`, `bnt_waitlist_announcements_event_date_id_fkey` (restrict); consent scope allows `event_dates`, `sold_out_date`; delivery status allows `skipped`; − `bnt_waitlist_product_email_key` | as expected | match |
| Indexes on the three tables | 7 → 9: + `bnt_waitlist_product_email_uidx`, `bnt_waitlist_date_email_uidx`, `bnt_waitlist_announcements_one_open_reopen_uidx`; − `bnt_waitlist_product_email_key` | as expected | match |

No differences beyond the intended ones. Production (`oomhftxgvikzxlvqdcmr`) has **not** been changed.

## Rollout (in order)

1. **Staging DB** (`jyhtznpethgzypblppnt` only). **Done:** rehearsal passed and migration applied and verified (see records above). Run the rehearsal file in the SQL editor. Every line must read rejected/accepted/blocked/refuses/true as labelled. It raises at the end, so nothing is kept. Then apply `supabase/migrations/20261122000001_bcc_soldout_waitlist.sql`.
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
1. Staging rehearsal: resolved. The owner ran it manually and reported 18/18 passed, and Claude confirmed by read-only query that staging matches the baseline. The migration has since been applied to staging and verified (see "Staging migration record").
2. Preview: sign-up and reopen draft done by the owner (23–25 Nov). Send, unsubscribe and checkout remain (see Status).
3. The privacy notice update and the `CHECKOUT_DYNAMIC_PRICING` confirmation are owner decisions (step 6).
