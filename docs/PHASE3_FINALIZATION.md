# BEST Phase 3 finalization — release runbook & operating guide

PR #11 · branch `claude/phase-3-finalization-tswihx` · base `main` 6af637d. Nov 2026.
No change to BCC booking terms, prices, Stripe settings, event dates, capacity or checkout code (verified by diff).

## Work packages

| WP | Commits | What |
|---|---|---|
| A | lead operations · delivery recovery | Structured inquiries, alert tracking, `/dashboard/leads`, human-approved waitlist announcements, safe recovery of interrupted deliveries, unsubscribe, retention fields |
| A | mobile forms · SMC wording | Phone/country code, validation, iOS modal; "Usually the last Thursday" |
| B | tracking fix · consent · consent fixes | Duplicate PageView removed; private pages excluded; Accept / Only necessary consent for Meta, Elfsight, Google Maps; production hosts only |
| B | docs | `docs/privacy/*` |
| C | apex rule | Inert until the Vercel domain setting changes |

## Staging rehearsal — PASSED (21 Nov 2026)
Run by the owner in the staging SQL editor (`jyhtznpethgzypblppnt`), script `supabase/rehearsal/20261118000002_staging_rehearsal.sql`, inside one transaction ending in ROLLBACK.

Every row matched its expectation:
- Rollback script → 11/5/7 columns, new tables gone.
- Phase 3 data unchanged by the migration: true.
- Second migration run changed nothing: true.
- Backfill: `guest@example.com`, `Yacht Party`; the plain row stays `none`. Contact and waitlist backfills correct.
- Columns after migration: 23/12/15/12/12. RLS on both new tables.
- All 10 constraint checks matched (duplicate delivery, invalid statuses, widening consent, duplicate or uppercase sign-up rejected; `unconfirmed` accepted; erasure cascades; other subscriber untouched).

Read-only check afterwards: 0 rehearsal rows left, schema unchanged. Production untouched.

## Final production release checklist

Gate: step 1 is done (see above); step 2 before step 3. Nothing below runs without the owner's go-ahead.

1. **Staging rehearsal passes** (staging only, rolled back). In the SQL editor:
   1. Supabase dashboard → select project **BCC - Claude Staging** (URL contains `jyhtznpethgzypblppnt`). **Do not use "BCC - Claude"; that is production.**
   2. Left menu → **SQL Editor** → **New query**.
   3. In GitHub, open `supabase/rehearsal/20261118000002_staging_rehearsal.sql` on branch `claude/phase-3-finalization-tswihx` → **Raw** → select all → copy.
   4. Paste into the editor → **Run**. If Supabase warns about destructive operations, confirm. The script runs in one transaction and ends with `ROLLBACK`.
   5. The result grid has about 20 rows. **Pass** if:
      - "after rollback script" shows `11/5/7, true`;
      - both "(expect true)" rows say `true`;
      - the Phase 3 backfill row shows `email=guest@example.com experience=Yacht Party`, and the plain row shows `none`;
      - every `check:` row matches its "(expect …)" label;
      - "columns after migration" is `23/12/15/12/12`;
      - RLS shows `true` for both new tables.
   6. Copy the grid and send it to Claude. Optional proof that nothing persisted: run `select count(*) from bnt_experience_inquiries where name like 'REHEARSAL%';` → `0`.
2. **Privacy publication.** The text is ready with no placeholders (`docs/privacy/OPEN_QUESTIONS.md`). On your go-ahead, set in Vercel → Production:
   - `PRIVACY_NOTICE_PUBLISHED=true`
   - `PRIVACY_NOTICE_EFFECTIVE_DATE=<release date, YYYY-MM-DD>`

   Set them **before** the merge in step 5, so the release deploy includes them. Without both, the notices stay unpublished (404, no links).
3. **Back up production:** export `bnt_experience_inquiries`, `bnt_contact_messages`, `bnt_waitlist` as CSV. Expected counts today: 1, 1, 0.
4. **Apply the migration** on production `oomhftxgvikzxlvqdcmr`: paste `supabase/migrations/20261118000002_bnt_lead_operations.sql` into the SQL editor. Then check:
   ```sql
   select count(*), count(email), count(experience), count(*) filter (where source is null) from bnt_experience_inquiries; -- source null = 0
   select count(*) from bnt_waitlist_announcements; -- 0
   select pg_get_constraintdef(oid) from pg_constraint where conname = 'bnt_waitlist_deliveries_status_check'; -- includes 'unconfirmed'
   ```
5. **Merge PR #11.** Vercel deploys production (with the step 2 variables). Watch the deployment reach Ready.
6. **Live checks** (phone, private window):
   - **Consent:**
     - The banner appears on both sites.
     - "Only necessary": Meta Events Manager → Test events shows nothing.
     - Cookie settings → Accept: a PageView appears.
     - Ticket and unsubscribe pages: nothing.
   - **Leads:**
     - Private inquiry "TEST Phase 3F" with +66 and `081…`: Gmail alert arrives, `/dashboard/leads` shows "Alerted" with `+6681…` and structured fields. Then delete it.
     - Contact form: the same check.
     - Waitlist with your own address: alert arrives and the consent text is stored. Then Unsubscribe → Delete.
   - **Pages:**
     - SMC card reads "Usually last Thursday".
     - Pinch-zoom works on the homepage; tapping a form field doesn't jump-zoom.
     - BCC `/weekends`: the banner sits above the Book bar; Book → `/book` reaches Stripe (**don't pay**).
     - `/privacy` on both domains shows the notice with the effective date from step 2; the banner and footers link to it.
7. **Afterwards** (any order):
   - Gmail filters (section D below).
   - Vercel domain: `bkkclubcrawl.com` → "Connect to project".
   - Re-submit the BCC sitemap in Search Console.
   - Meta Sharing Debugger.
   - Note today's Meta event counts to compare in 2 weeks.

**Rollback:** promote the previous Vercel deployment (instant). Database: `supabase/rollback/20261118000002_bnt_lead_operations_down.sql` after exporting; leaving the columns in place is also safe.

### Remaining risks at release
- **Meta reporting drops:** the duplicate PageViews are gone, and decliners aren't tracked. Expected and documented; ad optimisation gets less signal.
- **Real email delivery** via Resend is first proven in step 6 (previews have no key).
- **Privacy text** is not professionally reviewed, even if published under 2(a).
- The outdated external "Loveable" connector is unchanged (outside this repo).
- **Vercel logs last ~1 hour**, so the dashboard (`alert_status`) is the failure record.
- **Staff pages** keep pinch-zoom disabled by design.

## Operating workflows

### A. Waitlist → announcing new dates (always human-approved)
1. Open the dates in the dashboard calendar as usual. **This sends nothing.**
2. `/dashboard/leads` → Waitlist → *Announce new dates*. Tick open dates and write a subject → *Save draft & preview*.
3. Check the preview, then *Send test to me* (it goes only to you).
4. Tick "I have checked the dates, prices and that booking is open" → *Approve & send* → confirm the count.
5. Safeguards:
   - Only that event's subscribers who haven't unsubscribed receive it. Consent scope is enforced by the database, so New in Bangkok sign-ups can never receive a Bangkok Mixer or other product's mail.
   - Each person gets it at most once (database-enforced). Eligibility is re-checked at the moment of sending.
   - Sending is blocked if any date has closed or its price/time changed.
   - Who approved it and when is recorded.

### B. If a send is interrupted
Each delivery ends as one of:
- **Sent**
- **Rejected:** the email service refused it, so nothing was delivered. *Retry failed* is safe.
- **Uncertain:** timeout or dropped connection, so it may or may not have been delivered.

Uncertain deliveries are **never re-sent automatically**. After 2 minutes they appear in a yellow *Needs review* box:
- **Don't re-send (mark unconfirmed)** — the safe default; accepts that the person may have missed it.
- Or check Resend → Emails: search the address; each message carries the tag `delivery_id` shown in the box. If it is **not** there, tick "I checked Resend's log…" → *Queue again* → *Approve & send*.

Tested scenarios: dropped connection after the provider accepted (no duplicate), function killed mid-send (no automatic resend), two tabs sending at once (no duplicates).

### C. Lead alerts and reconciliation
- **Daily:** check `/dashboard/leads`. Any lead whose alert failed is in a red box → *Re-send alert*, or reply directly. Vercel logs last about 1 hour, so the dashboard is the record.
- **Weekly:** mark leads *contacted* / *closed*. Anything still *new* after 24 hours breaks the promise.

### D. Gmail filters (Gmail → Settings → Filters → Create new filter)
The Gmail connector can read mail but cannot create filters. All alerts are **from** `bookings@bestnightlifethailand.com` **to** `bestnightlifethailand@gmail.com`; the 18 Nov tests landed in *Updates*.

| Filter | Subject contains | Actions |
|---|---|---|
| VIP / private | `"VIP LEAD"` | Label **Leads/Private** · Categorize **Primary** · Always important · Never spam |
| Contact | `"CONTACT LEAD"` | Label **Leads/Contact** · Categorize **Primary** · Never spam |
| Waitlist | `"Waitlist:"` | Label **Leads/Waitlist** · Never spam · (optional) Skip Inbox |

### E. Privacy requests and retention
- Removal requests:
  - Waitlist: *Unsubscribe* or *Delete*.
  - Inquiry/contact: *Delete (removal request)*, and also delete the Gmail alert.
  - Bookings: handle manually (accounting records).
- **Monthly retention review:** follow `docs/privacy/RETENTION_SCHEDULE.md`. The dashboard lists records inactive for 24+ months. Use *Keep (hold)* for active relationships, disputes or legal reasons.

## Privacy notices
- `/privacy` serves the BEST notice on bestnightlifethailand.com and the BCC notice on bkkclubcrawl.com (`components/privacy/*`).
- On previews it is always visible, marked DRAFT; use `?brand=bnt` to see BEST.
- On production it returns 404 and nothing links to it until `PRIVACY_NOTICE_PUBLISHED=true` and `PRIVACY_NOTICE_EFFECTIVE_DATE` are set in Vercel (`docs/privacy/OPEN_QUESTIONS.md`). Merging PR #11 alone publishes nothing.

## Housekeeping status

| Item | Status | Detail |
|---|---|---|
| BCC sitemap "Couldn't fetch" | Code resolved; recheck in Search Console | `www.bkkclubcrawl.com/sitemap.xml` returns 200 XML; re-submit under the `www`/domain property |
| BCC → BEST SMC two hops | Outstanding: Vercel setting | Switch `bkkclubcrawl.com` from "Redirect to www" to "Connect to project"; the code apex→www rule takes over |
| Social previews | Code resolved | Refresh via Meta Sharing Debugger |
| External "Loveable" BCC connector | Outdated; outside this repo; not touched | Lists 8 retired nights and "New in Bangkok · Wed · THB 800"; its owner should update it from `lib/bccTerms.ts` |
