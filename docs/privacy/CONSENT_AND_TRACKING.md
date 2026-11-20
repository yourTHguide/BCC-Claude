# Meta Pixel & consent — what was found, what PR #11 changes, effect on reporting

Updated after the pre-release review (approved 20 Nov 2026: remove duplicate PageView, exclude private pages, implement Accept / Only necessary consent, production hosts only). No Google Analytics, new pixels, new events or Phase 4 tracking added.

## 1. Before (production today)

| | |
|---|---|
| Pixel | `302051565703286`, one pixel for BEST and BCC, loaded `beforeInteractive` on **every** page of both sites and on previews (`*.vercel.app` fell back to BCC) |
| Consent | None. Cookies `_fbp`/`_fbc` set and PageView sent on page load |
| Duplicate PageView | The `<noscript>` fallback `<img>` was also **preloaded by React in every JS browser** → two PageViews per page view |
| Private URLs | Staff pages, `/ticket/<token>` and (in the first PR #11 version) the server-rendered `<noscript>` image could still send private URLs |
| Third parties | Elfsight reviews and Google Maps embed loaded without consent on BCC |

## 2. After (PR #11)

| Visitor state | Meta | Elfsight / Google Maps (BCC) |
|---|---|---|
| No choice yet (banner showing) | Nothing loads, no cookie, no event | Placeholder with "Show reviews" / "Show map" (per page view) |
| "Only necessary" | Nothing loads | Placeholder |
| "Accept" | Pixel loads; PageView; existing ViewContent / InitiateCheckout / Purchase / Lead / SelectNight unchanged | Load normally |
| Withdraws later ("Cookie settings" → Only necessary) | Page reloads without the pixel; `_fbp`/`_fbc` removed | Placeholder |
| Private pages (`/dashboard`, `/operator`, `/login`, `/set-password`, `/ticket/*`, `/waitlist/unsubscribe`) | Never, even with consent; no banner | n/a |
| No JavaScript | Never (no `<noscript>` pixel exists any more — such visitors can't consent) | n/a |
| Preview / `bcc-claude.vercel.app` / local | Never (no loader in the HTML) | Consent-gated as above (for QA) |

Implementation:
- `components/consent/ConsentManager.tsx` — banner per brand (BEST black/pink, BCC plum), two equal-weight buttons, brand-accurate purposes; loads the pixel when a visitor accepts.
- `lib/consentConfig.ts` — on production hosts only, a tiny inline loader. It checks the `snx_consent` cookie and loads the pixel early **only for visitors who already accepted**, so page-load events such as BCC's `ViewContent` keep their original timing.
- The banner never blocks forms or the Book button: it sits above fixed bottom bars and steps aside while the BEST inquiry modal is open.
- "Cookie settings" link in every storefront footer (and on `/privacy`). A "Privacy notice" link appears in the banner and footers wherever the brand's notice is available (previews now; production once published).
- The choice is stored in a first-party cookie `snx_consent=1:all|necessary`, kept 12 months, separately per site.

## 3. Verified (local production build, phone viewports, both brands)

- Raw HTML for `/`, `/contact`, `/weekends`, `/book`, ticket and unsubscribe pages: **no** `facebook.com/tr`, **no** `<noscript>` pixel, no Elfsight script tag, no Maps iframe.
- First visit: banner shown, zero requests to Meta/Elfsight/Google Maps.
- "Only necessary": zero requests, on this page and the next.
- Accept via Cookie settings: one fbevents load, one PageView. On BCC, Elfsight and Maps load.
- Reload after Accept: pixel loads immediately. BCC `/weekends` fires PageView + ViewContent (as before).
- Ticket and unsubscribe pages with consent: no Meta.
- Withdrawal: reload, no Meta, `_fbp` removed.
- Preview host: Accept → still no Meta.
- Forms: inquiry/contact/waitlist all work with no choice made. `Lead` fires only with consent, once per genuine submission. Repeat waitlist sign-ups: no `Lead`.
- BCC: Book button works with banner open; `/weekends` → `/book` unchanged. No booking, checkout, Stripe, pricing or terms file changed.

## 4. Expected effect on Meta reporting (please read before deploying)

1. **PageViews drop** — the duplicate noscript PageView was inflating every page view (likely up to ~2×). Real visits are unchanged.
2. **All events drop for visitors who don't accept.** Industry experience: typically 20–50% of visitors decline or ignore banners, so expect PageView/ViewContent/InitiateCheckout/Purchase/Lead counts and retargeting audiences to shrink by a similar share. Ad delivery optimisation will have less signal; consider optimising on events with enough volume.
3. **No more test traffic** from Vercel previews.
4. **No staff/check-in traffic** (dashboard, ticket pages).
5. Bookings, revenue and leads themselves are unaffected — only what Meta can see. Our own database remains the source of truth for leads and bookings.

Compare in Events Manager over the 2 weeks before vs after release, using our database as the baseline (bookings, `bnt_*` lead tables).

## 5. Phase 4 (not done here)

Conversions API with consent-aware sending and `eventID` dedup; UTM/click-ID capture on leads; cross-domain BEST↔BCC attribution; separate datasets per brand; self-hosted fonts (also listed as an open question).
