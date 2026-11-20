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

## Production migration & deployment sequence

Do these in order. Steps 1–2 change production; do them only once you authorise the release.

0. **Before:** confirm PR #11 is approved, Vercel check is green, and nobody is mid-announcement (there are none yet).
1. **Back up the four tables** (Supabase → Table editor → export CSV): `bnt_experience_inquiries`, `bnt_contact_messages`, `bnt_waitlist`, plus a note of row counts (today: 1, 1, 0).
2. **Apply the migration** to production `oomhftxgvikzxlvqdcmr`: paste `supabase/migrations/20261118000002_bnt_lead_operations.sql` into the SQL editor and run. Only adds columns/tables; copies Phase 3 email/experience into the new columns; deletes nothing.
   Checks:
   ```sql
   select count(*), count(email), count(experience), count(*) filter (where source is null) from bnt_experience_inquiries;  -- source null = 0
   select count(*) from bnt_waitlist_announcements;   -- 0
   select pg_get_constraintdef(oid) from pg_constraint where conname = 'bnt_waitlist_deliveries_status_check'; -- includes 'unconfirmed'
   ```
3. **Merge PR #11.** Vercel deploys production. (If the code were deployed before step 2, forms still save in the Phase 3 format — tested — but structured fields, alert tracking and announcements need the migration.)
4. **Live checks** (phone, private/incognito window):
   - bestnightlifethailand.com: the cookie banner appears. Choose **Only necessary**. In Meta Events Manager → Test events, nothing arrives.
   - Footer → Cookie settings → **Accept**: a PageView arrives in Test events.
   - Private inquiry "TEST Phase 3F", +66, number typed `081…`. The alert arrives in Gmail. `/dashboard/leads` shows it "Alerted" with WhatsApp `+6681…` and email/experience in their own fields. Then Delete it.
   - Contact form: test the same way.
   - Waitlist: sign up your own address on `/new-in-bangkok`. The alert arrives and the dashboard shows the consent text. Then Unsubscribe → Delete.
   - SMC card reads "Usually last Thursday · Next: …".
   - bkkclubcrawl.com/weekends: banner sits above the Book bar. Book → `/book` → reaches Stripe (do **not** pay). Reviews/map show placeholders until Accept.
5. **Gmail filters** (section D) and **Vercel domain setting** (housekeeping) at your convenience.

### Rollback
- Code: Vercel → promote the previous production deployment (instant), or revert the merge.
- Database: `supabase/rollback/20261118000002_bnt_lead_operations_down.sql`. Roll back the code first and export first (the file explains this). The old code ignores the new columns, so leaving them in place is safe.
- Rollback rehearsal (rollback → Phase-3 rows → migration twice → checks → ROLLBACK) is prepared for staging; see the PR thread for its status.

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

## Housekeeping status

| Item | Status | Detail |
|---|---|---|
| BCC sitemap "Couldn't fetch" | Code resolved; recheck in Search Console | `www.bkkclubcrawl.com/sitemap.xml` returns 200 XML; re-submit under the `www`/domain property |
| BCC → BEST SMC two hops | Outstanding: Vercel setting | Switch `bkkclubcrawl.com` from "Redirect to www" to "Connect to project"; the code apex→www rule takes over |
| Social previews | Code resolved | Refresh via Meta Sharing Debugger |
| External "Loveable" BCC connector | Outdated; outside this repo; not touched | Lists 8 retired nights and "New in Bangkok · Wed · THB 800"; its owner should update it from `lib/bccTerms.ts` |
