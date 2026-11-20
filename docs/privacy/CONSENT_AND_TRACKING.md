# Meta Pixel & consent readiness — audit and recommendation

Phase 3 finalization, 20 Nov 2026. Scope: what runs today, what this branch fixes, and what needs your decision before Phase 4 (Conversion Tracking & Attribution). Phase 4 implementation work is **not** included here.

## 1. Audit findings

| Question | Finding (verified) |
|---|---|
| Where does the base pixel load? | `app/layout.tsx`, `strategy="beforeInteractive"`, on **every page of both hosts** (and on any unknown host such as Vercel previews, which fall back to the BCC storefront). One pixel ID for both brands. |
| Cookies? | Yes. Meta's script sets the first-party `_fbp` cookie and `_fbc` when the visitor arrives from an ad click (`fbclid`). It also sends IP, user agent and full page URL to Meta. |
| PageView? | Yes, immediately on load. **Bug, fixed here:** the `<noscript>` fallback image was also preloaded by React in every normal browser, so each page sent **two** PageViews. |
| Lead events only after genuine success? | Yes. Private inquiry, contact and waitlist fire `Lead` only after the server returns success (verified in tests: one `Lead` per successful submit, none on validation errors or failures). |
| Duplicate Lead events? | Waitlist: a repeat sign-up for an address already on the list fired a second `Lead`. **Fixed here** (server returns `duplicate`, no event). Inquiry/contact: a guest who genuinely submits twice produces two Leads — acceptable; proper dedup (`eventID`) belongs to Phase 4 with the Conversions API. |
| Consent collected? | **No.** No banner, no notice, no privacy page, no opt-out. |
| Tracking active before consent? | **Yes — all of it.** |
| BEST vs BCC differences | Same pixel and base code. BCC pages additionally fire `ViewContent`, `InitiateCheckout`, `Purchase` (value/qty from the verified Stripe session) and custom `SelectNight`. BEST fires `Lead` on its three forms; New in Bangkok/SMC booking flows reuse BCC's checkout events. |
| Other third parties before consent | Google Fonts (all pages, IP to Google), Elfsight reviews widget and Google Maps embed (BCC `/weekends`). |
| Sensitive URLs to Meta | `/ticket/<token>` and staff pages were sent with PageView. **Fixed here** — pixel no longer loads on `/dashboard`, `/operator`, `/login`, `/set-password`, `/ticket/*`, unsubscribe pages. |

## 2. Release-critical issue

**Non-essential advertising tracking (Meta Pixel) runs on both sites before any notice or consent, and neither site has a privacy notice.**

Under Thailand's PDPA, consent (s.19) is the lawful basis normally relied on for advertising/targeting cookies and pixels; such tracking can't generally be justified as "strictly necessary", contract or legitimate interest, and the PDPC's cookie guidance treats marketing cookies as consent-based. Visitors from the EU/UK are additionally covered by GDPR/ePrivacy rules that require prior consent. This is my assessment, not legal advice — please have it confirmed.

I have **not** added a banner or changed when the pixel loads, because that will reduce what Meta reports and you asked for that to be explained first.

## 3. Recommended remediation (least disruptive that's compliant)

**Option A — recommended: simple consent banner, pixel loads only after "Accept".**

- Small bottom bar, BEST/BCC styling, two equal buttons: **Accept** / **Only necessary**. Link to the privacy page. "Cookie settings" link in both footers to change the choice.
- Before a choice: nothing from Meta loads (no script, no cookie, no PageView). Elfsight/Maps show a "Load reviews/map" placeholder or are included under the same consent (your choice).
- After Accept: current pixel behaviour, unchanged. Choice stored in a first-party cookie for 6–12 months (strictly necessary, no consent needed).
- No banner on `/dashboard`, `/operator`, ticket pages.
- Effort: one component + a small change in `app/layout.tsx`; independently revertible.
- **Measurement impact:** visitors who decline (or ignore the banner) no longer appear in Pixel data — commonly 20–50% fewer tracked visitors and conversions, and smaller retargeting audiences. Phase 4 can partly recover reporting with server-side conversion reporting under an appropriate basis, plus UTM-based attribution in our own database (no third party).

**Option B — Meta consent mode (`fbq('consent','revoke')` until Accept).** Keeps the script loading before consent (Meta still receives the IP/browser request), so it is weaker; not recommended.

**Option C — notice only ("by using this site you accept cookies").** Not valid consent under PDPA/GDPR; not recommended.

Also recommended, low effort, no measurement impact:
- Self-host fonts via `next/font` (removes the Google Fonts transfer).
- Load the pixel only on the two production domains, not Vercel previews or `bcc-claude.vercel.app` (removes test traffic from ad data).

## 4. What this branch changes in tracking (needs your OK before deploy)

| Change | Effect on Meta reporting |
|---|---|
| Duplicate noscript PageView removed | **Reported PageViews will drop** (likely close to half, if Meta was counting both). Conversions, ViewContent, InitiateCheckout, Purchase, Lead unchanged. Any PageView-based custom audience/optimisation will look smaller — it was inflated. |
| Pixel off on staff + token pages | Removes staff/check-in noise; no guest-facing marketing pages affected. |
| Waitlist repeat sign-ups no longer fire `Lead` | Slightly fewer, more accurate Leads. |

No new trackers, events or audiences were added.

## 5. Kept for Phase 4

Conversions API and `eventID` dedup, UTM/click-ID capture on leads (the new `source` column is form-level only, deliberately), consent-aware attribution, cross-domain BCC↔BEST measurement, separating BEST vs BCC pixels or datasets.
