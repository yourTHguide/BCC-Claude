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

## Final production release checklist

Gate: steps 1–2 must be done before step 3. Nothing below runs without the owner's go-ahead.

1. **Staging rehearsal passes.**
   - Run `supabase/rehearsal/20261118000002_staging_rehearsal.sql` in the **staging** SQL editor (`jyhtznpethgzypblppnt`), or approve the Supabase prompt when Claude runs it.
   - Expected results:
     - columns after the rollback script: 11/5/7, and the two new tables are gone;
     - both comparisons `true`;
     - backfill email `guest@example.com` and experience `Yacht Party` on the Phase 3 row; `none` on the plain row;
     - every `check:` row matches its "expect" label;
     - columns after the migration: 23/12/15/12/12.
   - It ends in ROLLBACK, so staging is unchanged.
2. **Privacy decision.** Either:
   - (a) approve the proposed wording for the open items; Claude finalises both notices, then you set `PRIVACY_NOTICE_PUBLISHED=true` (Vercel → Production) — recommended; or
   - (b) ship without notices (they stay 404 and unlinked).
3. **Back up production:** export `bnt_experience_inquiries`, `bnt_contact_messages`, `bnt_waitlist` as CSV. Expected counts today: 1, 1, 0.
4. **Apply the migration** on production `oomhftxgvikzxlvqdcmr`: paste `supabase/migrations/20261118000002_bnt_lead_operations.sql` into the SQL editor. Then check:
   ```sql
   select count(*), count(email), count(experience), count(*) filter (where source is null) from bnt_experience_inquiries; -- source null = 0
   select count(*) from bnt_waitlist_announcements; -- 0
   select pg_get_constraintdef(oid) from pg_constraint where conname = 'bnt_waitlist_deliveries_status_check'; -- includes 'unconfirmed'
   ```
5. **Merge PR #11.** Vercel deploys production. Watch the deployment reach Ready.
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
     - `/privacy` serves only if step 2(a) was done.
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
- **Google Fonts** still load before consent (open question 8). The outdated external "Loveable" connector is unchanged.
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
- On production it returns 404 and nothing links to it until both switches are set (`docs/privacy/OPEN_QUESTIONS.md` → How to publish). Merging PR #11 therefore publishes nothing.

## Housekeeping status

| Item | Status | Detail |
|---|---|---|
| BCC sitemap "Couldn't fetch" | Code resolved; recheck in Search Console | `www.bkkclubcrawl.com/sitemap.xml` returns 200 XML; re-submit under the `www`/domain property |
| BCC → BEST SMC two hops | Outstanding: Vercel setting | Switch `bkkclubcrawl.com` from "Redirect to www" to "Connect to project"; the code apex→www rule takes over |
| Social previews | Code resolved | Refresh via Meta Sharing Debugger |
| External "Loveable" BCC connector | Outdated; outside this repo; not touched | Lists 8 retired nights and "New in Bangkok · Wed · THB 800"; its owner should update it from `lib/bccTerms.ts` |
