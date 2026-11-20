# Personal data flow audit — BEST Nightlife Thailand & Bangkok Club Crawl

Phase 3 finalization, 20 Nov 2026. **Source: this repository, the production and staging Supabase schemas (read-only), the Vercel project configuration, and observed requests in a local production build.** Nothing here is inferred from marketing copy. Where something could not be verified it says so.

Both sites are served by **one Next.js app** (Vercel project `bcc-claude`), one Supabase project (production `oomhftxgvikzxlvqdcmr`, region ap-southeast-1 Singapore), one Resend account and one Meta Pixel (`302051565703286`). The host name decides which brand is shown (`lib/storefront.ts`).

## 1. What is collected, where, why

| # | Touchpoint | Site | Personal data | Stored in | Purpose | Sent to |
|---|---|---|---|---|---|---|
| 1 | Private experience inquiry (homepage modal) | BEST | Name, WhatsApp, email (optional), experience, occasion, date, group size, budget, vibe, free-text details | `bnt_experience_inquiries` | Reply with a proposal | Resend → team inbox (alert) |
| 2 | Contact form `/contact` | BEST | Name, WhatsApp, message | `bnt_contact_messages` | Reply | Resend → team inbox |
| 3 | Event waitlist `/new-in-bangkok` | BEST | Email, first name (optional), consent wording + time | `bnt_waitlist` (+ `bnt_waitlist_deliveries`) | Email when new New in Bangkok dates open — nothing else | Resend → team inbox (alert); Resend → subscriber (announcement, after approval) |
| 4 | Single Meet Club booking `/single-meet-club/book` | BEST | Lead name, email, WhatsApp, attendee first/full names, age confirmation (20+), terms acceptance, **optional marketing opt-in** | `smc_registrations` | Ticketing, door list, event updates | Stripe Checkout (payment); Resend (confirmation + team alert) |
| 5 | Bangkok Club Crawl booking `/book` → Stripe | BCC (also listed on BEST) | Name, email, phone (Stripe collects phone; `phone_number_collection: enabled`), billing address where Stripe asks (`billing_address_collection: auto`), quantity, date | `bookings`, `booking_attendees` | Ticketing, meeting-point messages, check-in | Stripe Checkout; Resend (confirmation, meet-up, reschedule, cancellation emails) |
| 6 | QR ticket `/ticket/<token>` | BCC | Booking reference, name, date | `bookings` (token) | Entry check-in | — |
| 7 | OTA bookings (GetYourGuide/Viator/Airbnb/Klook etc., imported by staff from spreadsheets) | BCC | Guest name, email (where the platform provides it), notes | `ota_bookings` | Door list, capacity | — (data arrives *from* the platform) |
| 8 | WhatsApp links/buttons | Both | Whatever the guest sends on WhatsApp | WhatsApp (Meta), the team's phone | Conversation | Meta/WhatsApp |
| 9 | Meta Pixel | Both | Cookies `_fbp` (and `_fbc` from ad clicks), IP, user agent, page URL, events: PageView, ViewContent, InitiateCheckout, Purchase (value, quantity), Lead, custom SelectNight | — (Meta) | Ad measurement / audiences | Meta Platforms |
| 10 | Google Fonts (CSS `@import`) | Both | IP, user agent | — | Fonts | Google |
| 11 | Elfsight reviews widget (`components/Reviews.tsx`, `WeekendsPage.tsx`) | BCC | IP, user agent; may set its own storage (not verified) | — | Show reviews | Elfsight |
| 12 | Google Maps embed (`/weekends`) | BCC | IP, user agent, Google cookies | — | Show meeting area | Google |
| 13 | Hosting & server logs | Both | IP, URL, user agent (request logs) | Vercel (functions observed running in `iad1`, US East) | Serve the site | — |
| 14 | Staff accounts `/login`, `/dashboard`, `/operator` | — | Staff email, role | Supabase Auth, `admin_users` | Access control | — |
| 15 | Partner/venue contacts (B2B) | — | Name, email, phone, notes | `partner_contacts` | Partnerships | — (out of scope for guest notices) |

**Not found anywhere:** Google Analytics/Tag Manager, TikTok, Hotjar, Clarity, Vercel Analytics, HubSpot/Klaviyo/Mailchimp, any newsletter list, any general marketing opt-in on BCC. Only marketing permission that exists: SMC's optional checkbox (#4). The waitlist (#3) is scoped to event-date announcements only (enforced in the database).

## 2. Service providers (processors) actually in use

| Provider | What for | Data location (as far as verifiable) |
|---|---|---|
| Supabase | Database + staff auth | Singapore (ap-southeast-1) — confirmed from project settings |
| Vercel | Hosting, serverless functions, request logs | Global edge; functions observed in `iad1` (USA). Logs kept ~1 hour on current plan |
| Stripe | Card/PromptPay payments, receipts | Stripe (USA/Ireland/others) — Stripe is an independent controller for payment data in many respects |
| Resend | Sending emails from `bookings@bestnightlifethailand.com` | USA (Resend default region; not verified in account) |
| Meta Platforms | Pixel, WhatsApp, Instagram | USA/Ireland |
| Google | Fonts, Maps embed; Gmail inbox where alerts arrive | Global |
| Elfsight | Reviews widget (BCC) | Not verified |
| Booking platforms (GetYourGuide, Viator, Airbnb, Klook…) | Sell BCC tickets; we receive guest details | Independent controllers |

## 3. Retention today (as found)

There is **no automated deletion anywhere**. Every table keeps rows indefinitely. Resend keeps its own sending log; Stripe keeps payment records under its own rules; Gmail keeps alerts until deleted. Retention periods must be decided (see decisions list) — none are documented or enforced today.

## 4. Deletion / rights requests today

Before this release: only by hand in Supabase. After this release: `/dashboard/leads` can unsubscribe or permanently delete an inquiry, contact message or waitlist address. Bookings (`bookings`, `smc_registrations`, `ota_bookings`) still require a manual process because of accounting/payment records — see the policy drafts' rights section and the decisions list.

## 5. Risks found

1. **Meta Pixel runs before any notice or consent** on every page of both sites (release-critical — see `CONSENT_AND_TRACKING.md`).
2. **Duplicate PageView**: the noscript pixel image was preloaded by React in every browser → two PageViews per page view. *Fixed in this branch.*
3. **Token URLs sent to Meta**: `/ticket/<token>` and staff pages sent full URLs with PageView. *Fixed in this branch.*
4. **No privacy notice on either site** while collecting the data above.
5. **No retention limits.**
6. **Two lead alerts go to one personal Gmail inbox** (`bestnightlifethailand@gmail.com`). Fine operationally; note it in the policy as where staff read inquiries.
