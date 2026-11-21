# Privacy notices — status and remaining wording for approval

Canonical text: `components/privacy/BestPrivacyNotice.tsx`, `BccPrivacyNotice.tsx`, `NoticeParts.tsx` (rendered at `/privacy` per domain; preview: `/privacy` and `/privacy?brand=bnt`). The notices are **not legally reviewed**. Highlighted markers on the page = items below.

## Decided by the owner (21 Nov 2026) — now final wording
| Topic | Wording in the notices |
|---|---|
| Inactive inquiries / contact messages | Kept up to 24 months after the last meaningful interaction (exceptions: booking, ongoing relationship, dispute, legal requirement) |
| Venue sharing | "limited to the information reasonably necessary for the particular booking… Not every venue receives guest names." |
| Privacy contact | bookings@bestnightlifethailand.com (both brands) |
| BCC general bookings | bangkokclubcrawl@gmail.com (BCC notice, section 1) |
| Fonts | Self-hosted; notices say loading a page does not contact Google |
| Operator | Sanctuary Nexus Co., Ltd., Thai name, tax ID 0105564153714, correspondence address |
| WhatsApp | +66 66 039 9569 (verified as the only public number on both storefronts) |

## Needs the owner — [CONFIRM]
| # | Item | Where | Current placeholder |
|---|---|---|---|
| C1 | Booking and payment record retention period | Both, section 6 | "For the period required by Thai accounting and tax law **[CONFIRM: exact period, with your accountant]**, and longer only if needed for a dispute or legal claim" — if the accountant prefers not to state a number, the sentence can be published without the marker as-is |
| C2 | Effective date | Both, top | Set to the release date at publication |

## Needs professional verification — [LEGAL] (recommended wording already in place)
| # | Topic | Exact recommended wording | What to verify |
|---|---|---|---|
| L1 | Processing bases | Table in section 2: inquiries "Steps taken at your request before entering into a contract (s.24(3))"; contact form "Steps before a contract (s.24(3)) or our legitimate interest in answering enquiries (s.24(5))"; BCC bookings "Performance of a contract (s.24(3))"; waitlist, SMC updates, advertising cookies "Your consent (s.19)"; payment records "legal obligation (s.24(6))" | That each basis is correct and sufficient |
| L2 | Cross-border transfers | "Where personal data is transferred abroad, we rely on the grounds permitted by sections 28 and 29 of the PDPA, such as where the transfer is necessary to provide the service you requested." | The ground for each provider (Supabase–SG; Vercel, Resend, Stripe, Meta, Elfsight, Google–US) |
| L3 | Processor agreements | "Service providers acting on our behalf: Supabase…, Vercel…, Resend…, Google…" | That data-processing terms are in place (most are standard online terms — check each) |
| L4 | Rights-request timeline | "We aim to respond within 30 days." | Response period and wording |
| L5 | Breach notification | "if a personal data breach affects you, we will act as the PDPA requires." | Wording and internal procedure (PDPC notification timing) |
| L6 | Unsubscribe suppression period | "After you unsubscribe we keep your email address and the date for 24 months as a suppression record… and then delete it" | That 24 months is proportionate |
| L7 | DPO | Not mentioned in the notices | Whether a Data Protection Officer is required (PDPA s.41); if so, add their contact |
| L8 | Consent banner | "With your permission we use Meta (Facebook/Instagram) cookies to measure our ads…" + equal "Only necessary" / "Accept" | Wording and design under PDPC cookie guidance |

## How to publish (after C1–C2 and your decision on the [LEGAL] items)
1. Remove the remaining markers in the three components (Claude can do this once you approve the wording, with or without professional review).
2. Set `PRIVACY_TEXT_FINAL` to `true` for both brands in `lib/privacy/publish.ts`.
3. Vercel → Settings → Environment Variables → Production: `PRIVACY_NOTICE_PUBLISHED=true`, then redeploy (or include in the release deploy).
4. Result: `/privacy` serves on each domain, is indexable and in the sitemap; the consent banner and every footer link to it. Either switch alone does nothing.
