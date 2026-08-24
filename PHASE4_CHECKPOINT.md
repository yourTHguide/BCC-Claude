# Phase 4 — Internal Product & Schedule Builder — Checkpoint

_Last updated: 2026-08-24 — added Phase 3.5 (New in Bangkok canonical product update: Wednesday recurrence + ฿490 price), a data-only session between Stage 10 Phase 3 and Phase 4. Stage 10 Phase 3 (port minimum BNT public surface) is COMPLETE. See "Stage 10" section below, which supersedes the "Stage 9 paused" section beneath it — that section is stale: Stage 9 was actually closed and merged to `main` (`8090708`) in a separate session after this doc's prior update. Read Stage 10 first._

## Stage 10 — read this section first

**Objective:** BNT storefront (`bestnightlifethailand.com`) + New in Bangkok launch path, served from this same Next.js app instead of a second implementation in `NightlifeAntigravity`. Full brief: two-domain routing, port minimal BNT surface, canonical `/new-in-bangkok`, storefront-aware checkout/tickets/email, then a Preview-verified domain-cutover plan. See the original session prompt for the complete 9-phase spec — not reproduced here.

**Branch:** `claude/phase4c-content-media-audit-dvu5c1`. **HEAD after this session:** Phase 1+2's `resolveStorefront()` commit, plus Phase 3's BNT page-port commit (below), plus Phase 3.5's data-only commit (below). Not merged to `main`; `main`/production is untouched and still exactly `8090708`.

**Standing invariants reconfirmed this session, still true:** `new-in-bkk` — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`. No DNS/domain moved. `NightlifeAntigravity` untouched (only read via `git fetch`/`git show` — no local writes, no pushes). No Stripe/checkout/email-sender code touched. `CHECKOUT_DYNAMIC_PRICING` untouched. `visible_bcc`/`visible_bnt` untouched on every existing product.

### Phase 3.5 — New in Bangkok canonical product update (Tuesday→Wednesday, ฿590→฿490) — COMPLETE, applied 2026-08-24

**Objective (Guide's product decisions, given directly, not inferred):** move the recurring night from Tuesday to Wednesday (APT 101 already runs Ladies Night on Wednesdays — Women: 3 free drinks at APT 101; Men arriving with the group: free entry — vs. Tuesday's weaker free-entry-plus-a-shot), and drop the standard ticket price from ฿590 to ฿490. Product stays Draft/invisible; no publish, no `CHECKOUT_DYNAMIC_PRICING` change, no Stripe config change, no promo pricing implemented. Data-only session — no application code was changed.

**Audit performed first, against live Supabase (`oomhftxgvikzxlvqdcmr`), before writing anything:**
- `products` (`new-in-bkk`, id `75466d68-23b6-45a9-bc68-96f002fb6b1e`): `status='draft'`, `default_price=590`, `default_start_time='20:30:00'`, `visible_bcc=false`, `visible_bnt=false`.
- `product_schedules`: one row (`1d5483e3-…`), `freq='weekly'`, `weekday=2` (Tuesday — `lib/recurrence.ts` uses `0=Sunday..6=Saturday`, JS `getUTCDay()` convention), `start_date='2026-09-01'`, `generated_through='2026-11-17'`, `is_active=true`.
- `event_dates`: exactly 12 rows, all Tuesdays 2026-09-01 → 2026-11-17, all `is_open=true`. Only `2026-09-01` had any booking.
- `product_content`: already has real, Guide-authored content — meeting point (`Don't Open the Fridge`, real address/maps link, `visibility='public'`) and an `itinerary` that already names the exact two-venue route (`Don't Open the Fridge` → `APT 101` around 22:00). **Crucially: this existing content does NOT mention any Ladies-Night benefit (free drinks for women, free entry for men) anywhere** — confirms nothing in canonical customer-facing content currently promises the Wednesday APT partner benefits, so there was nothing stale to correct on that front, and nothing was added (see "APT benefits" below).
- `product_media`: 1 cover + 2 gallery images, untouched (day-of-week/price-agnostic).
- **Real booking history — the ONE actual row, found and handled carefully:** `bookings.id='cf064654-…'`, guest `Duangruetai Promketsakul` (Guide's own real Stage 9 Stripe E2E test — **not** the "Alex Chen"/"Jamie Rivera" preview-test fixtures named in this doc's stale Stage-9-paused section below, which do not exist in the live DB at all — zero rows matched either of those `ticket_token`s; that section is confirmed stale, not just by its own header but by direct query), `event_date=2026-09-01`, `price_per_person=590`, `total_paid=590`, real `stripe_session_id`/`stripe_payment_id` (`cs_live_…`/`pi_3U7qgqCJ…`), `status='cancelled'`, `attendance_status='checked_in'`, `notes` recording a real Stripe refund (`re_3U7qgqCJ…`). This is genuine transaction history from Stage 9's real-money test and refund — not simulation data.
- `promo_codes` table exists (`code`, `discount_amount` flat-THB, `is_active`, `uses_count`, no product/date scoping) — one row, `Firstcomer`/฿100 off, `uses_count=0`. **Grepped the entire codebase: this table is never read at checkout time by any route.** The actual pricing/discount mechanism already wired into both `create-checkout` paths (dynamic and legacy) is Stripe's own native Promotion Codes (`allow_promotion_codes: true` on the Checkout Session, `app/api/create-checkout/route.ts`) — the webhook only reads `session.discounts[0].promotion_code` back from Stripe afterward, to *record* `bookings.promo_code`/`discount_amount` for reporting. The Supabase `promo_codes` table is vestigial/unused, not the live mechanism.
- Grepped the codebase for anything hardcoding Tuesday/฿590/2026-09-01/these `event_dates`/booking ids outside the DB itself: none found in application code. **One real naming collision, flagged not fixed (out of scope, pre-existing, unrelated to the canonical product):** `app/new-in-bangkok/page.tsx` is a completely different, legacy, statically-hardcoded BCC crawl-night page (slug `'new-in-bangkok'`, NOT `'new-in-bkk'` — a different product family entirely, 4-venue party-van crawl, ฿1,000, legacy `getPriceId()`/`STRIPE_PRICE_WEEKDAY` path) — it already says "Wednesday" and "฿1,000" in its own copy and is wholly unrelated to the canonical Supabase product this session changed. This is the same stale page Phase 2 already flagged as needing a routing decision before cutover; still untouched, still not this session's concern, but worth remembering the two "New in Bangkok" names/slugs will collide once Phase 4 builds real routing.
- No test fixtures, `.md` docs (other than this one), or code reference the specific old event-instance ids/price — nothing else needed updating.

**Data change applied (direct SQL against production via Supabase MCP, mirroring the exact canonical route logic — no ad-hoc invention):**
1. `products.default_price`: `590 → 490` for `new-in-bkk`. (No admin route exists to edit `default_price` post-creation — `GET /api/admin/products/[id]` is read-only, there is no PATCH — a real, pre-existing gap, not something to build this session; a direct data UPDATE on the canonical row is the smallest correct action available.)
2. Old Tuesday `product_schedules` row (`1d5483e3-…`): `is_active` set to `false` — retired, not deleted; `weekday=2`, `start_date`, `generated_through='2026-11-17'` all preserved exactly as history.
3. New Wednesday `product_schedules` row inserted (`71ba2e82-1c68-4448-8d02-89decbe2e402`): `weekday=3`, same `start_date='2026-09-01'` (unchanged — `generateOccurrences()`'s own weekday-rollforward math naturally lands the first occurrence on 2026-09-02, the first Wednesday on/after that start date, so the origin date didn't need to change), same 12-week-horizon convention as the original schedule, `generated_through='2026-11-18'`.
4. 12 new Wednesday `event_dates` rows inserted (2026-09-02 through 2026-11-18 weekly), `is_open=true`, linked to the new schedule — computed and inserted via the identical `ON CONFLICT (event_date, night_slug) DO NOTHING` idempotency key `POST /api/admin/products/[id]/schedule` itself uses, so this is a faithful hand-replication of that route's own logic against production, not a novel operation.
5. **The historical 2026-09-01 Tuesday instance (`3b17cedb-…`) was NOT deleted** — it carries the real cancelled/refunded Stripe booking. `is_open` was set to `false` (closed, not deleted) so it can never look like a valid sellable future date again, while the row, its FK, and the real booking's `event_id`/amount/date/Stripe ids all remain exactly as they were.
6. The 11 other Tuesday instances (2026-09-08 through 2026-11-17) had zero bookings (website AND OTA, confirmed by direct count before deleting) and were in the future — i.e. they satisfied the *exact same guard* `DELETE /api/admin/events/[id]` already enforces ("future AND zero bookings" → hard-delete; otherwise 409, close instead) — so they were hard-deleted rather than left as clutter, per that existing, proven convention rather than inventing a new "how to retire empty instances" rule.

**Post-change verification (direct SQL, all reconfirmed):** `new-in-bkk` still `status='draft'`, `visible_bcc=false`, `visible_bnt=false`; `default_price=490`; `default_start_time` untouched at `20:30:00` (no reason found to change it — nothing in the audit suggested Wednesday should start at a different time). `event_dates` for `new-in-bkk` now total **13** rows: 1 closed historical Tuesday (2026-09-01, `is_open=false`, still carrying the real ฿590 cancelled/refunded booking, untouched) + 12 open Wednesdays (2026-09-02 → 2026-11-18). The prior 12 sellable Tuesdays became 1 historical-closed + 12 new-open once the 11 empty ones were deleted. No duplicate Wednesday rows exist (confirmed by the `ON CONFLICT` insert + a direct re-select). The real booking (`cf064654-…`) is unchanged: `price_per_person=590`, `total_paid=590`, `event_date=2026-09-01`, same Stripe ids, same `status`/`attendance_status`. Total `bookings` row count across the whole database: **8** (matches the pre-Stage-9 baseline of 7 plus this one real Stage 9 test row — confirms nothing else in the database was touched). `bangkok-club-crawl` (BCC's live product) reconfirmed unchanged: `status='active'`, `default_price=1200`, `visible_bcc=true`. No code files were changed this stage, so no typecheck/build was needed or run; the only file changed is this checkpoint.

**On ฿390 launch/early-bird pricing — audited, not built, per explicit instruction not to invent a parallel system:** the smallest safe mechanism is **Stripe's own Promotion Codes/Coupons**, already fully wired — both checkout paths already pass `allow_promotion_codes: true`, and the webhook already reads back and records whatever code Stripe applied. To offer ฿390 at launch, create a Stripe Coupon (฿100 off, or a fixed ฿390 amount_off equivalent) + a Promotion Code in the Stripe Dashboard, optionally with `redeem_by`/`max_redemptions` for a real launch-window cutoff — **zero code changes required**, and it composes cleanly with today's ฿490 → future ฿500 door-price move (a separate, later `event_dates.price_override` per-date decision, not a discount at all). The Supabase `promo_codes` table should NOT be used or extended for this — it's disconnected from checkout today, and building real logic on top of it would be exactly the "parallel pricing system" the brief warned against. If Guide later wants *server-tracked* promo logic (e.g. a code that only works for New in Bangkok specifically, or usage analytics beyond what Stripe's dashboard shows), that would be a real, scoped Phase 5+ decision — not assumed or started here.

**On the Wednesday APT 101 benefits (3 free drinks for women, free entry for men) — explicitly NOT added to canonical content this session, per instruction:** confirmed by direct query that `product_content.itinerary`/`highlights`/`whats_included` currently say nothing about them — the existing copy only says the group "heads together to APT 101" around 22:00, no benefit claims. **These benefits need external confirmation (a real, current agreement with APT 101) before they're entered as canonical, customer-facing content** — until Guide confirms the partnership terms are live/reliable, do not add them to `product_content`, marketing copy, or any future BNT product page. This is a business/partnership confirmation, not a technical one.

**Phase 5 requirement recorded (audit-only this session, nothing built or changed) — storefront-aware transactional email branding:** every transactional email in this app shares ONE hardcoded sender identity and ONE set of templates, with no storefront/product awareness at all:
- All 6 send call sites (`app/api/webhook/route.ts` ×2, `resend-confirmation`, `cancel-booking`, `reschedule-booking`, `send-confirmed-meetup`) hardcode `from: `Bangkok Club Crawl <${process.env.RESEND_FROM}>`` — one literal display name, one env var, one sender domain (`.env.example` shows `RESEND_FROM=bangkokclubcrawl@gmail.com`) for every product, including New in Bangkok.
- `emails/cancellation.ts`, `emails/confirmed-meetup.ts`, and `emails/reschedule.ts` all still hardcode the "BANGKOK CLUB CRAWL" header/title text unconditionally (Guide's exact complaint about the cancellation email — confirmed still true, not yet touched, per this session's "audit only" instruction). `emails/confirmation.ts` is the one template Stage 9l already made product-driven for body content, but even it doesn't vary sender identity or header branding by storefront — it says "BEST NIGHTLIFE THAILAND" unconditionally now (see Stage 9l above), which is itself only correct for BNT-branded products, not a real fix.
- `resolveStorefront()` (`lib/storefront.ts`, Phase 2) is a real, working host→storefront resolver, but it is **only used in page-rendering code** (`app/layout.tsx`, `app/page.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `app/bnt-preview/**`) — grepped confirmed it is never imported by `webhook/route.ts`, any of the other 5 send routes, or any `emails/*.ts` template. There is currently no signal anywhere in the booking/checkout/email pipeline for "which brand does this transaction belong to" — not on `bookings`, not passed through Stripe metadata, nothing.
- **What Phase 5 needs to build** (not started, no code touched): a per-product or per-storefront brand identity — the natural anchor is the product's own `visible_bcc`/`visible_bnt` flags (or a small new explicit `brand` field, cleaner than inferring from two booleans) — resolved once at webhook time (the webhook already loads the product row) and threaded through to (a) the `from` address (needs a second verified Resend sending domain/identity for BNT, not just a display-name string swap — this session did not touch Resend/DNS per explicit instruction, so that verified-domain step is real infra work still to do), and (b) every email template needing a brand-aware header/title instead of a hardcoded "BANGKOK CLUB CRAWL" string, applied consistently across confirmation, cancellation, reschedule, confirmed-meetup, and resend-confirmation — not just the cancellation email Guide happened to notice.

### Phase 1 (source-of-truth audit) — COMPLETE, with one finding that changed the plan
Verified directly against live git/Vercel/Supabase, not assumed from any doc:
- `bkkclubcrawl.com` production = Vercel project `bcc-claude`, `main` @ `8090708` — Phase 4 + Stage 9 genuinely merged and live. Stage 9's QR crash (open at the last checkpoint) was fixed in a later session — root cause was a double `stop()` on the QR scanner throwing synchronously (`69f5d77`) — and a real Stripe E2E test was recorded and Stage 9 formally closed (`a758dfc`, `f457026`) before the `8090708` merge to `main`.
- `bestnightlifethailand.com` production = Vercel project `nightlife-antigravity`, `main` @ `46cdce1` — a ~3500-line Express app (`server.js`), BNT-only at root, legacy BCC pages already redirecting to `bkkclubcrawl.com`.
- **Two separate Supabase projects exist**, not one: `BCC - Claude` (`oomhftxgvikzxlvqdcmr`, this app's canonical DB) and a distinct `Nightlife` project (`csltowtyzjknulqmgnku`) holding NightlifeAntigravity's own `bookings`(55)/`guests`(69)/`events`(80)/`experience_inquiries`(3) tables — the VIP inquiry and contact forms write there today. **Guide's decision:** new inquiry/contact tables get created fresh in `BCC - Claude`'s Supabase, not wired to the old `Nightlife` project — no continuity to the old rows.
- **The big finding:** two unmerged NightlifeAntigravity branches — `phase4-stageB-events-product-page` and `phase4-stageC-bnt-booking-surface` — already contain a disciplined, mockup-approved implementation of almost exactly this objective (a BNT product page + generic `/book` surface), but via the *other* architecture: NightlifeAntigravity stays its own app and calls this app's canonical `/api/products` / `/api/events` server-to-server, never touching Supabase directly, and deliberately stops right before checkout wiring (its own documented "Stage D"). This was in fact the originally-audited plan (see this doc's own pre-Stage-10 "BNT integration" section below). Neither branch is merged or promoted to production on either project — confirmed via Vercel (`nightlife-antigravity`'s live production deployment is `main` @ `46cdce1`, well behind both branches). **Guide's decision, given directly:** proceed with Stage 10's pivot anyway — shelve Stage B/C, port the BNT surface into this app instead. Stage B/C's HTML/CSS output is still a legitimate visual reference for parity-porting BNT's design system (fuchsia/magenta accent, Cormorant Garamond + Montserrat, the locked product-page template), even though its code won't be reused directly.

### Phase 2 (routing contract) — COMPLETE, implemented
Added to `lib/storefront.ts` (already home to the `VISIBILITY_COLUMN` whitelist from BNT Stage A):
```ts
export function resolveStorefront(host: string | null | undefined): Storefront {
  const normalized = (host ?? '').toLowerCase().split(':')[0]
  return BNT_HOSTS.has(normalized) ? 'bnt' : 'bcc'  // BNT_HOSTS = bestnightlifethailand.com (+www)
}
```
Deliberately **not** wired into `middleware.ts` — its matcher only covers `/dashboard/:path*` and `/api/admin/:path*`, so it never sees public storefront routes; adding storefront resolution there would mean widening the matcher, which risks the existing auth gate. Instead, callers (Server Components / Route Handlers) read `headers().get('host')` directly and pass it in — zero changes to the auth-critical file. Unknown/local/preview hosts default to `'bcc'`, preserving every existing behavior for anything that isn't literally `bestnightlifethailand.com`. This decides branding/content only; product/event visibility stays gated by the existing DB columns, never inferred from host alone. For checkout (Phase 5, not yet built), the plan is: resolve storefront server-side from the request's own Host header, never trust a client-supplied value directly.

**One open judgment call, flagged not decided:** `bkkclubcrawl.com/new-in-bangkok` (the stale hardcoded Wednesday/฿1,000 page, `app/new-in-bangkok/page.tsx`) can't safely redirect to the BNT domain until after cutover (that domain doesn't have the canonical route yet). Left untouched this session — revisit at cutover time, or sooner if Guide wants it 404'd/redirected elsewhere in the meantime.

### Phase 3 (port minimum BNT public surface) — COMPLETE, applied 2026-08-24
Read the live production source directly (`NightlifeAntigravity` `main` @ `46cdce1`) before writing any code — `landing.html`, `about.html`, `contact.html`, `css/luxury-landing.css`, and (crucially) `js/luxury-landing.js` (714 lines — the deck-card renderer, swipe/drag carousel, and the full 4-step inquiry modal's validation/state machine/dynamic-Step-3/submit logic), plus the exact `POST /api/vip-inquiry` and `POST /api/contact` handlers in `server.js`.

**What was ported, and how:**
- **`css/luxury-landing.css` and `js/luxury-landing.js` copied byte-verbatim** into `public/bnt/css/luxury-landing.css` / `public/bnt/js/luxury-landing.js` — confirmed identical via `diff` against the git blob at `origin/main`. The JS's own image-path string literals (`img: "assets/images/..."`, and the CSS's one `url('../assets/images/hero.jpeg')`) were the ONLY edits made to either file — pure path substitutions to `/bnt/images/...` (see assets below), zero logic changes. This means the entire multi-step modal (validation, dynamic Step 3 per occasion, swipe/drag, submit) and the 14-card deck renderer run as the **exact same code** as production, not a re-implementation — directly satisfying the brief's "do not approximate it from the markup alone."
- **Markup ported as direct JSX transcriptions** of the three HTML files: `components/bnt/BntLandingPage.tsx`, `components/bnt/BntAboutPage.tsx`, `components/bnt/BntContactPage.tsx`, plus a shared `components/bnt/BntNav.tsx` (hamburger/drawer — landing/about/contact each duplicated this in the original; unified here, identical behavior) and `components/bnt/BntFooter.tsx`. About/Contact's page-specific inline `<style>` blocks are reproduced verbatim via `dangerouslySetInnerHTML` (see "real bug found" below for why not plain JSX text children). Contact's form is the one place behavior was reimplemented rather than copied verbatim: the original's `getElementById`/`innerHTML`-swap submit handler became React state (`submitted`, `submitting`) — same validation rule, same fetch call/payload, same success copy, same button loading text; not a visual or behavioral change, just an idiomatic port.
- **21 referenced images (22 incl. the JS fallback `hero.jpeg`) extracted byte-for-byte from the `origin/main` git blob** (not the working tree, which was mid-checkout on an unrelated branch) into `public/bnt/images/` and `public/bnt/logo/`, renamed to web-safe kebab-case (originals had spaces/mixed-case/subdirectories like `assets/images/BNT Expansions/hen party.JPG`). Total `public/bnt/` size: **34 MB** — dominated by `bangkok-mob.png` (12 MB) and `vip-table-bookings.jpg` (4.2 MB), both copied unmodified/uncompressed to match production exactly (not a regression — this is production's actual current asset weight, flagged here as a pre-existing perf characteristic worth a future optimization pass, not fixed this session per "reuse existing assets, don't regenerate").
- **Real bug found and fixed, not just ported:** `about.html` references `assets/images/Passion.jpg` / `Hospitality.jpg` / `Reward.jpg`, but those files do **not exist at that path** in the live `main` git tree — they only exist at `assets/images/BNT Expansions/Passion.jpg` etc. (confirmed via `git cat-file -e`). This means **production's live About page has had 3 broken images since whenever those files were last moved** — an existing, unnoticed bug, not a porting artifact. Fixed by pointing at the correct source path when extracting the assets (`public/bnt/images/passion.jpg` now contains the real photo, not a broken link). Not fixed on the live NightlifeAntigravity site itself (out of scope — that app is untouched this session).
- **Real bug found and fixed during verification (not shipped silently):** `<style>{cssString}</style>` (JSX text children) caused a genuine React hydration mismatch on About/Contact — `<style>` is a raw-text HTML element the browser never HTML-entity-decodes, but React's SSR serializer entity-escapes plain JSX text children (`content: '';` became `content: &#x27;&#x27;;` server-side only), so server and client text never matched. Fixed by switching both to `<style dangerouslySetInnerHTML={{ __html: \`...\` }} />`, which bypasses escaping entirely. Verified clean (zero hydration warnings) via the browser console after the fix.
- **Storefront routing:** `app/page.tsx` now reads `headers().get('host')` and renders `<BntLandingPage />` when `resolveStorefront(host) === 'bnt'`, else the existing BCC homepage — completely unchanged markup/logic in that branch. New `app/about/page.tsx` / `app/contact/page.tsx` (bkkclubcrawl.com has never had these routes) render the BNT pages only when `resolveStorefront(host) === 'bnt'`; any other host gets a plain `notFound()` (404), matching this app's existing fail-closed convention rather than exposing BNT content as a de facto BCC page. `middleware.ts` was **not touched** — same Phase 2 rationale (its matcher never sees these routes).
- **BCC's Meta Pixel gated off BNT** — a real correctness fix, not scope creep: the live BNT pages carry no Meta Pixel of their own, but `app/layout.tsx`'s Pixel script was previously unconditional for every route including any future BNT page, which would have misattributed BNT traffic to BCC's ad account. `RootLayout` now reads the host the same way and only renders the Pixel `<Script>`/`<noscript>` block when `resolveStorefront(host) === 'bcc'`. Verified in-browser: `window.fbq` is a function on `/` (BCC), and the equivalent check on a BNT-resolved host would be `undefined` (confirmed by code path, not by an actual BNT-hostname request — see "Preview mechanism" below for why).
- **Preview mechanism, explicitly small and additive, per the brief's own instruction to build the smallest safe thing rather than weaken production host resolution:** `app/bnt-preview/page.tsx`, `app/bnt-preview/about/page.tsx`, `app/bnt-preview/contact/page.tsx` render the exact same BNT components unconditionally, regardless of Host header — the only way to visually exercise BNT markup from this sandbox/local dev, since spoofing the Host header isn't possible from a real browser and editing `/etc/hosts` is a prohibited system-settings change. Does not touch `resolveStorefront()` or weaken the real `/`, `/about`, `/contact` gates in any way. **Explicitly flagged as removable** — worth deleting once `bestnightlifethailand.com` actually points at this app and can be tested for real, or keeping as a permanent internal QA tool; not decided, Guide's call.

**Forms — canonical tables, handlers, and verification:**
- New Supabase tables `bnt_experience_inquiries` and `bnt_contact_messages` in `BCC - Claude` (`oomhftxgvikzxlvqdcmr`), migration `supabase/migrations/20260824000001_stage10_bnt_forms.sql` (mirrored into `supabase-schema.sql`'s appendix). **Deliberately denormalized** (`name`/`whatsapp` stored directly on each row) rather than replicating NightlifeAntigravity's `guests` + `experience_inquiries` dedup-by-phone architecture — this matches **this project's own existing `bookings` table convention** (`guest_name`/`guest_email`/`guest_phone` inline, no separate guests table), a concrete in-repo precedent, not an arbitrary simplification. RLS enabled, no policies — service-role only, same posture as `product_content`/`product_media`/`admin_users`. Zero continuity with the old `Nightlife` Supabase project (`csltowtyzjknulqmgnku`) — its 3 historical inquiries/69 guests were not read, migrated, or modified.
- `app/api/vip-inquiry/route.ts` and `app/api/contact/route.ts` — direct ports of the Express handlers' validation (`lib/whatsapp.ts` → `normalizeWhatsApp()`, algorithm copied verbatim), date-sanitization, and Resend email-alert logic (same `ADMIN_EMAIL` fallback, same HTML email template content, non-blocking on email failure). The only structural change: no `guests` upsert step, since the new tables don't have a guests concept (see above).
- **End-to-end verification, two layers:** (1) Both forms were driven through the real UI in a local `next dev` server — multi-step modal validation (blocks on empty required fields, correctly pre-selects Occasion from the clicked deck card's category), all 4 steps, dynamic Step 3 content per occasion, and the Contact form's real React submit handler — every request reached the correct route with the correct JSON payload (confirmed via network-request inspection), failing only with a Supabase `"supabaseUrl is required"` error, because **this sandbox has no `.env.local`** (confirmed: only `.env.example` present) — the same constraint recorded at every prior stage in this document, not a code defect; the stack trace pinpoints the failure exactly at the `getServiceSupabase().from(...).insert(...)` call, i.e. every line of validation/logic before that point ran correctly. (2) Since a live network round-trip through Supabase wasn't reachable from this sandbox, used this project's own established fallback (see "How to resume" below): inserted a marked test row into each new table via direct SQL, using the exact shape each route produces — both succeeded, `RETURNING` confirmed correct column values/types, then both rows were deleted (`WHERE name LIKE 'STAGE10_VERIFICATION_TEMP%'`) and both tables reconfirmed at 0 rows. **Not independently verified: an actual Resend email send** (no `RESEND_API_KEY` in this sandbox either — same constraint; the code path is a verbatim reuse of the already-proven pattern in `app/api/webhook/route.ts`, so this is a low-risk application of established code, not new logic).

**Regression verification:** `npx tsc --noEmit` and `npm run build` both clean (all existing routes still list, no regressions). In-browser: BCC's `/` renders unchanged (spot-checked full homepage text + Meta Pixel firing), `/weekends` unchanged, `/about` and `/contact` both correctly 404 on a non-BNT host, `/dashboard` fails with the same pre-existing "no `.env.local`" error as every other admin route in this sandbox (middleware.ts untouched, not a regression). Mobile viewport (375×812) spot-checked on the BNT homepage: hero/typography/button all reflow correctly with no overflow, hamburger nav drawer opens correctly. **One tooling limitation hit, not a code defect:** this sandbox's screenshot tool reliably returns a blank black frame for any screenshot taken after the page has scrolled away from the top (reproduced identically with and without the modal open) — DOM/computed-style inspection via JavaScript confirmed the actual rendered content and state were correct throughout (14 deck cards present with correct images, modal opacity/classes/background all correct), so the rest of the page (Signature Events, Pillars, the Private Experiences deck, full modal flow) was verified structurally/programmatically rather than by pixel screenshot. Worth a real look on Guide's own device before this ships to production traffic.

**Files new/changed this stage:** `lib/whatsapp.ts` (new), `app/api/vip-inquiry/route.ts` (new), `app/api/contact/route.ts` (new), `components/bnt/*` (new — `BntLandingPage`, `BntAboutPage`, `BntContactPage`, `BntNav`, `BntFooter`), `app/about/page.tsx` (new), `app/contact/page.tsx` (new), `app/bnt-preview/**` (new, 3 files), `public/bnt/**` (new, 34 MB), `supabase/migrations/20260824000001_stage10_bnt_forms.sql` (new), `app/page.tsx` (modified — host branch + `generateMetadata`), `app/layout.tsx` (modified — Meta Pixel host-gated), `supabase-schema.sql` (modified — Stage 10 appendix).

### Phases 4–9 (canonical `/new-in-bangkok`, storefront-aware checkout/tickets/email, dynamic-pricing safety, Preview verification, domain-cutover plan) — NOT STARTED
Not built this session — explicitly out of scope per this session's brief ("THIS SESSION IS PHASE 3 ONLY"). Next session's starting point: Phase 4 (canonical `/new-in-bangkok` on the BNT domain) once Guide is ready to proceed past this checkpoint.

### STOP GATE status (of this session's requested report items)
1. **What was ported:** BNT homepage, About, Contact — full visual/behavioral parity (CSS/JS copied verbatim, only image paths rewritten); Private Experiences inquiry modal (all 4 steps, validation, dynamic Step 3, deck carousel) and Contact form, both fully interactive and wired to new API routes. 2. **Visual/behavioral differences from live BNT site:** none intentional; the 3 broken About-page images are now fixed (a bug fix, not a difference from *intended* design); Contact form's submit handling was reimplemented in React state rather than DOM `innerHTML` swap (same visible behavior). 3. **New DB tables/schema:** `bnt_experience_inquiries`, `bnt_contact_messages` in `BCC - Claude` Supabase — see above for full shape/rationale; both verified via direct-SQL test insert+cleanup, 0 rows in production now. 4. **Could not be verified:** a live HTTP round-trip through Supabase from this sandbox (no `.env.local`) and an actual Resend email send (no `RESEND_API_KEY`) — both are sandbox/environment constraints identical to every prior stage in this doc, not code-level uncertainty; full-page scrolled screenshots (tooling limitation, verified structurally instead — see above). 5. **DB changes:** zero unintended — `new-in-bkk` reconfirmed `status='draft'`/`visible_bcc=false`/`visible_bnt=false` after all testing; both new tables confirmed empty (0 rows) after test-row cleanup; no other table touched. 6. **GO/NO-GO for Phase 4:** **GO** — Phase 3's scope (BNT homepage/About/Contact + both forms) is complete, verified to the extent this sandbox allows, and typecheck/build are clean; the one open item before Guide relies on this in front of real customers is a real-device visual pass (this session's screenshot tooling limitation, not a known defect) and a live Supabase env to exercise the actual insert+email path once, either via Guide's own local `.env.local` or a Vercel Preview deployment with a share-bypass link.

## ⏸ Stage 9 SESSION PAUSED (STALE — superseded by Stage 10 section above; kept for history) — read this section first

**Branch:** `claude/phase4c-content-media-audit-dvu5c1`
**HEAD:** `564e992` ("Stage 9l: record final live verification of the getAppUrl() fix") — this checkpoint edit and an Alex-attendance-status DB reset are the only things after it; both are non-code.
**Working tree:** clean (only the usual harmless `tsconfig.tsbuildinfo` drift, never committed by convention in this repo).
**Deployment used for the last round of testing:**
`https://bcc-claude-44w91864y-bestnightlifethailand-projects.vercel.app`
(built from `bd3e3fa`, one commit behind current HEAD — HEAD's own commit was doc-only, so this is still the right deployment to resume against; confirm it's still the latest before reusing, since every push creates a new one).

### THE ONE UNRESOLVED LAUNCH BLOCKER
**Guide physically scanned Alex Chen's real QR on her iPhone and Safari still
showed "Application error: a client-side exception has occurred" — AFTER
the `lib/appUrl.ts` hostname fix below was deployed and independently
verified from this session's sandbox.** Do not assume the hostname fix
solved this. It fixed a REAL, confirmed architectural bug (see below), but
Guide's own physical-device retest after that fix was still failing. The
exact cause of what she sees on her physical device remains unknown and
UNVERIFIED beyond what's documented below — the next session must
diagnose it as a fresh, still-open problem, not as a "double-check" of an
already-solved fix.

### What WAS diagnosed and fixed this session (don't repeat this investigation)
1. **Decoded the actual deployed QR image byte-for-byte** (`jsQR` + `pngjs`
   against the real PNG bytes fetched from `/api/tickets/[token]/qr` via a
   Vercel share-bypass link) — confirmed the QR payload itself, the
   hostname it encodes, and Vercel share-token behavior were never the
   problem. The QR correctly encoded a `/dashboard/checkin/[token]` URL.
2. **Root cause found:** every URL-building call site
   (`app/ticket/[token]/page.tsx`, `app/api/tickets/[token]/qr/route.ts`,
   `emails/confirmation.ts`) hardcoded
   `process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'`. Since
   `bkkclubcrawl.com` (production, `main`) does NOT have this Stage 9 code
   (never merged), every Preview deployment's QR pointed at a route that
   doesn't exist on production — a 404 there at best. Reproducing that
   exact URL fresh from this session's Browser tool gave a clean Next.js
   404, not a matching client-side exception — the sandbox could not
   reproduce Guide's exact crash text even at that stage.
3. **First fix attempt (INSUFFICIENT — verified insufficient, not assumed
   sufficient):** added `lib/appUrl.ts` → `getAppUrl()` with priority
   (1) `NEXT_PUBLIC_APP_URL` if set, (2) `VERCEL_ENV==='production'` →
   `bkkclubcrawl.com`, (3) `VERCEL_ENV==='preview'` → `VERCEL_URL` (the
   deployment's own host), (4) fallback. Deployed, then re-decoded the live
   QR — it was UNCHANGED, still `bkkclubcrawl.com`. Added a temporary
   diagnostic route (`GET /api/debug-env`, committed, deployed, queried,
   then deleted — confirm it is NOT present if resuming) which proved
   `NEXT_PUBLIC_APP_URL=https://bkkclubcrawl.com` is explicitly configured
   for **All Environments** in this Vercel project, not Production-only —
   so priority (1) always won and priority (3) never ran.
4. **Second fix (deployed, sandbox-verified, but NOT what fixed Guide's
   phone):** reordered `getAppUrl()` so `VERCEL_ENV==='preview'` is checked
   FIRST and unconditionally uses `VERCEL_URL`, ignoring the env var
   override entirely. Re-decoded the live QR a third time — it now
   correctly showed the Preview deployment's own host. Navigated there
   directly (unauthenticated, via the Browser tool) — got a clean
   `/login?redirect=/dashboard/checkin/[token]` page, no exception.
   Confirmed Alex's own `/ticket/[token]` page renders completely correctly
   (screenshot taken: QR centered, real meeting point, reference, guest
   name, Add to Calendar all present and correct).
5. **Despite all of the above being independently verified true from this
   session's sandbox, Guide's physical iPhone scan STILL crashed** after
   this fix was live. Hypotheses NOT yet tested, for the next session to
   actually investigate rather than re-derive: a stale Safari tab/bfcache
   from an earlier (pre-fix) deployment's URL; a Safari-specific chunk-load
   or hydration failure on that specific device; some interaction between
   Vercel's SSO wall and a real (non-share-link) camera-scan navigation
   that this session's Browser-tool testing (which always used an explicit
   `_vercel_share` bypass link) never actually exercised — a real camera
   scan hits the bare QR URL with NO share param, which is a meaningfully
   different request than everything tested this session. **This last
   point is the most likely untested gap: every verification this session
   used a manually-appended `_vercel_share` token; a genuine phone-camera
   scan of the QR does not carry one, and Vercel's SSO wall's own behavior
   on a bare, un-bypassed Preview URL (as opposed to a bypassed one, or
   production's exempt custom domain) was never actually observed this
   session.**

### Explicit decision this session: remove inline QR from the confirmation email
Guide decided the confirmation email should NOT keep the inline embedded
QR image (`emails/confirmation.ts`'s `ticketCtaHtml` currently still embeds
one via `<img src="${appUrl}/api/tickets/${ticket.token}/qr">`). **This
has NOT been implemented yet** — the email still embeds the QR as of HEAD.
The "View Ticket & QR" button/CTA to `/ticket/[token]` is the decided
canonical, durable path and must remain exactly as-is. Next session's task
2 is to remove the `<img>` QR from the email template (keep the CTA,
keep the booking reference, keep everything else in the product-driven
structure from Stage 9l) — a small, contained edit to
`emails/confirmation.ts`'s `ticketCtaHtml` template string.

### Standing invariants — verify, don't just trust this doc
- `bookings` where `ticket_token='preview-test-alexchen-b7d2f4a19c3e0561'`
  (Alex Chen) — **reset to `attendance_status='expected'` as of this
  update** (it had drifted to `checked_in` twice already from Guide's own
  testing of the direct-resolve fallback link and/or partial API success
  before a crash — check it again at the start of the next session, don't
  assume it's still `expected`).
- `bookings` where `ticket_token='preview-test-9c8f2a1b4e6d3c5f7a9b1d2e4f6c8a0b'`
  (Jamie Rivera) — `attendance_status='checked_in'` (from her earlier
  successful real scan test; no action needed, not a blocker).
- `products` where `slug='new-in-bkk'` — `status='draft'`,
  `visible_bcc=false`, `visible_bnt=false`. Do not publish. Verify this at
  the start of the next session too.
- **No Stripe test has been run.** No real transaction, no live checkout
  exercised this entire Stage 9 sequence.
- **Not merged to `main`.** All Stage 9 work lives only on
  `claude/phase4c-content-media-audit-dvu5c1`.

### Known non-blocking follow-up (do not fix unless asked)
Host Operations (`/dashboard/host`, `GET /api/admin/host/events`) is
functional and its actionable-only filter (Stage 9l) IS live and DOES
correctly drop most closed/zero-booking dates — verified against real
production data. Guide's own screenshot review after that fix still showed
it as imperfect ("still shows unnecessary zero-booking/closed events" —
the exact remaining cases weren't isolated this session). This is
EXPLICITLY DEFERRED as non-blocking for Stage 9 closure — do not touch it
in the next session unless Guide asks.

## Stage 9 — New in Bangkok booking lifecycle (separate track from BNT integration below)
Goal: make New in Bangkok commercially bookable end-to-end —
`Product → Event Date → Stripe → Booking → confirmation/ticket → QR →
Event Operations → host scan → checked-in` — reusing the existing Product/
`eventId` checkout/webhook architecture unchanged, as the first product on a
booking/check-in foundation any future SNX product (BCC, Builders Club,
private events) can reuse. Approved scope, decided 2026-08-23:
- **MVP QR semantics:** one Booking = one `ticket_token` = one QR,
  representing the whole booking including its `quantity`. No per-guest/
  per-seat table. A group booking of 3 shows "3 guests" to the host on one
  scan, not 3 separate tickets. Documented on the `ticket_token` column
  itself so this isn't rediscovered as an oversight later.
- **Capacity enforcement is explicitly OUT of scope** for this launch —
  product decision, not a technical gap (see "Not done yet" below).
- **Security scope is narrow by design:** Stage 9e secures only
  `update-attendance` + the new check-in resolver route (the two this
  lifecycle depends on), not all 6 known-unauthenticated legacy ops routes.
- New in Bangkok stays Draft (`status='draft'`, both `visible_*=false`)
  through the entire Stage 9 sequence — publish only after a real paid
  transaction has been verified through the full chain.
- Reuses the existing Vercel project, Stripe account/config, and Supabase
  project throughout — no parallel infrastructure.

**Stage 9a — Booking canonical identity + ticket token — APPLIED
2026-08-23.** Migration `supabase/migrations/20260823000001_stage9a_booking_identity.sql`
(mirrored into `supabase-schema.sql`'s Phase 4 appendix): `bookings` gains
`event_id` (nullable FK → `event_dates`, `ON DELETE SET NULL`),
`product_id` (nullable FK → `products`, `ON DELETE SET NULL`), and
`ticket_token` (nullable, unique `TEXT`, generated server-side by the
webhook — not a DB default). All three additive/nullable; zero backfill
performed or required. Verified directly against production
(`oomhftxgvikzxlvqdcmr`) post-apply: correct column types/nullability, both
FKs confirm `ON DELETE SET NULL`, both indexes exist, and all 7 pre-existing
bookings are unchanged with the three new columns `NULL` — no destructive
change.

**Stage 9b — Webhook persists canonical identity + ticket token — APPLIED
2026-08-23.** `app/api/webhook/route.ts` now writes `event_id`/`product_id`
(read from Stripe session metadata — already set by the dynamic checkout
path since Stage 6; `null` for any booking that came through the legacy
hardcoded-Price path, which never sets those metadata keys) and a fresh
`ticket_token` (via new `lib/tickets.ts` → `generateTicketToken()`, 24
random bytes/192 bits, base64url, generated unconditionally for every paid
booking regardless of checkout path) on every new booking insert. No
retry-on-collision logic — entropy makes a collision practically impossible,
and a collision would surface as an explicit Postgres `23505` error rather
than fail silently. Verified without a live Stripe webhook call (this
session's network policy still blocks `next dev` from reaching the real
Supabase project, and Vercel Preview carries SSO protection — same
constraint recorded in Stage 8d): `npx tsc --noEmit` and `npm run build`
both clean, no route regressions; then replicated the exact insert shape
directly against production via a marked, unmistakable test booking
(`notes LIKE 'STAGE9B_VERIFICATION_TEMP%'`) referencing `new-in-bkk`'s real
`event_id`/`product_id` — insert succeeded with both FKs satisfied, a
second insert reusing the same `ticket_token` correctly failed with
`23505 duplicate key value violates unique constraint
"uniq_bookings_ticket_token"`, then the test row was deleted and booking
count confirmed back to baseline (7) with `new-in-bkk` still
`status='draft'`, both `visible_*=false`.

**Stage 9c — Real confirmation/ticket page — APPLIED 2026-08-23.** New
`app/ticket/[token]/page.tsx`: a server component resolved ONLY by the
opaque `ticket_token` (uniform 404 for unknown/malformed tokens, same
fail-closed convention as `/events/[slug]`), rendering product/event name,
date/start time, guest name, quantity, a display-only booking reference
(`lib/bookingReference.ts` — derived from product slug + booking id, never
stored, never used for lookup), the meeting point (via new
`lib/meetingPointReveal.ts`'s `revealMeetingPointForTicket` — deliberately
DIFFERENT from the pre-purchase gate in `app/api/products/[slug]/route.ts`:
both `public` AND `after_booking` now reveal full location, since resolving
this page at all already required the token; `private`/unset/invalid still
reveal nothing in any context), a server-generated QR (`lib/qrTicket.ts` +
new `qrcode` npm dependency — fully local, no third-party QR API, so the
check-in URL/token never leaves our infra) encoding
`{appUrl}/dashboard/checkin/{ticket_token}` (under `/dashboard` so the
existing `middleware.ts` auth gate protects the check-in resolver for free,
once Stage 9d builds it — nothing to change there), and "Add to Calendar"
via `lib/calendarLinks.ts` (a Google Calendar render link — just a URL, no
API key — plus a downloadable `.ics` for Apple/Outlook; Bangkok's fixed
UTC+7 offset, no DST, is hardcoded rather than pulling in a timezone
library). A `status='cancelled'/'refunded'` booking renders a distinct
"no longer valid" state instead of a live QR. New `GET
/api/bookings/by-session?session_id=` (public, looked up by Stripe's own
unpredictable session id — same trust model the page already used
pre-Stage-9) lets `/booking-success` poll for the webhook-written
`ticket_token` (up to ~8 tries / ~12s) and reveal a "View your ticket" link
once ready — the existing static thank-you content is UNCHANGED as a
fallback if the poll times out. QR payload contains only the app origin +
opaque token — never PII, the booking UUID, or the Stripe session id, per
the Stage 9 audit's explicit requirement.

Verified: `npx tsc --noEmit` and `npm run build` both clean, `/ticket/[token]`
and `/api/bookings/by-session` both list as new dynamic routes with no
regressions elsewhere. Could not exercise the live page directly (no
`.env.local` in this session — same `next dev`-can't-reach-Supabase
constraint recorded since Stage 8d), so instead: (1) confirmed
`new-in-bkk`'s real `product_content.meeting_point` already has
`visibility='public'` with genuine content (Guide entered it — "Don't Open
the Fridge", real address) matching the target UX exactly; (2) ran the
actual `qrcode` library and every new pure function (reference formatting,
date/time formatting, meeting-point reveal, Bangkok→UTC calendar math)
standalone in Node against that real data plus a marked, temporary test
booking inserted directly (`notes LIKE 'STAGE9C_VERIFICATION_TEMP%'`,
deleted after) — confirmed a real QR PNG data URI is produced, the booking
reference formats as `NEW-5A6CCF`, the date resolves to "Tuesday, September
1, 2026" (matches the product's actual Tuesday schedule), and the Google
Calendar link correctly converts 20:30 Bangkok → 13:30 UTC. Booking count
and `new-in-bkk` state reconfirmed unchanged after cleanup.

**Stage 9d — QR check-in resolver + smallest reusable Event Operations
slice — APPLIED 2026-08-23.** This is deliberately built as the FIRST
reusable foundation of a future consolidated SNX Event Operations layer, not
a New-in-Bangkok- or BCC-specific check-in system — both the ticket page
(9c) and this stage now resolve a booking through the same shared
`lib/bookingResolution.ts` (extracted from 9c's inline queries during this
stage), so the underlying `Product → Event Instance → Booking → Attendance`
contract is one function any future UI can call, not duplicated per
consumer.

New `GET/POST /api/admin/checkin/[token]` — admin-authed (`requireAdmin()`,
also covered automatically by `middleware.ts`'s existing
`/api/admin/:path*` matcher, no middleware change needed), resolves a ticket
token to a booking/event/product summary. `POST` performs the check-in:
blocks with 409 if the booking is `cancelled`/`refunded`; if already
`attendance_status='checked_in'`, returns `alreadyCheckedIn: true` WITHOUT
re-running the update (idempotent repeat-scan handling, not a silent
fresh-scan no-op); otherwise flips `attendance_status` to `'checked_in'` —
the exact existing column/enum the manual dropdown in `/dashboard` already
used, no new attendance state introduced.

New `app/dashboard/checkin/page.tsx` (manual ticket-code entry — accepts a
bare token or a pasted `/checkin/<token>` URL) and
`app/dashboard/checkin/[token]/page.tsx` (the check-in confirmation screen:
shows product/event, guest name, quantity, booking reference, payment
status, and a "Check in N guests" button, or an "Already checked in" state).
**No custom camera/QR-scanning code was written** — the QR itself already
encodes the full `/dashboard/checkin/{token}` URL (Stage 9c), so scanning it
with any phone's native camera app opens this exact page directly, already
behind the existing dashboard auth gate. The manual-entry page is purely the
fallback for no-camera / bad-lighting situations. A "Scan Ticket" link was
added to the existing per-event dashboard panel
(`app/dashboard/page.tsx`, next to "GUEST ATTENDANCE") — the existing
manual attendance dropdown there is completely unchanged and remains the
fallback if scanning fails, exactly as required.

**Explicit constraint, reported rather than worked around, per instruction:**
a Booking with `quantity > 1` checks in as one all-or-nothing unit — there
is no way to check in "2 of 3 guests" with the current schema, because
`bookings.attendance_status` is one value per booking row, not per guest.
Building partial/per-guest check-in would need a materially larger
data-model change (a new per-guest/per-seat table), which was explicitly
out of scope this session — not built, not simulated with a workaround. The
UI surfaces `quantity` as informational context only ("Check in 3 guests" as
a single confirm), never as a counter.

Verified: `npx tsc --noEmit` and `npm run build` both clean; all three new
routes (`/api/admin/checkin/[token]`, `/dashboard/checkin`,
`/dashboard/checkin/[token]`) list with no regressions elsewhere. Functional
logic verified via direct SQL against production with two more marked,
temporary bookings (`notes LIKE 'STAGE9D_VERIFICATION_TEMP%'`, both deleted
after): (1) a confirmed booking's guarded update
(`attendance_status <> 'checked_in'`) correctly flips it to `checked_in`
once, and a second run of the identical guarded update against the
now-already-`checked_in` row correctly affects 0 rows — proving the
repeat-scan branch the route takes (return `alreadyCheckedIn` without
re-running the write) lines up with what the database itself would allow;
(2) a `status='cancelled'` booking was confirmed to reach the route's
pre-write 409 gate before any update is attempted. Booking count and
`new-in-bkk` state reconfirmed unchanged (still 7 bookings, `new-in-bkk`
still `status='draft'`, both `visible_*=false`) after cleanup.

**Stage 9e — Secure the routes this lifecycle depends on — APPLIED
2026-08-23.** Deliberately narrow, per explicit instruction: only
`app/api/update-attendance/route.ts` was touched — not a refactor of all 6
originally-audited unauthenticated legacy ops routes. Added a
`requireAdmin()` gate (same helper every `/api/admin/*` route already uses)
at the top of the handler. This route had NO auth check at all before —
not under `/api/admin`, so `middleware.ts`'s `/api/admin/:path*` matcher
never covered it either — meaning anyone who found the endpoint could flip
any booking's attendance status. It's now in scope specifically because
Stage 9d's check-in UI keeps this route's manual dropdown as its
scan-failure fallback, making it part of the check-in lifecycle for the
first time. `requireAdmin()` reads the Supabase Auth session directly
(`lib/admin-auth.ts` → `createServerSupabase()`), independent of
`middleware.ts`'s path matching, so this fix needed no route move and no
middleware change. The new `/api/admin/checkin/[token]` (Stage 9d) was
already admin-authed from creation — nothing to fix there. The other 5
known-unauthenticated routes are untouched by design — see "Security
hardening" below.

Verified: `npx tsc --noEmit` and `npm run build` both clean, no
regressions. Not independently re-verified with a live authenticated
session in this sandbox (no `.env.local`, same constraint as every other
Stage 9 verification) — `requireAdmin()` itself is unmodified,
already-proven code reused verbatim from every existing `/api/admin/*`
route, so this is a low-risk application of an established pattern rather
than new logic needing fresh verification. A logged-in host's browser
already carries the Supabase Auth session cookie when the dashboard's
existing attendance dropdown calls this route, so this should be
transparent to legitimate use and only block unauthenticated requests —
worth a quick manual click-test in the real dashboard before New in
Bangkok's paid end-to-end transaction test.

**Stage 9 (9a–9e) is now feature-complete for the audited scope.** What
remains before New in Bangkok can launch: a real paid Stripe transaction
exercising the full chain (Product → Event Date → `/book` → Stripe →
webhook → Booking → `/booking-success` → `/ticket/[token]` → QR →
`/dashboard/checkin/[token]` → checked-in), per the launch policy above —
not yet run. `new-in-bkk` remains `status='draft'`,
`visible_bcc=false`, `visible_bnt=false` throughout; do not activate/publish
until that test passes.

**Stage 9f — Mobile visual QA fixes (post-9e, pre-Stripe-test) — APPLIED
2026-08-23.** Guide visually reviewed the deployed Stage 9 pages on her
phone via temporary Vercel-share-bypass links and found two real issues,
both fixed:

1. **Ticket QR not horizontally centered** (`app/ticket/[token]/page.tsx`).
   Root cause: Tailwind's Preflight (`@tailwind base`, active project-wide —
   confirmed via `tailwind.config.js`, no `corePlugins.preflight: false`)
   sets `img { display: block }`, which silently defeats the
   `text-align: center` the QR's parent card relied on — a block element
   with a fixed width and no auto margins sits flush-left regardless of its
   container's `text-align`. Fixed by adding `display: 'block', margin: '0
   auto'` directly to the QR `<img>`'s inline style. Nothing else on the
   ticket page was touched.

2. **`/dashboard/checkin` was a manual-lookup page, not a scanner** — the
   original Stage 9d build assumed a host would scan with their phone's
   native camera app (since the QR already encodes the full
   `/dashboard/checkin/{token}` URL) and only use in-app manual entry as a
   fallback. Guide's review made clear the intended PRIMARY workflow is an
   in-app live camera scanner — "SNX/BCC Operations → Scan Ticket → phone
   camera → auto-resolve", not a code-paste field. Rebuilt
   `app/dashboard/checkin/page.tsx` as a live camera scanner using the
   `html5-qrcode` npm package (dependency-free — `npm install` added
   exactly one package — actively used for camera permission + live QR
   decoding; chosen over hand-rolling `getUserMedia`/canvas decoding or the
   native `BarcodeDetector` API, which iOS Safari — the target device —
   does not reliably support). Uses the library's lower-level `Html5Qrcode`
   class (not its bundled `Html5QrcodeScanner` UI widget) so the viewport is
   styled to match the existing dark BEST Nightlife palette rather than the
   library's generic chrome. Dynamically `import()`ed inside `useEffect`
   (never at module top level) so nothing camera-related runs during server
   rendering; confirmed via a production build that the ~82 KB library
   lands in its own lazily-loaded chunk, not inlined into any other route's
   bundle. On a successful decode: extracts the token, calls `stop()` on
   the camera, then navigates to the EXISTING
   `/dashboard/checkin/[token]` resolver — **no new booking-resolution
   logic was added**; the scanner is purely a token-acquisition front end
   for the same `GET/POST /api/admin/checkin/[token]` + `resolveBookingByToken`
   built in Stage 9d. A `scannedRef` guard prevents multiple rapid frame
   decodes of the same code from firing more than one navigation. Camera
   permission denial or an unavailable camera falls back gracefully to an
   always-visible "Enter code manually" toggle (never a dead end). The
   token-resolved screen (`app/dashboard/checkin/[token]/page.tsx`) gained
   a prominent "Scan Next Ticket" button (matching the primary gradient
   button style) shown whenever the ticket is in a terminal state —
   just checked in, already used, or cancelled/refunded — so the operator's
   next action at the door doesn't require finding the small back-link;
   that link is kept too for anyone who wants it from a non-terminal state.
   The existing per-event dashboard's "Scan Ticket" link
   (`app/dashboard/page.tsx`) needed no change — it already pointed at
   `/dashboard/checkin`, which is now the scanner.

   **Explicit workflow distinction, recorded per instruction:** there are
   now two separate check-in-adjacent surfaces, intentionally not merged —
   (a) **the launch check-in workflow** is the direct scanner
   (`/dashboard/checkin` → camera → `/dashboard/checkin/[token]`), fully
   product/date-agnostic, requiring no calendar selection, and (b) **Event
   Operations** (`/dashboard` → calendar → select a date → the existing
   per-event slide-over panel) remains the existing admin workflow for
   everything else about running a night (host assignment, verdicts, venue
   route, host pay, and the pre-existing manual attendance dropdown, which
   is UNCHANGED and still available as the check-in fallback if scanning
   fails for a given guest). The scanner is deliberately NOT coupled to (b)
   — it doesn't require or accept an event/date param — specifically so it
   can become the future consolidated SNX Mobile Operations layer's global
   "Scan" action without rearchitecting; when that broader nav/dashboard
   redesign happens, only where the scanner is LINKED FROM should change,
   not the scanner or the check-in API contract itself.

   **Recorded as follow-up, deliberately NOT fixed this stage** (explicit
   instruction: no broader redesign, only an "extremely small/safe" CSS fix
   would have qualified, and none was identified as safe to attempt without
   live device access to verify): the existing calendar
   (`app/dashboard/page.tsx`'s date grid) is not comfortable in portrait on
   a phone and effectively needs landscape to navigate, and the per-event
   slide-over panel (the same file's `EventPanel` component, fixed
   `width:'420px'`) has horizontal overflow / clipped headings and content
   on narrow viewports. Both are pre-existing (not introduced by Stage 9)
   and are exactly the kind of thing the future consolidated SNX Mobile
   Operations redesign should address — not worth a risky blind CSS patch
   here with no way to verify it on a real device from this session.

   Verified: `npx tsc --noEmit` and `npm run build` both clean;
   `html5-qrcode`'s installed type definitions
   (`node_modules/html5-qrcode/html5-qrcode.d.ts`) were read directly to
   confirm the `Html5Qrcode` constructor/`start()`/`stop()` signatures
   before writing any code against them, rather than guessing the API;
   confirmed via the build's chunk output that the library is lazily
   code-split (`903.<hash>.js`, ~82 KB) and does not appear in
   `/dashboard/checkin`'s own ~4 KB page bundle. Could not exercise real
   camera permission prompts or a physical scan from this sandbox (no
   camera-equipped browser available here); Guide verified that part
   directly on her iPhone via the preview links — **confirmed working**:
   the Stage 9 preview booking (`ticket_token=
   'preview-test-9c8f2a1b4e6d3c5f7a9b1d2e4f6c8a0b'`, guest "Jamie Rivera",
   2 guests) went from `attendance_status='expected'` to `'checked_in'` via
   a real scan on her device during this review, confirmed by direct query
   afterward. `new-in-bkk` reconfirmed still `status='draft'`, both
   `visible_*=false` after all of the above.

**Stage 9g/9h/9i/9j — Post-mobile-QA launch-readiness pass — APPLIED
2026-08-23.** Four scoped fixes/additions from Guide's first real-device
review (Stage 9f), all still pre-Stripe-test:

**9g — Confirmation email now includes the ticket.** The Stripe webhook's
existing insert already changed shape once already (Stage 9b — `.select
('id')` added so the DB-generated id is known, since `formatBookingReference`
needs it); `emails/confirmation.ts` gained an optional `ticket?: {token,
reference} | null` param rendering a new "YOUR TICKET" section (QR + booking
reference + "View Your Ticket →" CTA to `/ticket/[token]`) — omitted
entirely, rendering the email byte-identical to before Stage 9, whenever
`ticket` is null. The webhook only ever passes a non-null `ticket` when the
booking INSERT actually succeeded (`!dbError && bookingId` — an insert
failure must never reference a `ticket_token` that was never persisted);
this is the general condition for "canonical token data is unavailable",
not narrowly "pre-Stage-9 bookings" as originally framed. **The QR is
embedded as a remote image (`<img src="{appUrl}/api/tickets/{token}/qr">`),
NOT a base64 data URI** — Gmail (web and app) strips/ignores `data:` image
URIs entirely, which would render as broken for a large share of
recipients; new `app/api/tickets/[token]/qr/route.ts` (public,
unauthenticated — same trust model as `/ticket/[token]` itself: the opaque
token IS the credential) serves a real PNG generated locally via `qrcode`'s
`toBuffer()` (new `generateTicketQrPngBuffer` in `lib/qrTicket.ts`) — no
third-party QR API, so the token never leaves our own infra. Verified: the
PNG buffer was generated and its magic bytes checked directly in Node; the
email template was rendered standalone with and without a `ticket` param
and its output string checked for the new section/QR src/CTA/reference
(present) vs. absence (legacy path unchanged) — all before touching the
live webhook.

**9h — Mobile calendar/Event Operations overflow fixes (the smallest safe
CSS ones, not the redesign).** Root-caused both reported overflows in
`app/dashboard/page.tsx` rather than guessing:
  - The `EventPanel` was `position:fixed; right:0; width:420px` — on any
    viewport under 420px wide, `right:0` anchors the panel's right edge to
    the viewport, so the panel's LEFT edge extends off-screen rather than
    being clipped, which is what actually forced page-level horizontal
    scroll (not the content inside it). Changed to `w-full sm:max-w-[420px]`
    (Tailwind, since Preflight/Tailwind is already active project-wide) —
    full-width overlay on mobile, pixel-identical 420px panel from the `sm`
    breakpoint up.
  - The calendar wrapper's `maxWidth: selectedEvent ? 'calc(100% - 440px)'
    : '900px'` goes NEGATIVE on any viewport under ~440px (reserving room
    for the panel beside it) — invalid CSS, the mechanism behind "needs
    landscape to navigate". Floored with CSS `max(280px, calc(100% -
    440px))`; on desktop `calc(...)` is already comfortably above 280px, so
    this is a no-op there — verified by the math, not just described.
  - The nav bar (`BCC DASHBOARD` eyebrow / Calendar·Bookings·Products tabs /
    month prev·label·next) was one unwrapped `display:flex;
    justify-content:space-between` row with no `flex-wrap`, guaranteed to
    overflow a phone width once its three groups' combined content exceeds
    it. Converted to Tailwind responsive classes (`flex-col` stacking into
    3 rows below `sm`, the original single-row `sm:flex-row
    sm:justify-between` unchanged above it) — this REQUIRED moving those
    layout properties (display/direction/align/justify/gap/height) out of
    the `S.nav` inline style object into the className, since an inline
    style always overrides a class for the same CSS property and would
    have silently defeated every `sm:` override; the now-unused `S.nav`
    entry was deleted rather than left as dead code.
  Verified: `npm run build`, then grepped the compiled CSS output for the
  new `sm:` utility classes to confirm Tailwind's JIT actually generated
  them (a typo or an un-scanned path would silently produce no CSS at all,
  not an error) — confirmed present. Not verified on a real phone from this
  sandbox; worth a quick look on Guide's iPhone alongside the other links.

**9i — Fixed a real check-in-screen bug + made both states unmistakable.**
`app/dashboard/checkin/[token]/page.tsx` was using the POST response's
`alreadyCheckedIn` flag (meaning "was THIS call a repeat scan") to decide
whether to show the active green "Check in" button — which is FALSE
immediately after a fresh, successful check-in (correctly: it wasn't
"already" checked in, it just became checked in), so the button would
incorrectly reappear right after checking someone in. Rewired to key off
`data.booking.attendanceStatus === 'checked_in'` instead, which is
authoritative and correct in both the fresh-confirm and repeat-scan cases —
the green button, the "Checked In"/"Already Checked In" banner, and "Scan
Next Ticket" are now mutually exclusive by construction, not by coincidence
of prop timing. Both banner states were also enlarged into an unmistakable
full-width block (icon + 18px bold headline + subtext) instead of the
previous small pill, matching "visually unmistakable" — green ✓ "Checked
In" for a fresh confirm, amber ⚠ "Already Checked In" for a repeat scan.
"Scan Next Ticket" always gets its own `marginTop` beneath whichever
state precedes it.

**9j — Host RBAC foundation, with an explicit reported gap.** Reused
`admin_users.role` (`'owner'|'admin'|'staff'` — already existed, unused by
any route until now) rather than adding new schema; `'staff'` = Host in this
task's language. Added `requireRole(allowed: AdminRole[])` to
`lib/admin-auth.ts` (wraps `requireAdmin()`, 403s if the role isn't
allowed) and gated the 13 existing owner-only mutation routes under
`/api/admin/products/*`, `/api/admin/media/[id]`, `/api/admin/events/[id]`,
`/api/admin/schedules/[id]/extend`, `/api/admin/schedule/preview` to
`requireRole(['owner','admin'])` — product/storefront configuration and
destructive event/date controls are now genuinely inaccessible to a
'staff' admin_user via their real enforcement point (these routes never go
through the anon-key client, so this protection is real, not cosmetic).

New, real, server-side-redacted Host surface — reuses the canonical
`event_dates`/`bookings`/`ota_bookings`/`expenses` tables, no duplicate
data model: `GET /api/admin/host/events` (assigned events for 'staff',
matched by `admin_users.display_name === event_dates.host_assigned` — a
case-sensitive string match, not a FK; **documented limitation**, not a
silent one, on `AdminUser.displayName` in `lib/admin-auth.ts` — or ALL
upcoming events for owner/admin, which doubles as the QA path below), `GET
/api/admin/host/events/[id]` (operational brief, guest list + headcount,
expenses — `host_fee_final`/`host_payment_status`/`total_paid`/
`price_per_person` are never selected by this route's query at all, so
they're structurally absent from the response, not merely hidden by the
UI; 403s a 'staff' request for an event whose `host_assigned` doesn't match
their `display_name`), `POST /api/admin/host/events/[id]/expenses` (logs an
expense; `event_date`/`night_slug` are derived server-side from the
resolved event row, never trusted from the client). New pages
`app/dashboard/host/page.tsx` + `app/dashboard/host/[id]/page.tsx` consume
only these routes. Guest attendance updates and Scan Ticket reuse the
EXISTING `/api/update-attendance` and `/dashboard/checkin` unchanged (both
already work for any admin_users role).

Added `x-pathname` request-header forwarding in `middleware.ts` (App
Router layouts have no other way to read the current path) so
`app/dashboard/layout.tsx` can redirect a 'staff' role away from
`/dashboard` and `/dashboard/products/*` to `/dashboard/host` — explicitly
documented in that file's own comment as **defense-in-depth / correct
landing UX, NOT the real security boundary** (see the gap below).

**The reported gap (per explicit instruction: stop and report rather than
build a workaround/false sense of security):** `event_dates`, `bookings`,
`ota_bookings`, and `expenses` all currently carry a `USING (true)` public
SELECT RLS policy (see `supabase-schema.sql`) — readable by ANYONE holding
the anon key (which is `NEXT_PUBLIC_SUPABASE_ANON_KEY`, bundled into every
page's client-side JS; not a secret), regardless of `admin_users`
membership or role, via a direct Supabase query that never touches any
route this session built or could gate. The EXISTING owner dashboard
(`app/dashboard/page.tsx`) already reads exactly these tables this way (the
pre-existing "anon-key dashboard" debt, tracked since earlier stages) — so
redacting host-payment/revenue fields from the NEW `/api/admin/host/*`
responses, and redirecting a staff role away from the OLD dashboard page,
are both real and worthwhile, but neither one — nor anything achievable
within "smallest reusable foundation" scope — can make `host_fee_final`,
`total_paid`, or `expenses.amount` genuinely inaccessible to a determined
staff user (or literally anyone) with a browser console and the anon key.
**Fixing that requires tightening those 4 tables' RLS policies to be
role/assignment-aware (e.g., via `auth.uid()` joined through `admin_users`)
while proving the owner dashboard's own direct anon-key reads still work
under the new policies — a materially larger schema/RLS redesign**,
explicitly out of scope for "only implement what is necessary to safely
let a host use check-in/event operations now." What IS safe and real today:
a Host's own client never receives revenue/host-pay data through any
route this session controls, because the Host-facing API routes never
query for it — that is what "safely let a host use check-in/event
operations now" resolves to at the current architecture's ceiling.

Verified: `npx tsc --noEmit` and `npm run build` both clean; the exact
list/filter queries behind `/api/admin/host/events` were re-run directly
against production for both an "owner" (unfiltered — 41 upcoming events)
and hypothetical staff `display_name` values already present in real data
(`'Guide'` → 29, `'Ice'` → 0) to confirm the filtering logic produces the
expected narrower result, not just that it compiles; the detail route's
exact field list and sub-queries were run directly against New in
Bangkok's real test event and returned correctly with no host-pay/revenue
fields present; a marked, temporary expense insert (`description LIKE
'STAGE9J_VERIFICATION_TEMP%'`) confirmed the new expense route's insert
shape is valid, then was deleted. `new-in-bkk` reconfirmed still
`status='draft'`, both `visible_*=false`. **Only one real admin_user
exists today** (`Guide`, role `owner`, display_name `Guide`) — there is no
second, real `'staff'` login to test with; the `/dashboard/host` preview
path works today as Guide, exercising the exact same code a real Host
would hit (owner/admin bypass the assignment filter by design, precisely
so this is testable without provisioning a second account) — a true
end-to-end test with a real staff-role login is future work, not blocking.

**Stage 9k — Final mobile-QA closure pass (pre-Stripe-test) — APPLIED
2026-08-23.** Five items from Guide's second round of real-iPhone testing,
all still before the real Stripe transaction:

**Compact mobile calendar.** `app/dashboard/page.tsx`'s calendar cells
showed full event-name pills on every viewport, which "technically fit"
after Stage 9h's overflow fixes but were still visually dense/cumbersome on
a phone. Redesigned as a native month-overview on mobile only: date number
+ small colored dots (one per event instance that day, using the exact same
`nightColors[night_slug]` map the desktop pills already used — no new color
system), no event names, `min-h-[40px]` cells (vs `80px`). Implemented as
TWO always-present DOM variants gated by Tailwind `sm:hidden` / `hidden
sm:block` (not JS media-query state, so no hydration mismatch) — the
desktop name-labeled pills are **completely unchanged**, same markup, same
`sm:` breakpoint as Stage 9h. The legend's spacing was compacted on mobile
(smaller gap/padding via `sm:` classes); its swatch shape and labels were
deliberately left as the original square pills, not the new mobile dots,
since the desktop legend didn't need a shape change just to get tighter
spacing. Verified: `npm run build`, then grepped the compiled CSS for the
exact new arbitrary-value classes (`min-h-\[40px\]`, `sm:min-h-\[80px\]`,
`sm:max-w-\[420px\]` etc.) to confirm Tailwind's JIT actually generated them
— confirmed present (an earlier grep attempt in this same session
under-escaped the brackets and produced a false "not found," corrected by
re-checking with a looser pattern before trusting the negative result).

**Alex Chen's actual customer ticket.** Discovered Alex's booking had
drifted to `attendance_status='checked_in'` (Guide had used the "direct
resolved check-in" bonus link from the prior round to test the button, not
realizing it would actually check him in) — reset to `'expected'` via a
direct, explicit UPDATE so a real fresh scan could be tested, per Guide's
explicit instruction to leave it untouched/`expected`. No code change was
needed for `/ticket/[token]` itself — it already worked generically for any
booking with a `ticket_token` since Stage 9c; Alex's real link is in the
preview links given below.

**Check-in success spacing — corrected, not just re-described.** The
Stage 9i "fix" from the previous round set `marginTop: '4px'` on the "Scan
Next Ticket" button — technically present but nowhere near "should not
visually touch." Increased to `28px` in
`app/dashboard/checkin/[token]/page.tsx`. Re-verified (not re-assumed) that
the state logic itself was already correct from Stage 9i: `isCheckedIn`
(from `attendanceStatus`, not the `alreadyCheckedIn` response flag) still
correctly makes the green button and the checked-in banner mutually
exclusive, `justConfirmed` still only controls the banner's color/text
(green "Checked In" vs amber "Already Checked In"), and "Scan Next Ticket"
still always follows. Only the spacing constant needed to change.

**Confirmation email — real hierarchy, real gap found and fixed.** Added
`startTime`/`meetingPointRaw` params to `generateConfirmationEmail()`
(`emails/confirmation.ts`) and wired the webhook to supply them via
`resolveBookingByToken()` (the SAME shared resolver the ticket page and
check-in route already use — no third copy of the event/product join).
Restructured the canonical (ticket-present) path's top section to Guide's
exact requested hierarchy — Booking Confirmed → product name → date · real
time · guest count → meeting point (via `revealMeetingPointForTicket`, the
identical function/rules the ticket page uses, so the email and the ticket
page can never disagree about what's disclosable) → total paid → QR image
→ booking reference → a renamed **"View Ticket & QR →"** CTA to
`/ticket/[token]` — replacing the old BOOKING SUMMARY table + old "YOUR
TICKET" section for that path only. The legacy (no-`ticket`) path's
BOOKING SUMMARY table is byte-identical to pre-Stage-9, moved into its own
`legacySummaryHtml` template string specifically so the two paths can't
accidentally cross-contaminate.

**Real bug found by testing this against real New in Bangkok data, not
assumed:** the OLD hardcoded "MEET-UP DETAILS" ("Be at the first bar by
9:30 PM sharp" / "shared via WhatsApp by 7 PM") and "CONFIRMATION PROCESS"
("minimum of 5 participants") sections rendered UNCONDITIONALLY for every
booking, including canonical ones — directly contradicting the new
section's correct 20:30 and already-disclosed meeting point for New in
Bangkok. Gated both to the legacy path only (`legacyMeetupProcessHtml`,
same pattern as `legacySummaryHtml`). **Not fixed, explicitly flagged as a
pre-existing, still-open gap:** the remaining "YOUR NIGHT" (hardcoded
4-venue BCC schedule), "INCLUDED/NOT INCLUDED", "DRESS CODE", and "TIPS"
sections are ALSO BCC-crawl-specific and still render unconditionally for
every product, including New in Bangkok — factually wrong for a
single-venue product once real customers see it. Left untouched this pass
(would need per-product content, e.g. sourced from Phase 4's
`product_content` fields, rather than more hardcoded template branches —
real scope, not "extremely small/safe," and explicitly not requested this
round). **Worth fixing before New in Bangkok's real ad spend/launch, not
before this Stripe test** (nothing here blocks a single real transaction
from working correctly).

The CTA/QR both read from one shared `appUrl` variable
(`process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'`,
unchanged) — there is no code path where they could resolve to different
hosts, so "canonical production base URL" is structurally guaranteed, not
just tested for this one case.

New **temporary, admin-only** `app/dashboard/email-preview/[token]/page.tsx`
(gated by `getAdminUser()`, same check every other `/dashboard` page uses;
also subject to the Stage 9j staff-redirect since it's not in
`STAFF_ALLOWED_PREFIXES`) renders the REAL `generateConfirmationEmail()`
output in an iframe — nothing is sent, no Resend call. Because the QR/CTA
correctly point at `bkkclubcrawl.com` (which doesn't have this Stage 9 code
yet — not merged to `main`), the QR *inside the emailed iframe* renders
broken in this preview; the page explains why directly above the iframe and
additionally renders the same QR from `/api/tickets/[token]/qr` on the
CURRENT preview deployment so Guide can still see what the QR image itself
looks like. **Not yet decided:** whether this route is worth keeping as a
permanent internal admin tool (previewing any booking's email without a
real send) or should be deleted at Stage 9 closure — flagged, not resolved,
since Guide didn't specify either way.

Verified: `npx tsc --noEmit` and `npm run build` both clean. The email
template itself was exercised standalone in Node (not just compiled) twice
— once which caught the MEET-UP DETAILS/CONFIRMATION PROCESS contradiction
above, and again after the fix confirming: canonical path shows the real
20:30 time and meeting point with NO "9:30 PM"/"5 participants" text
anywhere; legacy path (no `ticket`) is completely unchanged, still shows
the hardcoded 9:30 PM, the 5-participant line, RUN OF SHOW, and DRESS CODE
exactly as before Stage 9k. Alex Chen's booking reconfirmed `expected`;
`new-in-bkk` reconfirmed `status='draft'`, both `visible_*=false`.

**Stage 9l — QR host-resolution architecture fix + fully product-driven
email + Host Ops noise filter — APPLIED 2026-08-23.** Three items from
Guide's THIRD round of real-device testing. **This stage supersedes two
specific claims made in Stage 9k above** (recorded there accurately for
what was true at the time, not restated retroactively): the "CTA/QR both
read from one shared `appUrl`... unchanged" line, and the "Not fixed,
explicitly flagged" note about RUN OF SHOW/DRESS CODE/TIPS still showing
for every product — both are now different, per below.

**1. Alex's QR scan failed with a client-side exception — root cause
found, not guessed.** Guide physically scanned Alex's real QR and Safari
showed "Application error: a client-side exception has occurred." Rather
than assume a cause, the actual deployed QR was decoded byte-for-byte
(fetched `/api/tickets/[token]/qr`'s real PNG output via a Vercel
share-bypass link, decoded with `jsQR`+`pngjs`) — it correctly encoded
`https://bkkclubcrawl.com/dashboard/checkin/preview-test-alexchen-...`, the
real production domain, confirming the QR payload itself, hostname
handling, and share-token behavior were all NOT the bug (that whole branch
of the ask is verified clean). The actual defect: EVERY appUrl call site
(`app/ticket/[token]/page.tsx`, `app/api/tickets/[token]/qr/route.ts`,
`emails/confirmation.ts`) unconditionally hardcoded
`NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'` — so EVERY environment,
including this Stage 9 feature-branch Preview deployment (not yet merged
to `main`), generated a QR pointing at production. `bkkclubcrawl.com`
doesn't have `/dashboard/checkin/[token]` yet, so the flow was untestable
pre-merge by construction: navigating there fresh (reproduced directly via
the Browser tool with the exact real token) gave a clean 404 in this
session's test, not a matching client-side exception — the precise
mechanics of Guide's exact crash text could not be reproduced from this
sandbox (different device/browser/cache state), reported honestly rather
than claimed as solved; what WAS conclusively fixed is the structural cause
that made the flow untestable at all, which subsumes it regardless of the
exact crash mechanism.

Fix: new `lib/appUrl.ts` → `getAppUrl()`. **First version shipped with
override-checked-first priority (explicit `NEXT_PUBLIC_APP_URL` > Vercel
`VERCEL_ENV`/`VERCEL_URL` > hardcoded default) on the ASSUMPTION that env
var would be unset on Preview — deployed, then re-verified by decoding the
actual live QR image again (same jsQR+pngjs method), and it STILL showed
`bkkclubcrawl.com`, proving the assumption wrong rather than declaring the
fix done on faith.** Added a temporary diagnostic route (`GET
/api/debug-env`, committed, deployed, queried, then deleted — never left
in the codebase) to see the real values directly: confirmed
`NEXT_PUBLIC_APP_URL=https://bkkclubcrawl.com` is explicitly configured for
**All Environments** in this Vercel project (not Production-only), while
`VERCEL_ENV` and `VERCEL_URL` were exactly as expected
(`"preview"`/the real deployment host). With override-first priority, that
env var config meant the "fix" changed nothing on Preview — a real
near-miss caught by re-verification, not assumed fixed after writing code
that looked right. **Corrected priority, now shipped:** Preview
(`VERCEL_ENV==='preview'`) is checked FIRST and unconditionally uses
`VERCEL_URL`, ignoring `NEXT_PUBLIC_APP_URL` entirely — only Production and
local dev fall through to the env var / hardcoded-default branch. Real
transactional emails/tickets are still unaffected (production still always
resolves to `bkkclubcrawl.com`, since `VERCEL_ENV` there is `'production'`,
never `'preview'`); what changes is that a Preview deployment no longer
generates a QR pointing at a domain that doesn't have the code yet. All
three call sites (plus the email-preview route, whose "QR will render
broken here" messaging was corrected to describe the real, now-working
behavior) use `getAppUrl()`. Also audited
`app/dashboard/checkin/[token]/page.tsx` line-by-line for any unguarded
client-side throw (null access, unhandled rejection) per Guide's explicit
ask — found none; every optional field is checked before use. Verified:
`npx tsc --noEmit`/`npm run build` clean after the correction;
`getAppUrl()` exercised standalone against the REAL confirmed env
configuration (override set for all environments) confirming Preview now
correctly ignores it and Production/local still respect it; the live QR
was decoded a THIRD time post-correction-deploy and finally showed the
Preview deployment's own host, not `bkkclubcrawl.com`; then navigated
there directly (unauthenticated, via the Browser tool) and got a clean
`/login?redirect=/dashboard/checkin/[token]` redirect with a working
"Admin Sign In" page — no client-side exception anywhere in the chain,
and the intended path is correctly preserved for after login. The fix is
confirmed working by direct observation at every step, not inferred from
the code change alone.

**2. Confirmation email is now genuinely product-driven — full rewrite,
not a patch.** `emails/confirmation.ts` no longer contains ANY BCC-specific
content or branching — the old `legacySummaryHtml`/
`legacyMeetupProcessHtml`/RUN OF SHOW/INCLUDED-NOT-INCLUDED/DRESS
CODE/TIPS blocks are gone entirely, replaced by ONE template driven purely
by resolved Product/Event Content. `lib/bookingResolution.ts`'s
`ResolvedBooking` gained `itinerary`, `whatsIncluded`, `whatsNotIncluded`,
`importantInfo` (same `resolveBookingByToken()` query, no new resolver) —
the webhook passes all four straight through, no BCC-specific defaults
ever substituted when a Product's `product_content` lacks them. Header/
footer brand identity changed from "BANGKOK CLUB CRAWL" to "BEST NIGHTLIFE
THAILAND" (the product name stays prominent in the body — `<h1>` is now
literally "Booking Confirmed", with the product name as its own line
below). Layout was flattened per Guide's explicit "block inside a block"
complaint — one content canvas with thin dividers between sections
(Summary / Meeting Point / How The Night Goes / What's
Included+Not-Included / Good To Know / Ticket-CTA), no nested
background-boxed cards; What's Included/Not Included stack vertically
(never the old 50/50 two-column table that would squeeze on mobile).

**Real cross-branch data-shape bug found and handled, not assumed:**
`product_content.whats_included` in the REAL New in Bangkok row holds
`{icon, text}` objects, not plain strings — written by a separate,
NOT-YET-MERGED branch's icon-system work
(`claude/mobile-admin-editor-stage-a-kv6e43`, discovered via its own Vercel
deployment history) whose corresponding ProductPage rendering isn't in
this branch. This branch's `ProductPage.tsx` still types the column as
`string[]` — a real, pre-existing type/data mismatch, NOT touched here
(out of scope, unrelated file) — but the email needed to handle it
correctly regardless: `ResolvedBooking.whatsIncluded` is now `unknown[]`
with an explicit doc comment, and `emails/confirmation.ts` extracts display
text defensively (`itemText()`: string as-is, or `.text` off an object),
so it never renders `[object Object]` no matter which shape a given
Product's row uses.

QR remains embedded (`<img>`, inert on load failure — never breaks the
email or hides the CTA) but the "View Ticket & QR" button is the
unconditional, durable primary path; both read from the exact same
`getAppUrl()` call, so they can never resolve to different hosts by
construction. Verified end-to-end in Node (not just compiled) against
three real scenarios: New in Bangkok with its full real content (all four
optional sections render correctly, including the `{icon,text}`
extraction, real 20:30 time, real meeting point, no BCC copy anywhere);
Bangkok Club Crawl with `ticket` present but `product_content` still
genuinely empty (today's real BCC state) — renders cleanly with NO
itinerary/inclusions sections and NO fake substitute copy, exactly per
"if a Product has no itinerary, do not show a fake/default BCC itinerary";
and no-`ticket` at all (insert failure) — still shows Booking
Confirmed/product/date/amount, correctly omits the CTA (nothing to link
to). **Known, accepted consequence, not a regression:** Bangkok Club
Crawl's email is now LEANER than before Stage 9l (no run-of-show/dress-code
copy) because that content was never real canonical data, only hardcoded
prose — populating `bangkok-club-crawl`'s `product_content` via the
existing admin Content tab (Stage 8c) is the correct way to restore
equivalent richness, not hardcoding it back into the template.

**3. Host Operations now shows only actionable events.** `GET
/api/admin/host/events` previously returned every upcoming `event_dates`
row regardless of state — Guide's screenshot showed closed dates with zero
bookings cluttering the list. Added a filter (query + presentation only,
`event_dates` rows themselves untouched): an event now qualifies if
`is_open`, OR `event_date` is today (Bangkok), OR `operation_verdict` has
moved past the default `'Pending'`, OR it has ≥1 confirmed `bookings`/
`ota_bookings` row. Applies to owner/admin too (not just staff) — this IS
the Host Operations view regardless of who's looking at it; the owner's
full/unfiltered access stays on the existing `/dashboard` calendar,
unchanged. "Scan Ticket" remains at the top of `/dashboard/host`, above
the list, unchanged from Stage 9j. Verified by replicating the exact
filter as a single SQL query against real production `event_dates`/
`bookings`/`ota_bookings` — confirmed it correctly drops closed,
zero-booking, `Pending`-verdict future dates (e.g. a closed "Solo
Traveler's Night") while keeping today's date regardless of state, open
dates, and New in Bangkok's real test event (open + has Alex Chen's
booking).

Alex Chen's booking reconfirmed `expected` (reset again — Guide's own
testing of the "direct resolved check-in" link had flipped it to
`checked_in` a second time); `new-in-bkk` reconfirmed `status='draft'`,
both `visible_*=false`.

## BNT integration (separate track from the New in Bangkok onboarding below)
A second, separately-audited storefront (`bestnightlifethailand.com`, repo
`NightlifeAntigravity`, project `nightlife-antigravity`) will consume this
canonical Product system as a read-only client — never direct DB access, never
a duplicated checkout. Two audits (architecture, then a focused checkout pass)
concluded: `bcc-claude` stays the canonical backend for both storefronts;
`bestnightlifethailand.com` gets its own `/events/[slug]` + `/book` (NOT
`bkkclubcrawl.com/book`), calling the same canonical checkout backend
server-to-server. Staged as **A. Product read API → B. BNT `/events/:slug`
page → C. BNT booking surface → D. shared canonical checkout → E.
Publish/activation → F. legacy cleanup**. New in Bangkok stays Draft through
A–D. Only Stage A is implemented so far (this branch, `bcc-claude` side only —
no `NightlifeAntigravity` changes yet).

### Stage A — Product Read API — COMPLETE
`GET /api/products/[slug]?storefront=bcc|bnt` — public, unauthenticated,
read-only. Reuses `/api/events`'s storefront-whitelist pattern (now extracted
to `lib/storefront.ts`, imported by both routes, so the two can't drift) and
the exact fail-closed gate `/events/[slug]/page.tsx` already uses:
`status='active' AND visible_<storefront>=true`, else a uniform 404 — a
Draft product, a wrong-storefront product, and a nonexistent slug are all
indistinguishable to the caller.

**Response contract** (hand-picked, not a table dump):
```
200 →
{
  product: { slug, name, default_price, default_start_time },
  content: {                                    // null if no product_content row
    tagline, short_description, full_description, duration_minutes,
    highlights, itinerary, whats_included, whats_not_included, important_info,
    meeting_point: {
      visibility: 'public', display_name, address, maps_url, instructions
    } | { visibility: 'after_booking' }          // NO location fields at all
      | null                                     // 'private', unset, or invalid
  } | null,
  media: [ { kind, alt, sort_order, url } ],      // url derived from storage_path; storage_path itself never returned
  upcomingEvents: [ { eventId, eventDate, effectivePrice, effectiveStartTime } ]
                                                   // is_open=true, event_date >= today (Asia/Bangkok);
                                                   // effective* = instance override ?? product default
}

400 → { error: 'Unknown storefront' }             // storefront not in {'bcc','bnt'}
404 → { error: 'Not found' }                      // missing / inactive / not visible on this storefront
503 → { error: 'Product temporarily unavailable. Please try again.' }  // Supabase query error (fail closed, distinct from 404)
```
Never returned, by design: `product.id`/UUID, `product.status`, raw
`visible_bcc`/`visible_bnt`, `event_dates.id`'s product/schedule linkage
beyond the instance id itself, `capacity`, `product_schedules` anything,
`product_media.storage_path`.

**Meeting-point sanitization is enforced server-side in this route**, not
left to a renderer — the previous audit found `ProductPage.tsx` was the only
place gating `meeting_point.visibility` today, which is fine within one
trusted app but not once a second, external app is a consumer. Rule: `public`
→ full location object; `after_booking` → `{visibility:'after_booking'}`
only, zero location fields (BNT renders its own generic "shared after
booking" copy — actual post-booking disclosure is a separate, later
concern); `private`/unset (`{}`)/invalid → `meeting_point: null`.

**Files:** `lib/storefront.ts` (new — `VISIBILITY_COLUMN` whitelist,
extracted from `app/api/events/route.ts` so both routes import the same
object instead of two copies that could drift), `app/api/products/[slug]/
route.ts` (new), `app/api/events/route.ts` (modified — now imports
`VISIBILITY_COLUMN` instead of defining it locally; behavior unchanged).

**Verified:**
- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds; route lists as `ƒ /api/products/[slug]`
  (dynamic, not statically rendered), no regressions to any other route.
- `?storefront=invalid` and missing `storefront` → live HTTP 400 `{"error":
  "Unknown storefront"}` (confirmed via `next dev` against this branch —
  this check never touches Supabase, so it worked even where the DB-backed
  checks below couldn't run over HTTP).
- End-to-end HTTP verification of the DB-gated paths hit the same
  constraint recorded earlier in this doc (Stage 8d's "how to resume" notes):
  this session's Vercel-pulled env vars come back with real secret values
  redacted to `""` (Supabase URL/keys, Stripe keys, etc. — platform metadata
  like `VERCEL_ENV` pulls fine, project secrets don't), so `next dev` can't
  reach the real Supabase project locally either. Fell back to the same
  playbook already documented here: **direct-SQL gate replication against
  the exact route/query logic**, via the Supabase MCP against the real
  project (`oomhftxgvikzxlvqdcmr`), read-only (`SELECT` only, zero writes):
  - `products` table confirms real current state: `bangkok-club-crawl`
    (`status='active'`, `visible_bcc=true`, `visible_bnt=false`) and
    `new-in-bkk` (`status='draft'`, `visible_bcc=false`, `visible_bnt=false`)
    — unchanged by this stage, confirmed before and after.
  - Replicated the route's gate against `new-in-bkk` for both storefronts by
    hand against that row: `storefront=bnt` → `status≠'active'` → gated;
    `storefront=bcc` → `status≠'active'` AND `visible_bcc≠true` → gated. Both
    correctly fail closed while Draft.
  - Replicated the full query chain against `bangkok-club-crawl`
    (active + `visible_bcc=true`, so `storefront=bcc` passes the gate):
    fetched its real `product_content` (0 rows → `content: null`),
    `product_media` (0 rows → `media: []`), and `event_dates` (5+ real open
    future rows) and hand-traced the exact response the route would produce
    — confirmed no `id`/`status`/`visible_*`/`capacity`/`storage_path` in the
    shape, only the approved contract fields.
  - `sanitizeMeetingPoint()` unit-tested standalone (verbatim function body,
    no DB/env needed) against 6 cases incl. an adversarial `after_booking`
    input carrying a real address/maps_url/instructions payload designed to
    catch a leak — confirmed the output is exactly `{visibility:
    'after_booking'}` with nothing else, and `private`/unset/invalid all
    produce `null`.
  - `product_media` → public-URL mapping checked against `new-in-bkk`'s 3
    real uploaded rows (real `storage_path` values from Stage 8d) — traced
    that the response only ever carries the derived `url`, never
    `storage_path`.
  - Price/start-time override precedence (`row.*_override ?? product.default_*`)
    reuses the identical expression already live in `/api/events` and
    `/events/[slug]/page.tsx`; no `event_dates` row in production currently
    has a non-null override to exercise live, so this is verified by
    code-pattern parity with already-proven production code, not a live
    override case.
  - Reconfirmed after all queries: `new-in-bkk` still `status='draft'`,
    `visible_bcc=false`, `visible_bnt=false`; `bangkok-club-crawl` and all
    other BCC operational data unchanged. Every verification query was a
    plain `SELECT` — zero `INSERT`/`UPDATE`/`DELETE` run against production.

**Not done:** Stage B (BNT `/events/:slug` page), Stage C (BNT booking
surface), Stage D (shared checkout storefront-awareness — `create-checkout`
still hardcodes `visible_bcc` and a single `NEXT_PUBLIC_APP_URL`/
`bkkclubcrawl.com` redirect; per the checkout-architecture audit, Stage D
will use server-only `APP_URL_BCC`/`APP_URL_BNT` env names, not
`NEXT_PUBLIC_*`), Stage E (publish), Stage F (legacy cleanup). No
`NightlifeAntigravity` changes have been made. `new-in-bkk` is untouched:
still Draft, still `visible_bcc=false`, still `visible_bnt=false`.

## Where we are
Phase 4 adds an internal admin dashboard to create Products, generate their
Event Instances from a recurrence rule, and operate individual dates — so
launching a new experience becomes an **admin task, not a code/SQL task**.

- **Working branch:** `claude/phase4c-content-media-audit-dvu5c1`, based on
  `phase4-stage0-baseline` @ `41db3e4` (GitHub `yourTHguide/BCC-Claude`).
- **NOT merged to `main`.** Production (`bkkclubcrawl.com`, `main` @ `03dc06c`)
  still runs the pre-Phase-4 app; all new admin code is Preview-only on the branch.
- **Stages 0–7 complete and verified.** Stage 6 (additive `eventId` checkout
  resolution) and Stage 7 (Activate/Publish + Deactivate) are both done.
  **New in Bangkok** (`new-in-bkk`) is the first real onboarding exercise — it
  **exists as a real Product**: Draft, ฿590, Tuesday 20:30, first date
  2026‑09‑01, 12-week horizon, 1 `product_schedules` row + 12 `event_dates`
  rows, `visible_bcc=false`, `visible_bnt=false`. It stays Draft through the
  rest of Phase 4C — see "Not done yet" below. **Superseded 2026-08-24 (Phase
  3.5, above): now ฿490, Wednesday 20:30, 1 closed historical Tuesday instance
  (2026-09-01, carries the real Stage 9 booking) + 12 open Wednesday
  `event_dates` (2026-09-02 → 2026-11-18), 2 `product_schedules` rows (old
  Tuesday retired/`is_active=false`, new Wednesday active) — still Draft,
  still both `visible_*=false`.**
- **Stage 8a (Migration C v3) applied.** `product_content` + `product_media`
  now live in production, both empty (0 rows), RLS enabled with no policies
  (service-role only). See schema below.
- **Stage 8b (Storage bucket) live.** `product-media` bucket created:
  public-read, `file_size_limit=5242880` (5 MB), `allowed_mime_types=
  {image/jpeg,image/png,image/webp}`. No storage.objects RLS policies
  (deny-by-default, same posture as every other Phase 4C table) — verified by
  direct role-simulation: `anon` INSERT → `42501` RLS violation; `service_role`
  INSERT → succeeds (bypasses RLS, same as `postgres`/`supabase_admin`, all
  three have `rolbypassrls=true`).
- **Stage 8c (Content API + admin Content tab) live.** `GET/PUT
  /api/admin/products/[id]/content` + a Content tab on
  `/dashboard/products/[id]` (alongside Overview / Schedule-Instances,
  unchanged). Generic CRUD proven via a temp Draft product; `new-in-bkk`'s
  `product_content` is still 0 rows — content has not been entered yet.
- **Stage 8d (Media API + admin Media tab) — COMPLETE, real assets live.**
  `GET/POST /api/admin/products/[id]/media` + `PATCH/DELETE
  /api/admin/media/[id]` + a Media tab. `lib/media.ts` centralizes the bucket
  name, allowed types, size limit, and the `storage_path` → public URL
  formula. Guide uploaded New in Bangkok's **real** cover + gallery images
  through the Preview dashboard (2026-08-21) — the true multipart/Storage
  path, exercised for real, not simulated:
  - `product_media` for `new-in-bkk` (`75466d68-23b6-45a9-bc68-96f002fb6b1e`):
    1 cover (`.../cover/1787328645011-mjgkbuhv.jpg`, 226 KB JPEG) + 2 gallery
    images (`.../gallery/1787328606731-dqhtmjf8.png` 2.0 MB,
    `.../gallery/1787328667390-nsrdznqq.png` 2.1 MB) — 3 rows total, all
    under the 5 MB cap, all allowed MIME types.
  - `storage.objects` for bucket `product-media`: exactly 3 objects, `name`
    matching `storage_path` 1:1 for all three rows — zero orphans either
    direction.
  - Gallery `sort_order` was reordered from upload order via the ↑/↓ UI
    (confirmed by created_at vs sort_order not matching) — reorder proven
    working in production, not just in the temp-product SQL simulation.
  - `new-in-bkk` confirmed still `status='draft'`, `visible_bcc=false`,
    `visible_bnt=false` after the upload — uploading media does not touch
    product status/visibility, nothing became bookable.
  - **These are real Product assets now — do not delete them.** Any future
    cleanup in this area must target only `zzz-*` temp products, never
    `new-in-bkk`'s actual rows/objects.
  - `product_content` for `new-in-bkk` is still 0 rows (media only so far;
    content entry is next, whenever Guide chooses to do it — not blocking
    Stage 8e).

## Production database (Supabase `oomhftxgvikzxlvqdcmr`)
- Migration **A** applied — `admin_users` (owner/admin/staff, RLS + self-read),
  `products.updated_at` + `set_updated_at()` trigger (search_path pinned),
  **RLS enabled on `products`** (service-role only).
- Migration **B** applied — `product_schedules` + `event_dates.schedule_id`
  (FK `ON DELETE SET NULL`). The booking calendar never reads `product_schedules`.
- Migration **C v3** applied (2026-08-19, Stage 8a) — `product_content` (1:1)
  + `product_media` (1:N), both RLS-enabled/service-role-only, both currently
  0 rows. Revised from the originally authored v1 during the Stage 8 planning
  session:
  - `product_content` gained `tagline`, `whats_included`, `whats_not_included`,
    `important_info`; `meeting_point` is JSONB (`{display_name, address,
    maps_url, instructions, visibility}`, `visibility` CHECK'd to `'public' |
    'after_booking' | 'private'`) instead of plain TEXT; `itinerary` is
    generic `{title, description}[]` instead of assuming BCC's 4-venue-stop
    shape.
  - `product_media` uses `storage_path` (the canonical Storage-object key) —
    **no `url` column**; the public URL is always derived from `storage_path`
    at read time (`lib/media.ts`, not yet built — Stage 8d). Added a partial
    unique index (`WHERE kind='cover'`) enforcing one cover row per Product,
    and a unique index on `storage_path`.
  - The Supabase Storage bucket `product-media` is **not created yet** —
    Stage 8b.
- Canonical data unchanged by Stage 8a: 2 Products (`bangkok-club-crawl`
  active ฿1200; `new-in-bkk` draft ฿590), 92 `event_dates` (80 + 12), 1
  `product_schedules`, 7 `bookings` — all identical before/after the
  migration. Admin user seeded: bestnightlifethailand@gmail.com.

## Auth model
- Supabase Auth is the sole dashboard gate. `middleware.ts` guards `/dashboard/*`
  + `/api/admin/*` (authentication). `lib/admin-auth.ts` `requireAdmin()` checks
  `admin_users` (authorization) before the service-role client. Service-role key
  is server-only (never in client bundles). Old client password gate removed.

## Admin API (all `requireAdmin()` → service role; browser never touches service role)
- `GET  /api/admin/session` — who am I.
- `GET/POST /api/admin/products` — list / create (create forces `status='draft'`).
- `GET  /api/admin/products/[id]` — detail + read-only event summary.
- `GET/POST /api/admin/products/[id]/events` — list instances (+ booking counts,
  schedules) / add one manual date.
- `POST /api/admin/products/[id]/schedule` — create schedule + generate instances.
- `PATCH/DELETE /api/admin/events/[id]` — edit one instance (is_open, price_override,
  start_time_override, capacity) / guarded hard-delete (future AND zero bookings).
- `POST /api/admin/schedules/[id]/extend` — extend a weekly schedule.
- `POST /api/admin/schedule/preview` — compute dates, no writes.
- `POST /api/admin/products/[id]/activate` — Stage 7: Draft → Active. Requires
  the resulting row to have `visible_bcc=true` (BCC is the only storefront
  checkout enforces today); accepts optional `{visibleBcc, visibleBnt}` to set
  visibility atomically with the flip. Conditional on `status='draft'` (409 on
  a stale/duplicate request).
- `POST /api/admin/products/[id]/deactivate` — Stage 7: Active → Draft,
  status-only (visibility/schedules/instances untouched). Conditional on
  `status='active'` (409 on a stale/duplicate request).
- `GET/PUT /api/admin/products/[id]/content` — Stage 8c: read / upsert the
  ONE `product_content` row (1:1). PUT validates every field server-side
  (incl. `meeting_point.visibility` against the same enum the DB CHECK
  enforces) and never accepts `updated_at` from the client.
- `GET/POST /api/admin/products/[id]/media` — Stage 8d: list media / upload
  one image (multipart). Cover uploads replace the existing cover (delete
  old object+row, insert new); gallery uploads append at `max(sort_order)+1`.
  Server-side type/size validation (jpeg/png/webp, 5 MB), generated filename
  (never trusts the client's).
- `PATCH/DELETE /api/admin/media/[id]` — Stage 8d: edit `alt`/`sort_order`
  only (image replacement is POST+DELETE, not PATCH) / delete row + Storage
  object (row deleted first, so a storage failure orphans harmlessly rather
  than leaving a broken row).

## Dashboard UI
- `/dashboard/products` (list, + Create Product), `/dashboard/products/new`
  (neutral blank Create form + live preview + Save as Draft),
  `/dashboard/products/[id]` — now tabbed: **Overview** (narrow info cards,
  Publish/Deactivate controls) | **Schedule / Instances** (the full-width
  interactive Event Instances panel, unchanged) | **Content** (Stage 8c —
  tagline/descriptions/duration/meeting point/highlights/itinerary/
  included-not-included/important info, explicit Save button) | **Media**
  (Stage 8d — cover upload/replace, gallery multi-upload, alt text, ↑/↓
  reorder, delete). Publish opens an inline panel with non-blocking warnings
  (no upcoming open instances, no default price) and BCC/BNT visibility
  toggles; confirming requires BCC on. `visible_bnt` is labeled "not live
  yet" everywhere it's shown — no BNT storefront/checkout exists yet.
  Tabs are client-side state only, not yet URL-deep-linkable.

## Key invariants (do not regress)
- **Recurrence:** one pure generator `lib/recurrence.ts` (weekly + once, 12-week
  default horizon or explicit through-date, UTC math). Preview and generation
  call the SAME function → what is previewed is what is written.
- **Idempotent generation:** `UNIQUE(event_date, night_slug)` + `ON CONFLICT DO
  NOTHING`. `night_slug` = product slug (1 Product : 1 slug for new products).
- **Extend only adds dates strictly after `generated_through`** — never rescans
  earlier dates, so deleted/closed/manual instances are never resurrected;
  `generated_through` advances only after successful generation.
- **Draft invisibility:** `/api/events` (and checkout) gate on
  `products.status='active'`, so Draft products are invisible regardless of
  `visible_bcc`. Activate/Deactivate (Stage 7) is a pure status flip — no
  other code needed to change, because these gates were already built to
  make that sufficient.
- **BCC-only publish:** the Activate workflow requires `visible_bcc=true` on
  the resulting row, because checkout's dynamic-path gate 5 only checks
  `visible_bcc` — there is no BNT storefront param in checkout and no BNT
  checkout. `visible_bnt` remains a stored/editable field for a future BNT
  storefront, labeled "not live yet" in the admin UI. Do not treat setting
  `visible_bnt=true` as making a product bookable anywhere yet.

## Not done yet (remaining for New in Bangkok onboarding)
- **`ProductPage.tsx`, authenticated Draft preview
  (`/dashboard/products/[id]/preview`), public `/events/[slug]`** — **DONE.**
  (This section previously said "not started (Stages 8e–8k)" — that was
  stale prose that fell out of sync with the actual commits. Corrected
  2026-08-23: `fa9acab` shipped the reusable `ProductPage` component +
  authenticated Draft preview + public `/events/[slug]`, `0ef7087`/`9dcb531`
  redesigned it onto the BEST Nightlife design system with the real logo,
  and `46db54d` (BNT Stage A, `/api/products/[slug]`) built on top of it.
  Verified directly against `git log` and the live route files, not assumed
  from this doc — see the Stage 9 architecture audit below for the full
  trace.)
- **New in Bangkok stays Draft** through all of Stage 8 — Preview and
  production share the same Supabase project, so Activate/Publish is never
  used as a preview mechanism. Draft review happens via the authenticated
  admin preview route (`/dashboard/products/[id]/preview`), not by flipping
  `status`. **Still true entering Stage 9** — New in Bangkok remains
  `status='draft'`, `visible_bcc=false`, `visible_bnt=false` throughout the
  Stage 9 booking-lifecycle work below; it is not activated/published until
  a real paid end-to-end transaction (Product → Stripe → Booking → ticket →
  QR → host scan → checked-in) has been verified.
- **BNT storefront + BNT checkout** — not started; `visible_bnt` is inert.
- **Archive** product-lifecycle state — intentionally deferred (not needed for
  New in Bangkok; Draft ⇄ Active is the full lifecycle for now).
- **Event Date capacity enforcement** — intentionally deferred, explicit
  product decision (not a technical gap): `event_dates.capacity` exists and
  is surfaced by `/api/events`, but nothing enforces it at checkout.
  Deliberately left unenforced for New in Bangkok's launch so Guide can
  observe real booking volume before deciding on a cap. Do not add a
  New-in-Bangkok-specific limit; if/when capacity enforcement is built, it
  must be generic to Event Dates (compatible with BCC) — see the race-safety
  note in the Stage 9 audit below before ever implementing this.
- **Security hardening** (deferred tech debt; `update-attendance` fixed by
  Stage 9e, everything else below is UNCHANGED, still open): old dashboard
  anon-key writes/reads, public `bookings` read policy (`USING (true)` —
  exposes guest name/email/phone AND, as of Stage 9a, `ticket_token` to
  anyone with the anon key, bypassing the QR resolver entirely; not
  worsened by Stage 9a, but directly relevant to it — the "opaque QR token"
  security property only defends against someone reading the QR image, not
  direct DB access), **5 remaining unauthenticated `/api/*` ops routes** —
  `cancel-booking`, `reschedule-booking`, `delete-ota-booking`,
  `resend-confirmation`, `send-confirmed-meetup` (deliberately left
  untouched — none of these are used by the Stage 9 booking/check-in
  lifecycle, so fixing them was explicitly out of scope; `update-attendance`
  was the one exception, fixed in Stage 9e because Stage 9d's manual
  check-in fallback depends on it), `daily_summary` SECURITY DEFINER. None
  of this blocks New in Bangkok's launch; all pre-existing, tracked here so
  it isn't rediscovered as a surprise later.

## How to resume
1. `git fetch && git checkout phase4-stage0-baseline` (verify latest commit).
2. Scope the next stage, keep changes additive + Preview-only, never merge to
   `main` without explicit approval.
3. Test with unmistakable `zzz-*` Draft products, verify in the DB via direct
   SQL against the real Supabase project (Preview deployments carry Vercel SSO
   protection, which blocks unauthenticated HTTP fetches from automated
   sessions — direct-SQL gate replication against the exact route/query logic
   is the fallback verification path), then delete and confirm baseline.
4. Storage-specific notes discovered in Stage 8b, for whoever builds the
   Stage 8d upload/delete routes: (a) this agent session's outbound network
   policy blocks direct HTTPS to `*.supabase.co` — the Storage HTTP API can't
   be curl'd from here, only reached via the Supabase MCP `execute_sql`
   channel (which talks to Postgres directly, not the Storage microservice) —
   this is a tooling constraint, not a production one; the real Vercel-hosted
   admin routes have no such restriction. (b) `storage.objects` blocks direct
   `DELETE` via SQL with a `protect_delete()` trigger ("Use the Storage API
   instead") unless the session sets `storage.allow_delete_query = 'true'`
   first — confirms deletes belong in the real Storage API call
   (`supabase.storage.from('product-media').remove([...])`), not a raw SQL
   `DELETE` on `storage.objects`, when Stage 8d's delete route is built.
