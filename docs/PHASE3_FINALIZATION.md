# BEST Phase 3 finalization — release runbook & operating guide

Branch `claude/phase-3-finalization-tswihx` · base `main` 6af637d (PR #10). Nov 2026.
Nothing changes in BCC booking terms, prices, Stripe settings, event dates, capacity or checkout.

## Work packages and commits

| WP | Commit | What |
|---|---|---|
| A | `feat(best): lead operations…` | Migration, structured inquiries, alert tracking, `/dashboard/leads`, waitlist announcements, unsubscribe |
| A | `fix(best): private inquiry + contact form usability…` | Phone/country code, validation, iOS modal height |
| A | `fix(smc): distinguish the usual schedule…` | "Usually the last Thursday", no computed fallback date |
| B | `fix(tracking): stop duplicate noscript PageView…` | **Changes Meta reporting — approve separately** |
| C | `chore(seo): apex bkkclubcrawl.com -> www rule…` | Inert until a Vercel domain setting changes |
| B | `docs(privacy): …` | `docs/privacy/*` — audit, consent recommendation, two policy drafts (not published) |

Each commit can be reverted on its own.

## Release steps

1. **Production DB (additive).** Apply `supabase/migrations/20261118000002_bnt_lead_operations.sql` to production (`oomhftxgvikzxlvqdcmr`) in the Supabase SQL editor. Staging (`jyhtznpethgzypblppnt`) already has it.
   Checks afterwards:
   ```sql
   select count(*) from bnt_experience_inquiries where source is null;   -- 0
   select count(*), count(email), count(experience) from bnt_experience_inquiries;
   select count(*) from bnt_waitlist_announcements;                      -- 0
   ```
   Order is forgiving: if the code deploys first, forms keep working in the Phase 3 format (tested), but structured fields and alert tracking start only once the migration is applied.
2. **Approve the tracking commit** (see `docs/privacy/CONSENT_AND_TRACKING.md` §4). If not approved yet, revert `fix(tracking)…` on the branch before merging.
3. **Merge the PR.** Vercel deploys production.
4. **Live checks** (bestnightlifethailand.com, on a phone):
   - Private inquiry labelled "TEST Phase 3F", country +66, number typed as `081…`. Alert arrives in Gmail; `/dashboard/leads` shows it with "Alerted", WhatsApp `+6681…`, email/experience in their own fields. Delete it with the dashboard's Delete button.
   - Contact form test the same way.
   - Waitlist: sign up your own address on `/new-in-bangkok` → alert arrives → dashboard shows consent text. Unsubscribe via dashboard, then Delete.
   - Single Meet Club card reads "Usually last Thursday · Next: Thu 26 Nov".
   - bkkclubcrawl.com `/book` opens and reaches Stripe (do not pay).

## Rollback

- Code: promote the previous production deployment in Vercel, or revert the merge.
- DB: `supabase/rollback/20261118000002_bnt_lead_operations_down.sql` (roll back code first; export first — see file). Leaving the columns in place is harmless to the old code.

## Operating workflows

### A. New in Bangkok waitlist → announcing new dates (human-approved)
1. Open the dates in the dashboard calendar as usual (price, time, capacity). **Opening dates sends nothing.**
2. `/dashboard/leads` → Waitlist → *Announce new dates*: tick the open dates, write a subject (and optional intro) → *Save draft & preview*.
3. Check the preview: dates, time, price. *Send test to me* → check it in Gmail on your phone, including the "See dates & book" button.
4. Tick "I have checked the dates, prices and that booking is open" → *Approve & send*. The confirmation dialog shows the recipient count.
5. Safeguards: only subscribers of that event who haven't unsubscribed; each person at most once per announcement (database-enforced); send is blocked if any date has since closed or its price/time changed; failed sends can be retried without re-sending to anyone who already got it; who approved and when is recorded.
6. Future products (e.g. Bangkok Mixer): add a new entry to `lib/bnt/waitlist.ts` with its own slug and consent wording. New in Bangkok subscribers are **not** carried over — the database only accepts the `event_dates` consent scope, and announcements filter by product.

### B. Lead alerts and reconciliation
- Every lead is saved first, then the alert is sent, then the result is written to the lead (`alert_status`).
- **Daily (or whenever you reply to leads):** open `/dashboard/leads`. A red box lists any lead whose alert failed or never completed → *Re-send alert* or reply directly. Vercel keeps logs ~1 hour on the current plan, so the dashboard — not the logs — is the record.
- **Weekly:** mark replied leads *contacted*/*closed*. Anything still *new* after 24 hours breaks our promise.

### C. Removal / privacy requests
- Waitlist: *Unsubscribe* (keeps a do-not-email record) or *Delete* (removes completely).
- Inquiry/contact: *Delete (removal request)*. Also delete the matching Gmail alert.
- Bookings: not deletable from the dashboard (payment records). Handle by hand once retention rules are decided.

### D. Gmail filters (apply in Gmail → Settings → Filters → Create new filter)
The Gmail connector here can read mail but cannot create filters, so these are for you to apply. All alerts come **from** `bookings@bestnightlifethailand.com` **to** `bestnightlifethailand@gmail.com` (verified on the 18 Nov test alerts, which landed in *Updates*).

| Filter | From | Subject | Actions |
|---|---|---|---|
| VIP / private | `bookings@bestnightlifethailand.com` | `"VIP LEAD"` | Apply label **Leads/Private** · Categorize as **Primary** · Always mark as important · Never send to Spam |
| Contact | `bookings@bestnightlifethailand.com` | `"CONTACT LEAD"` | Label **Leads/Contact** · Categorize as **Primary** · Never send to Spam |
| Waitlist | `bookings@bestnightlifethailand.com` | `"Waitlist:"` | Label **Leads/Waitlist** · Never send to Spam · (optional) Skip the Inbox — sign-ups need no reply |

Tick "Also apply filter to matching conversations". Single Meet Club alerts already have your *SINGLE MEET CLUB* label and are unaffected. No new recipients were added; alerts still go to one inbox.

## Housekeeping status

| Item | Status | Detail |
|---|---|---|
| BCC Search Console sitemap "Couldn't fetch" | **Code side resolved; re-check needed (outside access)** | `https://www.bkkclubcrawl.com/sitemap.xml` returns 200 `application/xml` with 3 URLs; robots.txt points to it. In Search Console, remove and re-submit the sitemap under the `www` (or domain) property. |
| Two-hop BCC → BEST Single Meet Club redirect | **Still outstanding — needs a Vercel setting** | Cause: `bkkclubcrawl.com` has a domain-level 308 to `www` (Vercel → Domains), which runs before the app's BCC→BEST rule. The code now has its own apex→www rule, so you can switch that domain from "Redirect to www.bkkclubcrawl.com" to "Connect to project"; then apex→BEST is one hop and every other page still goes to www. Links from the www site are already one hop. |
| Outdated social previews | **Resolved in code; caches outside access** | Per-page OG images exist since SEO Phase 1 (`public/og/*`). Refresh old shares in Meta's Sharing Debugger ("Scrape again") for `/`, `/weekends`, `/new-in-bangkok`, `/single-meet-club`. |
| External BCC info connector with outdated listings | **Outdated; outside this repo — not touched** | The connected "Loveable" Bangkok Club Crawl connector still lists 8 retired themed nights (Solo, Nomad, Girls, 30+, LGBT+, TGIF, Signature) and "New in Bangkok Night · Wednesday · THB 800". Its owner/source of truth is not in this repository; it should be updated from BCC Phase 2 terms (`lib/bccTerms.ts`) by whoever maintains that app. |
