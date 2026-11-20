# Open questions before publishing the privacy notices

The drafts are **not legally reviewed**. These need an answer from you (**[CONFIRM]**) or a Thai data-protection professional (**[LEGAL]**). Nothing here blocks releasing the operational code in PR #11; items 1–5 block *publishing* the notices.

| # | Question | Who | Why it matters |
|---|---|---|---|
| 1 | Lawful basis for each processing purpose (table in each notice), especially inquiries (s.24(3) vs s.24(5)) | LEGAL | Must be stated accurately |
| 2 | Basis for each transfer outside Thailand (Supabase–Singapore; Vercel, Resend, Stripe, Meta, Elfsight, Google–USA) under PDPA s.28–29; whether data-processing agreements are in place with each provider | LEGAL + CONFIRM | The drafts deliberately state no safeguard until confirmed |
| 3 | Booking/payment retention period (Accounting Act / Revenue Code — commonly at least 5 years) | CONFIRM with accountant | Needed for both notices and the annual review |
| 4 | Which venues, if any, receive guest names, and in what situations | CONFIRM | The notices only say "when reasonably necessary" until confirmed |
| 5 | Whether a Data Protection Officer is required (PDPA s.41) — likely not at current scale, but confirm | LEGAL | If required, the notices must name the DPO |
| 6 | Consent-banner wording and the "Only necessary" default, under PDPC cookie guidance | LEGAL | Banner is implemented; wording can change without code risk |
| 7 | Suppression period for unsubscribed waitlist addresses (proposed: 24 months) | CONFIRM | Retention schedule |
| 8 | Keep or remove Google Fonts loading before consent (recommend self-hosting fonts — removes the transfer; small design-safe code change) | CONFIRM | Fonts currently load from Google on every page |
| 9 | Response-time commitment for rights requests (draft: 30 days) and breach-notification wording | LEGAL | Stated in both notices |
| 10 | Which public email appears on BCC pages vs. the privacy contact (BCC shows bangkokclubcrawl@gmail.com; privacy contact is bookings@bestnightlifethailand.com) | CONFIRM | Both are listed in the BCC draft; confirm that's intended |
| 11 | Links from the banner/footers to the privacy pages once published (one-line change) | — | Do at publication time |

Verified facts used in the drafts: operator Sanctuary Nexus Co., Ltd., Thai name, tax ID and correspondence address (from you, 20 Nov 2026); WhatsApp +66 66 039 9569 is the only public WhatsApp number on both storefronts (code check: BEST contact constants, BCC footer, sticky bar, product page, structured data). Neither notice mentions a tourism licence.
