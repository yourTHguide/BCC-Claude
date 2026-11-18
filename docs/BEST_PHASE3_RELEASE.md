# BEST Phase 3 (conversion) release runbook — Nov 2026

Branch `best/phase3-conversion` · repo `yourTHguide/BCC-Claude` · base `main` 2bff809.
Scope: bestnightlifethailand.com only. Nothing changes on BCC pages, `/book`, checkout, Stripe, prices or event dates.

## Decisions applied (Guide, 18 Nov 2026)

| | Decision |
|---|---|
| D1 | Lead alerts sent from the verified BEST sender (`resendFromHeader('bnt')`), not `onboarding@resend.dev` |
| D2 | Response promise: "within 24 hours" everywhere |
| D3 | WhatsApp +66 66 039 9569 site-wide |
| D4 | Bangkok Masquerade: "Annual · By invitation", not clickable |
| D5 | New in Bangkok: "Coming soon" (to become Bangkok Mixer later; not renamed here) |
| D6 | Email waitlist: new table `bnt_waitlist`, route `/api/waitlist` |
| D7 | Single Meet Club December: no change (NYE is a Club Crawl night; to decide with Tony's) |
| D8 | Event order: Bangkok Club Crawl (every weekend), Single Meet Club (last Thursday monthly), New in Bangkok, Masquerade |

## Release steps

1. **Production DB, additive only.** Apply `supabase/migrations/20261118000001_bnt_waitlist.sql` to the production project (BCC - Claude, `oomhftxgvikzxlvqdcmr`). It creates one new table with RLS on and no policies, and changes nothing else. It must exist before the deploy, or waitlist sign-ups return an error.
   Already applied to staging (`jyhtznpethgzypblppnt`) on 18 Nov.
   Check: `select count(*) from public.bnt_waitlist;` returns 0.
2. **Push** `best/phase3-conversion` with GitHub Desktop, then open the PR at
   `https://github.com/yourTHguide/BCC-Claude/pull/new/best/phase3-conversion` using the description below.
3. **Merge** the PR. Vercel deploys production.
4. **Live checks** on https://bestnightlifethailand.com:
   - The homepage shows two hero buttons. The Club Crawl card shows "Every weekend · Next: <date>" and the SMC card shows "Last Thursday monthly · Next: Thu 26 Nov".
   - `/new-in-bangkok`: every button says "Notify me" / "Get notified" and goes to `#waitlist`.
   - Submit one test private inquiry, labelled clearly as a test (e.g. name "TEST Phase 3"). Confirm the alert email ("🚨 VIP LEAD … · <experience>") reaches bestnightlifethailand@gmail.com, sent from the BEST sender. Then delete the test row from `bnt_experience_inquiries`. Preview has no `RESEND_API_KEY`, so delivery is only verifiable here.
   - Optional: one waitlist sign-up with your own email, then delete it from `bnt_waitlist`.
   - bkkclubcrawl.com and its `/book` page are unchanged.

## Rollback

- **Code:** in Vercel, promote the previous production deployment (the one live before this merge), or revert the merge commit on main.
- **DB:** `supabase/rollback/20261118000001_bnt_waitlist_down.sql` drops the table. Export any sign-ups first. The code rollback alone is enough: leaving the table has no side effects.

## What is in the branch

- **Homepage** (`components/bnt/BntLandingPage.tsx`, `lib/bnt/upcoming.ts`):
  - Dual hero CTAs.
  - Event cards with the next real open date, read-only from `event_dates.is_open`/`event_date` + `products.slug`/`status`.
  - Private experiences moved above the pillars section.
  - Cross-link to private experiences.
  - Mobile sticky bar (`BntStickyBar.tsx`).
- **Nav/footer** (`BntNav.tsx`, `BntFooter.tsx`): events, private experiences, the three public events, WhatsApp and Instagram.
- **Private inquiry** (`public/bnt/js/luxury-landing.js`, `app/api/vip-inquiry/route.ts`):
  - Selected experience stored in `inquiry_type` ("Private Inquiry · <title>").
  - Optional email stored at the top of `preferred_vibe`; no schema change.
  - Correct occasion pre-select (Romantic, Corporate).
  - 33 country codes.
  - Inline errors.
  - Meta `Lead` event.
- **Contact** (`BntContactPage.tsx`, `app/api/contact/route.ts`): inline errors, Meta `Lead` event, 24-hour promise, verified sender.
- **NIB waitlist** (`BntWaitlistForm.tsx`, `app/api/waitlist/route.ts`, `BntNewInBangkokPage.tsx`):
  - Shown only while New in Bangkok has no open dates.
  - Honeypot field; duplicate emails are ignored.
  - Team alert email; Meta `Lead` event.
- **Shared constants:** `lib/bnt/contact.ts`.

QA: verified on a Vercel Preview with a temporary preview-only storefront override. That commit was removed before release (`git grep previewQaOverride` returns nothing).

## PR description (paste into GitHub)

```
BEST Phase 3 — conversion (bestnightlifethailand.com only)

- Homepage: "Upcoming Events" + "Private Experiences" hero CTAs; event cards show the next real open date (Club Crawl first, then SMC, New in Bangkok "Coming soon", Masquerade "By invitation"); private experiences moved up; mobile sticky bar
- Nav/footer: events, private experiences, WhatsApp, Instagram
- Private inquiry: records the chosen experience, optional email, more country codes, inline errors, Meta Lead event
- Contact: inline errors, Lead event, 24h promise
- Lead alerts sent from the verified BEST sender (was resend.dev sandbox)
- New in Bangkok: email waitlist while no dates are open (new table bnt_waitlist — apply migration before merge)

No changes to BCC, /book, checkout, prices or event dates. Runbook: docs/BEST_PHASE3_RELEASE.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
