# Phase 4 — Internal Product & Schedule Builder — Checkpoint

_Last updated: 2026-08-28 — **Security remediation (Phases 1–3) COMPLETE,
LIVE IN PRODUCTION at commit `b9ca410ebc919588cbadb866de4985b31f063e86`.**
The critical `rls_disabled_in_public` Supabase advisor warning that triggered
this remediation, and the broader anon-key/authorization exposure it led to
auditing, are now resolved in production — see "Security Remediation —
Phases 1–3" immediately below for the full record. Preceded by Phase 8 Gate
A (BNT domain cutover, 2026-08-24), still accurate and unaffected by this
work; its own record is retained below._

_Previously last updated: 2026-08-24 — Phase 8 Gate A: `bestnightlifethailand.com` and
`www.bestnightlifethailand.com` moved from the legacy `nightlife-antigravity`
Vercel project to the unified `bcc-claude` production project. Real BNT host
verified live: homepage/About/Contact/Book render correctly, BNT chrome, no
Meta Pixel, no BCC branding leakage, mobile+desktop clean, zero runtime
errors, BCC regression clean, `new-in-bkk` still Draft/invisible. See "Phase
8 — Gate A: BNT domain cutover" immediately below for the full record. This
was preceded by merging Stage 10 (BNT/storefront consolidation, Phases 1–7)
together with Stage 9's pre-merge remediation fix into `main` in one
controlled, manually-reconciled merge (feature branch
`claude/phase4c-content-media-audit-dvu5c1` @ `7deadd4` into `main`, four
real conflicts resolved by hand — see the merge commit message for exactly
what and why). Both release threads are preserved in full below:
"Pre-merge remediation" and "Where things stand right now" record Stage
9's production-closure work (main's own history); "Stage 10" records the
BNT/storefront consolidation (this branch's history). The original "Stage
9 SESSION PAUSED" investigation record — the real-device QR-scan crash,
at the time unresolved — is kept immediately below Stage 10 for history;
it was later root-caused and fixed on `main` (see "Where things stand
right now" → "QR-scan crash — RESOLVED")._

## Security Remediation — Phases 1–3 — COMPLETE, applied 2026-08-26/27/28, LIVE IN PRODUCTION

**Trigger:** a live Supabase security-advisor warning, `rls_disabled_in_public`
("Table publicly accessible — Row-Level Security is not enabled"), which led
to a full audit of RLS posture and API authorization across the production
Supabase project (`oomhftxgvikzxlvqdcmr`, `BCC - Claude`) and the `bcc-claude`
Next.js app. **The original warning, and the broader exposure the audit
found underneath it, are both resolved in production as of commit
`b9ca410ebc919588cbadb866de4985b31f063e86`.**

**Audit finding, for the record:** the table the advisor named
(`_migration_p1_audit`, a leftover migration-audit log with RLS fully
disabled) was real but low-severity — no PII, confirmed unused by any app
code. The actual critical exposure was underneath it and not what the
advisor flagged: four tables (`bookings`, `event_dates`, `expenses`,
`ota_bookings`) had RLS *enabled* but carried leftover permissive
`USING (true)` / `WITH CHECK (true)` policies open to the `public` role —
functionally equivalent to no RLS at all, and reachable by anyone holding
the anon key (bundled into every page's client JS). `bookings` alone exposed
guest name/email/phone/WhatsApp, `ticket_token` (bypassing the QR resolver
entirely), and `stripe_session_id`, plus direct INSERT.

**Phase 1 — COMPLETE.** `_migration_p1_audit`: RLS enabled, no policy
(deny-by-default, matching the advisor's own suggested remediation; confirmed
unused by any app code, zero regression risk). `daily_summary` (a
`SECURITY DEFINER` view aggregating revenue/expenses per event, also
confirmed unused by any app code): `anon`/`authenticated` `SELECT` grant
revoked, closing a silent revenue-data leak that would have survived RLS
changes on the underlying tables (SECURITY DEFINER bypasses RLS by design).
No application code touched. Verified via a re-run Supabase advisor (both
findings gone) and a full BCC/BNT production regression pass.

**Phase 2A — COMPLETE.** The owner dashboard (`app/dashboard/page.tsx`) was
the only remaining code path reading/writing `bookings`/`event_dates`/
`ota_bookings`/`expenses` directly with the anon key — every other surface in
the app already went through `getServiceSupabase()`. Migrated all 8 of its
direct-Supabase call sites onto 6 new `requireAdmin()`-gated, service-role
API routes under `app/api/admin/dashboard/` (`events`, `events/[id]`,
`bookings`, `day-detail`, `ota-bookings`, `expenses`) — same queries, same
field shapes, no behavior change. Preview testing surfaced a real regression
(the Operation Verdict confirm-modal flow never awaited its save or checked
the response, so a failed/slow save looked like a UI freeze) — root-caused
via a frame-by-frame screen-recording analysis and fixed by properly
awaiting the save and checking `res.ok`, matching the pattern this same file
already used elsewhere (`deleteOTABooking`/`updateAttendance`). Merged to
`main` and deployed at commit `2b94aeb`; confirmed via live Preview log
traces (`operation_verdict` PATCH → 200 → DB row updated correctly) and a
full production regression pass after merge.

**Phase 2B — COMPLETE.** With Phase 2A confirmed live and a fresh
full-codebase grep re-confirming zero remaining anon-key dependencies on the
four tables, dropped the exact 9 permissive policies (2 each on `bookings`/
`expenses`/`ota_bookings`, 3 on `event_dates`; SELECT/INSERT/UPDATE, all
`USING`/`WITH CHECK (true)` for the `public` role) — no replacement policies
added. **End state, live: RLS enabled on all four tables, zero anon/
authenticated policies — the same "RLS on, no policy, service-role only"
posture already proven safe on `products`/`product_content`/`admin_users`/
etc.** Verified before/after via direct role-simulation against production
(`SET ROLE anon`): SELECT now returns 0 rows despite real data present,
INSERT rejected with `42501`, UPDATE silently affects 0 rows;
`service_role` confirmed `rolbypassrls = true` at the Postgres level, so
every existing service-role route continues working unchanged. Re-run
advisor: all four tables now show only the benign `rls_enabled_no_policy`
INFO classification, zero ERROR-level findings. Full BCC/BNT/checkout/
ticket-QR/check-in production regression pass, zero runtime errors.

**Phase 3 — COMPLETE.** A follow-on API-authorization audit (starting fresh
from current code, not trusting old tech-debt notes) found 5 service-role
`/api/*` routes with **zero auth checks**: `cancel-booking`,
`reschedule-booking`, `delete-ota-booking`, `resend-confirmation`,
`send-confirmed-meetup`. **`update-attendance` was independently verified
already protected** (Stage 9e, 2026-08-23, `requireAdmin()`) and was left
untouched. A full-codebase caller grep confirmed every single caller of all
five vulnerable routes is internal dashboard code (`app/dashboard/page.tsx`)
— no customer-facing flow depends on any of them, so the fix is the existing
admin-auth architecture, not a new booking-token/customer-auth model.
`send-confirmed-meetup` was the standout real-world risk: its only
"credential" (`eventId`) is handed out by the fully public, unauthenticated
`/api/events` endpoint (needed for checkout), so anyone could have
triggered unlimited "tonight is confirmed" emails — revealing the real
meet-up location and WhatsApp link — to every guest of any live event, with
zero credentials. The other four require a `bookingId`/OTA `id` (a UUID
traced through every email template, the ticket page, and the
`bookings/by-session` poller and confirmed never exposed to any
customer-facing surface), so real-world exploitability was lower but the
missing gate was still real. Fixed: `cancel-booking`, `reschedule-booking`,
`delete-ota-booking`, `resend-confirmation` → `requireRole(['owner','admin'])`
(financial/destructive actions, same tier as `/api/admin/products/[id]/
activate|deactivate`); `send-confirmed-meetup` → `requireAdmin()` (matches
the rest of the Day Panel's existing Phase 2A gating level). Verified live
in Preview and again after merge to `main`/production (commit `b9ca410`):
all five routes return `401 {"error":"Unauthorized"}` for an unauthenticated
caller (tested against the real deployed app, bypassing only Vercel's own
deployment-protection SSO wall, not the app's own auth), `update-attendance`
reconfirmed byte-identical/unchanged, zero runtime errors, full BCC/BNT
regression pass.

**Production state, end of Phase 3 (verify, don't just trust this doc):**
- `main` HEAD: `b9ca410ebc919588cbadb866de4985b31f063e86`, deployed and
  confirmed live on `bkkclubcrawl.com`/`bestnightlifethailand.com`.
- `bookings`, `event_dates`, `expenses`, `ota_bookings`: RLS enabled, zero
  anon/authenticated policies, service-role only.
- Owner dashboard: 100% authenticated service-role API routes, zero direct
  anon-key Supabase access anywhere in `app/dashboard/page.tsx`.
- `cancel-booking`, `reschedule-booking`, `delete-ota-booking`,
  `resend-confirmation` — `requireRole(['owner','admin'])`.
- `send-confirmed-meetup` — `requireAdmin()`.
- `update-attendance` — `requireAdmin()` (unchanged since Stage 9e).
- `_migration_p1_audit` — RLS enabled, no policy. `daily_summary` —
  `anon`/`authenticated` `SELECT` grant revoked.
- Supabase advisor: zero ERROR-level findings.

**Remaining non-blocking items, tracked here, not fixed (none are the
original critical exposure — that is closed):**
1. **`auth_leaked_password_protection`** (Supabase Auth advisor WARN) —
   confirmed not actionable today: this Supabase org
   (`Sanctuary Nexus's Org`) is on the **Free plan**, and the feature
   requires Pro or above. Revisit only if/when the plan is upgraded.
2. **`/api/contact` and `/api/vip-inquiry`** — correctly public-by-design
   (audited for IDOR specifically; INSERT-only, no id-based lookup or
   mutation path found), but carry no rate-limiting or CAPTCHA. A spam-
   hardening item, not an authorization vulnerability.
3. **`admin_users` staff role ↔ `event_dates.host_assigned` matching** — a
   pre-existing, already-acknowledged (Stage 9j) limitation: this is a
   case-sensitive free-text string match, not a real foreign-key
   relationship. Works today; a future cleanup could replace it with a
   proper `user_id` FK.

## Phase 8 — Gate A: BNT domain cutover — COMPLETE, applied 2026-08-24, LIVE IN PRODUCTION

**Scope:** move the real `bestnightlifethailand.com`/`www` domains from the legacy `nightlife-antigravity` Vercel project (a static-HTML+Express app, unrelated to this codebase) onto the unified `bcc-claude` app, and verify the real BNT host end-to-end. Preceded by a full merge-readiness audit and a controlled merge of the Stage 10 BNT/storefront work into `main` (see "Pre-merge remediation"/Stage 10 sections below) — Production was confirmed running the merged code, with a full BCC smoke-test pass, before the domain itself was touched.

**1. Domain reassignment — internal Vercel move, zero DNS change.** `bestnightlifethailand.com` is on Vercel's own nameservers (`ns1/ns2.vercel-dns.com`), confirmed before this session — the domain-level DNS records (Resend SPF/DKIM/MX, wildcard ALIAS) were untouched. The Vercel CLI's `domains add --force` did not complete the cross-project move as documented (returned `alias_conflict` even with `--force`); used Vercel's own dedicated REST endpoint instead, `POST /v1/projects/{project}/domains/{domain}/move`, found via `search_vercel_documentation` — moves a project's domain to another project, no DNS involved. Ran it for the apex (`nightlife-antigravity` → `bcc-claude`); `www.bestnightlifethailand.com` had no explicit project assignment before this (it was riding the wildcard ALIAS, 307-redirecting to the apex) and was added to `bcc-claude` directly via `vercel domains add`. Confirmed after: both domains' raw `GET /v9/projects/bcc-claude/domains/{domain}` show `projectId: prj_8lk7wWojrA96nopAzib7QC3f4jAn` (`bcc-claude`), `verified: true`. `nightlife-antigravity` project itself was not paused, modified, or deleted — kept live and warm as the rollback target, exactly as instructed.

**2. Real BNT host verified live (not a Preview/SSO-bypass workaround — the actual custom domain, for the first time since Phase 4):**
- `/`, `/about`, `/contact`, `/book` all 200; `/new-in-bangkok` correctly 404 (`new-in-bkk` still Draft/invisible — fail-closed exactly as designed, not tested around).
- `x-powered-by: Next.js` confirms this is the unified app, not the legacy Express site.
- Homepage: BNT logo (`/bnt/logo/best-nightlife-thailand-logo.png`) only, "PRIVATE ACCESS COLLECTIVE" tagline, hamburger nav (Home/About/Contact) opens and links correctly. "Bangkok Club Crawl" appears once, as the intentional cross-brand card in "Our Signature Events" linking to `bkkclubcrawl.com` — not a branding leak, confirmed by full page-text extraction (footer reads "BEST NIGHTLIFE THAILAND" only).
- `/book` chrome: BNT logo confirmed in the rendered HTML, no "BANGKOK CLUB CRAWL" string anywhere on the page.
- `/about` title "The Heart behind the Night. | BEST NIGHTLIFE THAILAND"; `/contact` title "Contact | BEST NIGHTLIFE THAILAND" — both correct.
- Meta Pixel: zero `fbq`/`connect.facebook.net` references in the homepage response — confirmed absent on the real BNT host (the `isBcc` gate in `app/layout.tsx` working as designed against a real Host header, not a spoofed one, for the first time).
- Contact form: renders fully via browser (name / WhatsApp+country-code / occasion textarea), zero console errors. Not submitted, per the standing no-real-customer-data instruction.
- Private Experience inquiry modal: confirmed present and fully formed (Step 1 of 4, name/WhatsApp/occasion fields) via full page-text extraction of the live DOM. Not submitted, same reason.
- Mobile (375×812) and desktop viewports both render cleanly, zero console errors either size.
- One repeat of a previously-documented, non-blocking cosmetic finding (Phase 7): the "Private Experiences" swipeable deck renders as a solid black screenshot in headless automation at that scroll position, while its DOM/content and Previous/Next-Experience controls are confirmed present and correct via the accessibility tree — a headless-browser rendering quirk, not a real defect, same as previously flagged and still not worth fixing blind.

**3. BCC regression, live on the real production domain:** `bkkclubcrawl.com` homepage 200, `/book` 200, `/login` 200, `/dashboard` 307 (auth-gated, not 500), `/api/events?storefront=bcc` returns correct real event data (TGIF Bangkok, ฿1,200, tier `regular`). Zero runtime errors on the `bcc-claude` project (Vercel's error aggregation, 30-minute window spanning the cutover) on either brand's traffic.

**4. Database state, reconfirmed unchanged after the cutover:** `new-in-bkk` — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`. `bookings` — still exactly 8 rows. No Stripe activity, no pricing change, no APT 101 Ladies Night content added.

**5. Rollback plan (verified available, not exercised — no issue found):** `POST /v1/projects/bcc-claude/domains/{bestnightlifethailand.com,www.bestnightlifethailand.com}/move` with `projectId` set back to `nightlife-antigravity`'s project id — same zero-DNS internal move, reverses in seconds. `nightlife-antigravity` was kept live and untouched specifically so this stays available.

**6. GO/NO-GO: BNT DOMAIN CUTOVER — PASS.** Gate A (platform cutover) is complete and stable. Gate B (New in Bangkok launch — publish, ฿390 Early Bird live customer journey, real Stripe E2E, cancellation/refund branding) has not been started; `new-in-bkk` remains Draft/invisible on both storefronts, exactly as instructed.

## Pre-merge remediation (2026-08-24, post-Stage-9-close) — now merged to `main`

A separate audit session, run specifically to assess promoting this branch
(`f457026`, "Close Stage 9") to `main`/production, found one real regression
this Stage 9 work would have introduced and a few smaller cleanup items.
Guide approved remediation but explicitly withheld merge approval — this
section records what was fixed, on this branch, still unmerged.

**1. Real regression found and fixed: `bangkok-club-crawl` had zero
`product_content` rows.** `app/api/webhook/route.ts` (Stage 9b) generates a
`ticket_token` unconditionally for every paid booking, legacy checkout path
included, and `emails/confirmation.ts` (Stage 9l) is now a single template
driven entirely by `product_content` — "a Product with no
itinerary/inclusions renders without that section, never a default/
hardcoded substitute," by design. `bangkok-club-crawl` (the real BCC
product, unlike `new-in-bkk`) had never had its content populated, because
Stage 8's content work only ever targeted New in Bangkok. Left alone, this
branch would have shipped every future real BCC customer a confirmation
email missing meet-up time, WhatsApp/location process, the minimum-
participant/refund policy, run of show, inclusions, dress code, and tips —
the operational information that actually gets someone to the venue.

**Fixed via direct `INSERT` into `product_content`** for `bangkok-club-crawl`
(`product_id bbacd61d-1063-4b69-a0d6-4fd147ef98ea`), transcribing the exact
content from the current production `emails/confirmation.ts` (verified
against `main` @ `03dc06c`, not rewritten or redesigned):
- `itinerary`: the 4 real run-of-show blocks (9:30–10:30 PM through
  1:30–2:30 AM), title/description pairs, verbatim copy.
- `whats_included` / `whats_not_included`: the 5 included / 4 not-included
  items, verbatim (the DJ-nights cover-charge caveat folded into the string
  itself, since the generic renderer has no sub-badge mechanism).
- `duration_minutes`: 300 (9:30 PM–2:30 AM span).
- `meeting_point`: `{"visibility":"private"}` — **not** a literal address.
  BCC's real model is "time is fixed, location is withheld until WhatsApp
  day-of," which the `meeting_point` JSONB shape (built for a disclosed
  venue) doesn't represent natively. `visibility:'private'` is the accurate
  choice (discloses nothing electronically) and the template already has a
  built-in fallback line for it ("The exact meeting point will be shared
  closer to the event") — verified by rendering, not assumed.
- `important_info`: the WhatsApp/7PM and 9:30PM-sharp/no-show process text,
  the minimum-5-participants/refund policy, both dress-code paragraphs, and
  all 4 tips — 11 items total, verbatim, since none of these have a
  purpose-built field in the current schema (see below).

**Content that does not map cleanly to the current `product_content` schema
— reported, not silently dropped:**
- The schema has no dedicated field for a cancellation/refund policy, a
  dress code, or tips/reminders. All three were placed in the generic
  `important_info` string array, which is the least-bad available fit —
  functionally correct (everything renders), but the original email's four
  distinct labeled sections (MEET-UP DETAILS / CONFIRMATION PROCESS / DRESS
  CODE / TIPS & REMINDERS) are now flattened into one bulleted "Good To
  Know" list under a single heading. No content is lost; the presentation
  is less structured than before. Restoring separate headings would need a
  template change, out of scope for a content-only remediation.
- `startTime` renders as 24-hour `21:30` (via the shared `formatStartTime()`
  every product now uses) rather than the original `9:30 PM`. A formatting
  difference, not a content gap — already the standard format for the new
  pipeline (matches how New in Bangkok's own Tuesday 20:30 renders), so this
  is existing shared behavior, not something introduced by this fix.
- The email header/brand line already reads "BEST NIGHTLIFE THAILAND" /
  "Booking Confirmed" instead of "BANGKOK CLUB CRAWL" / "You're booked for
  tonight." — this was Guide's own explicit Stage 9l decision, already
  shipped on this branch before this remediation pass; noted here for
  completeness, not something this pass touched or was asked to touch.

**Verified by rendering, not by reading the code:** the actual
`generateConfirmationEmail()` function (unmodified) was executed via `npx
tsx` against this real `product_content` data plus a realistic sample
booking (this sandbox cannot reach a live authenticated `/dashboard/
email-preview/[token]` session — same `next dev`-can't-authenticate
constraint recorded elsewhere in this doc — so the equivalent, more direct
verification already used elsewhere in Stage 9 was applied here: exercise
the real template function standalone). Full rendered HTML was inspected
line-by-line; every item above confirmed present and correctly formatted.
The scratch script used for this was deleted immediately after (never
committed).

**2. `CHECKOUT_DYNAMIC_PRICING` in Production — status not independently
verifiable from this session.** No tool available here reads actual Vercel
environment variable values (only project/deployment metadata). Guide must
confirm directly in the Vercel dashboard that this flag is unset/false for
Production before any merge. **Not enabled by this remediation pass** — no
env var was touched.

**3. Removed the temporary Stage-9 QR-crash diagnostic scaffolding**, now
that the crash it was diagnosing (documented above as RESOLVED, commit
`69f5d77`) is fixed and confirmed:
- Deleted `app/api/debug-client-log/route.ts` and `lib/clientDebugLog.ts`
  entirely (both were explicitly self-commented "TEMPORARY... must be
  deleted once the real root cause is found").
- `app/dashboard/checkin/[token]/page.tsx`: removed the temporary
  window-level `error`/`unhandledrejection` listeners and every
  `clientDebugLog(...)` breadcrumb call; the actual fetch/state/check-in
  logic is unchanged.
- `app/dashboard/error.tsx` / `app/global-error.tsx`: removed the
  `clientDebugLog` call and the `isDiagnosticEnvironment()`-gated on-screen
  error-detail block (path/name/digest/stack), per each file's own comment
  ("Trim back to just the generic message + Try Again once the real root
  cause is found and fixed"). Both boundaries still exist, still catch
  errors, still log to the console, still show "Try Again" — just without
  the temporary diagnostic detail panel. This was already production's
  actual behavior (the diagnostic block only ever activated off the real
  `bkkclubcrawl.com` hostname), so this is a zero production-behavior
  change, code-cleanup only.
- Confirmed via `grep` across the whole tree: zero remaining references to
  either deleted file after the edits.

**4. `public._migration_p1_audit` (RLS-disabled, 41 rows) — recorded as
separate technical/security debt, deliberately not touched.** Unrelated to
Stage 9 or this remediation; flagged by Supabase's own advisor during the
audit. Not fixed here per explicit instruction — enabling RLS without a
policy would block all access, and no one has decided what should read this
table. Left exactly as found.

**5. New in Bangkok public URL — architecture decision recorded, not
implemented.** The duplicate-surface problem (`app/new-in-bangkok/page.tsx`,
stale Wednesday/฿1,000 copy, wired to the legacy no-ticket checkout path, vs.
the real, tested `new-in-bkk` product at `/events/new-in-bkk`) is unchanged
by this pass — deliberately, per instruction. Recorded intended direction
for whoever implements it next:
- The canonical product stays `new-in-bkk` — no slug rename in this task.
- The desired public marketing URL is `/new-in-bangkok`.
- That public route should eventually resolve/render the canonical
  `new-in-bkk` `ProductPage` (today only reachable at `/events/new-in-bkk`)
  — not a second, separate implementation.
- `/events/new-in-bkk` may redirect to the public URL once that exists.
- The existing stale static `/new-in-bangkok` (its own hardcoded copy, its
  own legacy-checkout wiring) must not remain as a second, parallel
  product/checkout implementation once this is resolved — whether that's
  done by redirecting the old URL or by a slug rename is an implementation
  choice for that future task, not decided here.


## Where things stand right now

**Branch:** `claude/stripe-e2e-new-bangkok-1v46mg` (rebased onto
`claude/qr-email-iphone-crash-mvk3tj` @ `69f5d77`, then two further commits
on top — see Stage 9m). **NOT merged to `main`.**
**Working tree:** clean.

### QR-scan crash — RESOLVED, physically verified (commit `69f5d77`)
Previously recorded here as "THE ONE UNRESOLVED LAUNCH BLOCKER": Guide's
real iPhone scan of Alex Chen's QR crashed with "Application error: a
client-side exception has occurred" even after the `lib/appUrl.ts` hostname
fix (Stage 9l) was verified from sandbox. **Root cause, found live via a
temporary diagnostic error boundary that captured the real thrown error:**
`app/dashboard/checkin/page.tsx`'s `onScanSuccess` callback already called
`instance.stop()` on the `html5-qrcode` scanner before navigating to
`/dashboard/checkin/[token]`; that navigation unmounted the scanner
component, whose cleanup effect called `instance.stop()` a SECOND,
unconditional time on an already-stopped instance. `html5-qrcode` throws
this synchronously (not a rejected promise), so `.catch(() => {})` could
never intercept it; React attributed the cleanup-phase throw to the
nearest error boundary, which rendered over the page the navigation had
already committed to — matching exactly what Guide saw, and explaining why
the resolver's own `GET /api/admin/checkin/[token]` still logged clean
200s every time (a trailing error from the OLD page's teardown, unrelated
to the new page's own successful fetch). **Fix:** a `running` flag set to
`false` synchronously the instant `onScanSuccess` decides to stop the
scanner, so the cleanup effect never attempts a redundant `stop()`; the
cleanup's `stop()` call is also now wrapped in a real `try/catch` (not
`.catch()`) as defense-in-depth against the same bug class elsewhere.
Verified: `npx tsc --noEmit`/`npm run build` clean, and — per Guide,
2026-08-24 — a real physical iPhone scan against a real test booking's QR
worked end-to-end with no crash, confirming the fix directly (this
predates and is separate from the Stripe payment test in Stage 9m below;
Guide intends to personally scan/check in the real paid booking from
Stage 9m separately — not yet done as of this update).

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
**Superseded by Stage 9m below (2026-08-24) — kept here as the historical
record of this session's state, not the current one:**
- Alex Chen's and Jamie Rivera's `preview-test-*` bookings no longer
  exist — both deleted during Stage 9m cleanup.
- `products` where `slug='new-in-bkk'` — still `status='draft'`,
  `visible_bcc=false`, `visible_bnt=false` as of the end of Stage 9m
  (was briefly `active`/`visible_bcc=true` DURING the real payment test,
  then restored). Verify this at the start of the next session regardless
  — don't assume it's still Draft just because this doc says so.
- **A real Stripe test HAS now been run** — see Stage 9m. One real live
  payment, one real booking (`stripe_session_id` starting
  `cs_live_b1ma6R3p...`), preserved as a legitimate record.
- **Still not merged to `main`.** All Stage 9 work (including Stage 9m)
  lives on `claude/stripe-e2e-new-bangkok-1v46mg`.

### Known non-blocking follow-up (do not fix unless asked)
Host Operations (`/dashboard/host`, `GET /api/admin/host/events`) is
functional and its actionable-only filter (Stage 9l) IS live and DOES
correctly drop most closed/zero-booking dates — verified against real
production data. Guide's own screenshot review after that fix still showed
it as imperfect ("still shows unnecessary zero-booking/closed events" —
the exact remaining cases weren't isolated this session). This is
EXPLICITLY DEFERRED as non-blocking for Stage 9 closure — do not touch it
in the next session unless Guide asks.


## Stage 10 — BNT/storefront consolidation (Phases 1–7) — COMPLETE, merged to `main`

### Phase 7 — Vercel environment-variable audit + BNT Preview QA — AUDIT/QA ONLY, no code changes, applied 2026-08-24, NOT merged/deployed, NOTHING DELETED

**Session scope, explicitly bounded:** audit-only. No env var deletions, no DNS changes, no domain moves, no `visible_bnt`/publish changes, no merge to `main`, no real Stripe payment, no branch deletions. Guide's own manual steps before this session: verified `bestnightlifethailand.com` in Resend (ready to send), added `RESEND_FROM_BNT` and `NEXT_PUBLIC_BNT_APP_URL` to Vercel (Preview + Production), redeployed.

**1. Source-of-truth verification (7A) — clean, zero discrepancies:** branch `claude/phase4c-content-media-audit-dvu5c1` HEAD confirmed `da87099` (Phase 6's own closing commit); `origin/main` confirmed `8090708`, unchanged, 7 commits behind this branch. Live Supabase (`oomhftxgvikzxlvqdcmr`) reconfirmed byte-identical to Phase 6's closing record: `new-in-bkk` — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, `default_price=490`, `early_bird_price=390`, `early_bird_cutoff_hours=48`, 12 open Wednesday `event_dates` (2026-09-02→2026-11-18) + 1 closed historical Tuesday (2026-09-01); `bangkok-club-crawl` — `visible_bcc=true`, both tier columns still NULL; `bookings` — still exactly 8 rows, all with `storefront`/`price_tier` still NULL (zero real bookings created by any prior session's testing). Phase 6's storefront-branding architecture confirmed actually present in code, not just documented: `brandFor`/`resendFromHeader`/`STOREFRONT_BRAND` (`lib/storefrontBrand.ts`) are imported by all four email templates (`confirmation.ts`, `cancellation.ts`, `reschedule.ts`, `confirmed-meetup.ts`), all five caller routes (`webhook`, `cancel-booking`, `reschedule-booking`, `resend-confirmation`, `send-confirmed-meetup`), `/book`, `/booking-success`, `/ticket/[token]`, `/events/[slug]`, and `/new-in-bangkok`; `lib/bookingResolution.ts` now selects `storefront`. `RESEND_FROM_BNT` and `NEXT_PUBLIC_BNT_APP_URL` are exactly the two env var names the code actually reads (`lib/storefrontBrand.ts:81-82`, `lib/appUrl.ts:51`) — Guide's manual Vercel additions match the code's real contract, not a guessed name.

**2. Vercel environment-variable audit (7B) — full classification, 22 rows / 16 distinct names, via `vercel env ls` (names/scopes only) cross-referenced against every `process.env.X` reference in the repo:**

| Variable | Scope(s) | Class | Why |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Prod+Preview | **A** | `getServiceSupabase()`/client init, 6 files — everything breaks without it |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod+Preview | **A** | client-side Supabase init, 5 files |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod+Preview | **A** | server-side Supabase, bypasses RLS — the anon-key/RLS item already tracked in [[bcc-security-tech-debt]] |
| `STRIPE_SECRET_KEY` (Prod+Preview, 60d) | Prod+Preview | **A** | `lib/stripe.ts` Stripe client init — every checkout/webhook path |
| `STRIPE_SECRET_KEY` (Preview, branch `phase4-stage0-baseline`, 6d) | Preview, 1 branch | **D** | redundant override on a dead branch — see item 3 |
| `STRIPE_WEBHOOK_SECRET` (Production, 60d) | Production | **A** | `app/api/webhook/route.ts` signature verification — production Stripe webhook breaks without it |
| `STRIPE_WEBHOOK_SECRET` (Preview, all branches, 19h) | Preview (generic) | **B** | same route, Preview scope — added ~19h ago, timing matches the prior session's real Stripe E2E Preview test (Stage 9m); likely still wanted for Phase 8's real ฿390 E2E test — confirm with Guide it's the correct/current Preview webhook endpoint secret before relying on it again |
| `STRIPE_PRICE_WEEKDAY` | Prod+Preview | **A** | `lib/stripe.ts::getPriceId()` — legacy checkout fallback path (still live whenever `CHECKOUT_DYNAMIC_PRICING` is off) |
| `STRIPE_PRICE_WEEKEND` | Prod+Preview | **A** | same function — also covers `saturday-signature` (mapped into the weekend bucket) |
| `STRIPE_PRICE_SIGNATURE` | Prod+Preview | **D** | **provably unused** — `getPriceId()` only ever returns `STRIPE_PRICE_WEEKEND` or `STRIPE_PRICE_WEEKDAY`; `'saturday-signature'` is in the *weekend* array, so no code path ever reads this var. Confirmed via full-repo grep, zero references outside `.env.example`. Leftover from a collapsed 3-tier→2-tier pricing scheme. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Prod+Preview, 60d) | Prod+Preview | **D** | **provably unused** — zero references anywhere in the repo, and `package.json` has no `@stripe/stripe-js` (or any client Stripe) dependency. The app only ever does server-side Stripe Checkout Session redirects; no client-side Stripe.js is loaded, so a publishable key was never needed. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Preview, branch `phase4-stage0-baseline`, 5d) | Preview, 1 branch | **D** | same unused var, plus a dead branch (item 3) — doubly safe to remove |
| `CHECKOUT_DYNAMIC_PRICING` (Production, 8d) | Production | **A** | `app/api/create-checkout/route.ts:41` — the live dynamic/legacy checkout switch. **Its actual current value could not be read this session** — this sandbox's Bash tool redacts decrypted secret values on `vercel env pull` (returned empty for every var tested, not specific to this one), which is the correct safety boundary and wasn't bypassed. [[bcc-checkout-dynamic-pricing-verify]] — Guide should confirm directly in the Vercel dashboard that this is still `true` (matching the `phase2-checkout-state` memory's record) before Phase 8. |
| `CHECKOUT_DYNAMIC_PRICING` (Preview, branch `claude/stripe-e2e-new-bangkok-1v46mg`, 19h) | Preview, 1 branch | **D** | this branch's HEAD is `8090708` — **byte-identical to `origin/main`** (confirmed via `git log -1`), i.e. it was Stage 9's E2E-test branch, since merged, now redundant with whatever Production's own value is |
| `CHECKOUT_DYNAMIC_PRICING` (Preview, branch `phase4-stage0-baseline`, 6d) | Preview, 1 branch | **D** | this branch (`41db3e4`) is a confirmed ancestor of `origin/main` (`git merge-base --is-ancestor` → true) — fully merged, stale | 
| `RESEND_API_KEY` | Prod+Preview | **A** | Resend client init, 7 files |
| `RESEND_FROM` | Prod+Preview | **A** | `webhook.ts` (BCC admin alert) + `storefrontBrand.ts` (BCC customer sender fallback) |
| `RESEND_FROM_BNT` | Prod+Preview, 8m | **A** | `storefrontBrand.ts::resendFromHeader()` — Guide's fresh addition, code-confirmed to be the exact name read |
| `NEXT_PUBLIC_APP_URL` | Prod+Preview | **A** | `lib/appUrl.ts` default branch, `webhook.ts` dashboard link, `create-checkout`'s legacy-path `appUrl` |
| `NEXT_PUBLIC_BNT_APP_URL` | Prod+Preview, 7m | **A** | `lib/appUrl.ts::getAppUrl('bnt')` — Guide's fresh addition, code-confirmed; currently dormant/safe (falls back to the same default until DNS cutover) |
| `ADMIN_NOTIFY_EMAIL` | Prod+Preview | **A** | `webhook.ts` — internal founder-inbox alert on every booking |
| `NEXT_PUBLIC_DASHBOARD_PASSWORD` | Prod+Preview | **D** | **provably unused** — zero references anywhere in the repo. Admin auth is Supabase Auth + the `admin_users` table (`lib/admin-auth.ts`, `middleware.ts`), confirmed live — this is a leftover from a pre-Supabase-Auth shared-password gate. Doubly worth removing since it's `NEXT_PUBLIC_`-prefixed (shipped into the client bundle if it were ever read). |

**3. What "D" means here, precisely — nothing was deleted:** 7 rows across 5 distinct configurations are provably dead by direct code/branch evidence, not by name-guessing: `STRIPE_PRICE_SIGNATURE`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (both instances), `NEXT_PUBLIC_DASHBOARD_PASSWORD`, and the three branch-scoped Preview overrides on `claude/stripe-e2e-new-bangkok-1v46mg` (identical to `main`) and `phase4-stage0-baseline` (a merged ancestor of `main`) — `CHECKOUT_DYNAMIC_PRICING`×2, `STRIPE_SECRET_KEY`×1, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`×1. Per this session's explicit instruction, none were removed — recommended for Guide's approval, not actioned. Both branches themselves (not just their env overrides) still exist on `origin` — deleting either the branches or their overrides is a separate decision from this audit and wasn't done.

**4. Operationally important finding, not a "delete" item — no generic Preview-wide `CHECKOUT_DYNAMIC_PRICING`:** every `CHECKOUT_DYNAMIC_PRICING` Preview override is branch-scoped to one of the two stale branches above; there is no catch-all Preview value. This means **the current working branch's own Preview deployments (including the one this session tested) run the legacy checkout path, not the dynamic/storefront-aware/Early-Bird path**, unless Guide adds a matching Preview override for `claude/phase4c-content-media-audit-dvu5c1` (or a generic Preview-wide value). This is why Phase 7D's checkout/pricing verification (below) had to stop at the code level — it could not be exercised live on Preview as-is. Flagged for Guide, not fixed — adding an env var is a config change this session's "no changes without approval" boundary correctly kept out of scope.

**5. Configuration consistency audit (7C) — no correctness issues found:** grepped every hardcoded `bkkclubcrawl.com`/`bestnightlifethailand.com`/sender-email occurrence in the repo. All are either intentional (the legacy checkout path's own `NEXT_PUBLIC_APP_URL` fallback, `lib/appUrl.ts`'s own designed default, cross-brand footer/landing-page links between the two sister sites, internal-admin-only dashboard text) or cosmetic/low-priority (`lib/calendarLinks.ts`'s `.ics` UID suffix is always `@bkkclubcrawl.com` regardless of storefront — an arbitrary iCal UID domain with no customer visibility or functional effect, not worth changing). One naming inconsistency, not a bug: `app/api/contact/route.ts` and `app/api/vip-inquiry/route.ts` read `process.env.ADMIN_EMAIL`, which was never actually set in Vercel (only `ADMIN_NOTIFY_EMAIL` exists, used by a different route) — both routes always fall back to the correct hardcoded `bestnightlifethailand@gmail.com`, and both are BNT-only routes (BCC has no contact/VIP-inquiry page), so the fallback is the right value regardless. No accidental Preview→Production or Production→Preview URL bleed found; `lib/appUrl.ts`'s own `VERCEL_ENV==='preview'` branch (from Phase 5) still correctly overrides both storefronts to the Preview's own URL.

**6. BNT Preview QA (7D) — what could and could not be verified live, and why:** Vercel Deployment Protection (SSO) is enabled on this project for `all_except_custom_domains` — every `*.vercel.app` URL (Preview and even Production's own vercel.app alias) requires an SSO bypass token; only the real custom domains (`bkkclubcrawl.com` etc.) are ungated. Obtained a 23h shareable bypass link for the Preview deployment matching this session's exact HEAD (`dpl_AjdbSvWR3tNamQeDqRUKbw8qyfXe`, confirmed via `githubCommitSha: da87099...` in its own metadata) and used the in-app Browser tool against it — a real, live deployment, not `next dev`. **Tried and confirmed does NOT work against real Vercel infrastructure:** the `curl -H "Host: ..."` spoofing technique Phase 4/5's own sessions used successfully against local `next dev` — Vercel's edge rejects any Host header that doesn't match a known alias for the deployment with a flat `403`, before the request ever reaches the Next.js app. This means **`resolveStorefront()` cannot be driven to `'bnt'` on any Preview or `*.vercel.app` URL** — only a real custom domain resolves to `'bnt'`, and `bestnightlifethailand.com` isn't pointed at this Vercel project yet (Phase 8). Consequently `/about`, `/contact`, `/new-in-bangkok`, `/events/new-in-bkk` all correctly 404 on the Preview URL (host resolves to `'bcc'`, and both `/about`/`/contact` explicitly `notFound()` on any non-`'bnt'` host) — this is the code working exactly as designed, not a bug, and matches Phase 4's own documented limitation.
   - **What WAS verified live, via `/bnt-preview`** (Phase 3's own dev/QA aid — renders `BntLandingPage` regardless of Host header, explicitly built for exactly this constraint): homepage hero, logo, "PRIVATE ACCESS COLLECTIVE" tagline, hamburger nav drawer (Home/About/Contact links present and correctly pointed, though About/Contact themselves 404 on this host per above — an inherent limitation of this test-only route, not a defect), the "Our Signature Events" section with a correct outbound cross-brand link to `https://www.bkkclubcrawl.com` on the Bangkok Club Crawl card, and the full 4-step Private Experience inquiry modal (name/WhatsApp+country-code/occasion → date/group-size/vibe → budget/notes → confirmation) — confirmed present with all real form fields via the accessibility tree, not submitted (per this session's "no real customer data" instruction). Mobile viewport (375×812) reflow confirmed clean — logo, hamburger, headline, and CTA all render correctly with no overlap. One non-blocking cosmetic observation: the "Private Experiences" swipeable carousel section rendered as a solid black viewport in automated screenshots at certain scroll positions despite its images loading successfully (200s) and its full DOM/content being present and correct per the accessibility tree and console had no related errors — most likely a headless-browser-only animation/IntersectionObserver timing quirk, not a real customer-facing bug, but worth Guide's own quick look in a real browser before launch.
   - **What was NOT verifiable, and exactly why:** `/new-in-bangkok` ProductPage rendering (Wednesday schedule, Early Bird ฿390/Regular ฿490 display, cutoff behavior), `/book`'s BNT-branded chrome (logo/tag swap), checkout's storefront-aware routing, and BNT success/cancel URLs — all require either a real `bestnightlifethailand.com` request (not available pre-cutover) or the existing admin-authed `/dashboard/products/{id}/preview` route (id `75466d68-23b6-45a9-bc68-96f002fb6b1e`, per Phase 4's own precedent) — this session has no admin Supabase Auth credentials and did not attempt to guess or create any, so this route was not exercised. All of this was instead verified at the **code level only** (below), matching every prior Stage 10 session's own honest precedent for what a sandbox without real credentials can and cannot prove.

**7. Early Bird pricing — code-level re-verification only, not live (7D cont'd):** `lib/pricing.ts::resolveEventPricing()` is unchanged since Phase 5 (confirmed via `git diff` — no Phase 7 code edits exist at all, this was audit/QA only). Its 7/7 unit-test result and 4-call-site sharing (booking calendar, ProductPage, admin preview, checkout) already stand from Phase 5's own verification; nothing here contradicts or need re-prove that logic since no code changed. What Phase 7 adds is the operational finding in item 4 above — the mechanism is sound, but exercising it live on this branch's own Preview deployments needs the missing `CHECKOUT_DYNAMIC_PRICING` override first.

**8. `/book` BNT-branding QA — code-level only:** `BookingCalendarClient.tsx`'s `storefront` prop and `brandFor()`-driven logo/tag swap (Phase 6, item 3 of that section) is unchanged since Phase 6 — re-confirmed present by direct code read, not re-tested live for the same Host-header reason as item 6. Live-verified instead: **BCC's own `/book` on this exact Preview deployment** — real calendar, Friday Aug 28 → "TGIF Bangkok, ฿1,200 per person, Book Now — ฿1,200", zero Early Bird markup anywhere (correct — `bangkok-club-crawl` has no tier columns set) — a clean, live regression proof that Phase 5/6's shared-component changes didn't alter BCC's real checkout-facing pricing display.

**9. Email sender/branding QA (7E) — code-level only, no email sent:** re-confirmed via direct code read (not a live send — this sandbox has no `RESEND_API_KEY` locally and sending a real test email needs Guide's explicit go-ahead per this session's own instruction) that all four templates + five caller routes are wired through `brandFor()`/`resendFromHeader()` exactly as Phase 6's own checkpoint entry describes (see item 1's file list). Not re-derived from scratch — Phase 6's own per-item audit trail (its items 5-9) already covers the confirmation/cancellation/reschedule/resend-confirmation/confirmed-meetup contract in full; Phase 7 only re-confirmed the code is still there, unmodified, and that `RESEND_FROM_BNT` is now actually set in Vercel so BNT email should — pending Guide's own live confirmation, not tested here — start resolving the `storefront==='bnt'` branch of `resendFromHeader()` for real instead of always falling back to `RESEND_FROM`'s address. **No test email was sent this session** — if Guide wants one, it would go through the real `RESEND_FROM_BNT` address to a Guide-specified test recipient via a real booking or the `/dashboard/email-preview/[token]` route; ask before doing this, per this session's own instruction on customer-facing sends.

**10. BCC regression (7F) — live-verified on the same Preview deployment:** homepage (`/`) renders correctly (BCC branding, hero, "Book This Weekend — ฿1,200" CTA, listed-on logos). `/book` calendar renders correctly (see item 8). Both confirm zero visual/behavioral regression from Phase 5/6/7's storefront-branding work, on a real deployed build of this exact HEAD, not just `next dev`. Dashboard auth gate, Products, Host Operations, ticket/QR architecture, and the Stripe webhook contract were **not** live-tested this session (would need admin credentials or a real booking, neither available/appropriate here) — re-confirmed only at the code level (unchanged since Phase 6, no Phase 7 code edits at all).

**11. What could not be verified, summarized:** (a) `CHECKOUT_DYNAMIC_PRICING` Production's actual literal value (secret-value redaction, by design — see item 2); (b) any BNT-storefront-resolved live page (`/new-in-bangkok`, `/about`, `/contact`, `/book` BNT chrome, checkout routing, ticket/QR, transactional email) — blocked by Vercel's Host-header enforcement + no admin credentials, not a code defect; (c) a real BNT confirmation/cancellation email; (d) a real ฿390 Stripe Early Bird charge — none attempted, per explicit instruction.

**12. Exact remaining manual actions for Guide, in order:**
   - Confirm `CHECKOUT_DYNAMIC_PRICING`'s actual current Production value directly in the Vercel dashboard (this session could not read it).
   - Decide on the 7 "D" env-var rows above (§2-3) — approve or reject each before any deletion; this session deleted nothing.
   - Decide whether to add a Preview-scoped `CHECKOUT_DYNAMIC_PRICING=true` override for `claude/phase4c-content-media-audit-dvu5c1` (or a generic Preview value) so future sessions can actually exercise the dynamic/Early-Bird checkout path live on Preview — currently impossible on this branch's own deployments (item 4).
   - Personally visually check the BNT Preview experiences carousel in a real browser (item 6's cosmetic observation) — not confirmed to be a real bug, but not fully ruled out from this sandbox either.
   - When ready to actually verify `/new-in-bangkok`, checkout routing, and Early Bird pricing live (rather than at the code level), either provide admin Supabase Auth credentials for `/dashboard/products/{id}/preview`, or proceed straight to Phase 8's real domain cutover + real E2E test, per the original Phase 7 brief's own sequencing.

**13. GO/NO-GO for Phase 8: GO for continued infra prep** (env-var cleanup once Guide approves the "D" list, confirming `CHECKOUT_DYNAMIC_PRICING`'s Production value, deciding the Preview-override question). **NO-GO for the real domain cutover / publish / real ฿390 E2E test** until: (a) Guide has completed the manual actions in item 12, (b) the BNT customer journey has been visually verified by a human in a real browser (this session's Preview-only, no-DNS constraint means the full BNT journey — pricing, `/book` chrome, checkout, ticket — still has never been seen rendered end-to-end with real branding, by anyone, since Phase 4), and (c) Guide gives explicit go-ahead for the real Stripe E2E purchase per Phase 7's own stop gate. Nothing was merged to `main`, deployed to Production, published, changed in DNS, or deleted (env vars or otherwise) this session.

### Phase 7 — follow-up: env cleanup verification — COMPLETE, applied 2026-08-24 (same day, later session), NOT merged/deployed

**Session scope:** verify Guide's manual Vercel env cleanup (done between sessions, based on the audit above), confirm the new generic Preview `CHECKOUT_DYNAMIC_PRICING` is actually live, run BCC regression, determine what's newly testable for BNT. One non-code, non-destructive action taken: triggered a fresh Preview deployment via `vercel deploy` (CLI) — no source changed, same already-pushed commit `4a6da5d`.

**1. Cleanup verified byte-for-byte correct — nothing required by the code was removed:** re-ran `vercel env ls`; current inventory is 16 rows / 14 distinct names, down from 22/16. The exact 7 rows this session's own prior audit flagged as dead are the exact 7 gone: `STRIPE_PRICE_SIGNATURE`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (both instances), `NEXT_PUBLIC_DASHBOARD_PASSWORD`, and the three branch-scoped Preview overrides on the two dead branches. One row added: a **generic (no branch) Preview `CHECKOUT_DYNAMIC_PRICING`**, closing the exact gap flagged in the prior entry's item 4. All 14 vars the code actually reads (Supabase ×3, Stripe ×5 incl. both `STRIPE_WEBHOOK_SECRET` scopes, Resend ×3, app-URL ×2, `ADMIN_NOTIFY_EMAIL`) are still present. Confirmed via direct diff against the full-repo `process.env.X` reference list already compiled in the prior audit — no re-grep needed, nothing changed in code this session.

**2. Found and fixed a real gap: the "redeployed" Preview build was still stale.** Vercel snapshots env vars into a deployment at BUILD time, not read live — a deployment built before an env var change doesn't see it without a fresh build. The Preview deployment that existed when this session started (`dpl_HguDauKxUHFk5KDKh3KiLCzU8VRi`, built ~17 min before this session, i.e. ~7 min *before* the new Preview `CHECKOUT_DYNAMIC_PRICING` row's own "created" timestamp) was confirmed **still running the legacy path** via a safe differential test: `POST /api/create-checkout` with `{eventId: <fake-uuid>, quantity: 0}` — zero Supabase/Stripe calls either way, just a routing decision. Dynamic path returns `400 "Invalid quantity"` (fails the qty guard inside `createDynamicCheckout`); legacy path returns `400 "Missing required fields"` (fails `createLegacyCheckout`'s own `nightSlug`/`eventDate` requirement, since only `eventId` was supplied). The stale deployment returned **"Missing required fields"** — legacy path, despite the var existing in Vercel. Triggered a fresh Preview build via `vercel deploy` (no `--prod`) from the already-clean working tree — `dpl_33BNpVpHs5ABYV4UbcU8L5mJ198m`, confirmed via its own metadata to be commit `4a6da5d` on this branch. Same differential test against the fresh build returned **`"Invalid quantity"`** — dynamic path confirmed genuinely active. **Actionable takeaway for Guide:** after any future env var change intended for Preview, a *new* deployment (not just "a redeploy that happened to predate the edit") is required before it takes effect — check the deployment's own build timestamp against the var's "created"/"modified" timestamp in `vercel env ls` if in doubt.

**3. Production dynamic path independently reconfirmed live**, same differential test, no SSO bypass needed (custom domains are ungated): `POST https://www.bkkclubcrawl.com/api/create-checkout` with the identical fake-eventId/qty-0 body → `"Invalid quantity"` — dynamic path, matching [[phase2-checkout-state]]'s original record (now re-confirmed by behavior, not just by an unreadable encrypted value). Neither test created a Supabase row, called Stripe, or touched a real booking.

**4. BCC regression — live-verified on the fresh Preview build:** homepage renders correctly (byte-identical to before). `/book` calendar: Friday Aug 28 → "TGIF Bangkok, ฿1,200 per person, Book Now — ฿1,200", zero Early Bird markup (correct, `bangkok-club-crawl` has no tier columns). `GET /api/events?storefront=bcc` (read-only) returns the expected tier-aware shape (`priceTier: "regular"` on every BCC event). `GET /api/events?storefront=bnt` (read-only) returns **zero events** — `new-in-bkk`'s Draft gate holds correctly even queried by an explicit `storefront` param on a non-BNT host (this endpoint isn't host-gated the way checkout is, but the `status='active'` gate still blocks it regardless of which storefront is asked for). All four checks: zero regressions, zero side effects.

**5. What's newly testable for BNT before domain cutover: nothing live-browsable, same constraint as before — the fix was structural, not a new test surface.** Vercel's Host-header rejection and SSO protection on `*.vercel.app` URLs are unrelated to env vars and unchanged this session; `resolveStorefront()` still can't be driven to `'bnt'` without a real `bestnightlifethailand.com` request or admin credentials for `/dashboard/products/{id}/preview`. What DID change: the *correct* code path (storefront-aware, Early-Bird-aware) is now the one that will actually execute once a BNT host request does arrive, instead of silently falling back to flat legacy pricing with no storefront gate — a latent bug that would have made any future BNT Preview QA quietly wrong. One incidental finding worth flagging for Phase 8 QA planning, not actioned here: `/api/events` accepts `storefront` as a plain query parameter (not host-derived) since it's read-only with no purchase risk — once `new-in-bkk` is actually published (`visible_bnt=true`, a Phase 8 decision, not done here), its Early Bird/Regular pricing data will be readable via a simple `GET ?storefront=bnt` from any host, without needing DNS cutover first, giving Guide a lighter-weight verification option than a full checkout dry-run.

**6. `STRIPE_PRICE_WEEKEND`/`STRIPE_PRICE_WEEKDAY` — explicit answer to Guide's question:** yes, still a genuine runtime dependency of the existing code — `createLegacyCheckout()` (`app/api/create-checkout/route.ts:296-297`) calls `lib/stripe.ts::getPriceId()`, which reads exactly these two vars and nothing else. Confirmed both Production and Preview are **currently** running the *dynamic* path (item 2-3 above), so neither var is on the actively-executing path in either environment today — but the legacy function itself, and its own code comment (`"Retained behind the rollback flag until the dynamic path is proven in production, then removed separately"`), make clear these are the designed instant-rollback mechanism: flip `CHECKOUT_DYNAMIC_PRICING` off in Vercel and this code path (and these two vars) is what actually charges the next real BCC booking, with zero redeploy needed. **Recommendation: KEEP both, do not touch.** They should be retired only in a dedicated later migration that removes `createLegacyCheckout()`/`getPriceId()` from the code itself — deleting just the env vars while the rollback code still reads them would silently turn the rollback switch into a 500 error the next time anyone needed it. Not a Phase 7 or Phase 8 action item; flagged for whenever Guide is confident the dynamic path never needs an emergency rollback again (likely well after BNT's own cutover has proven stable too, not before).

**7. Nothing else changed:** no code edited, no DB writes, no real Stripe session created (both differential tests fail before any Stripe API call), no branches deleted, `new-in-bkk` reconfirmed Draft/`visible_bnt=false` throughout (via the read-only `/api/events?storefront=bnt` check in item 4). The one new artifact from this session is the fresh Preview deployment itself (`dpl_33BNpVpHs5ABYV4UbcU8L5mJ198m`), created solely to verify env-var propagation — not a promotion, not a merge, not aliased to any production domain.

**8. GO/NO-GO for Phase 8, updated: GO for the env-cleanup track — fully closed.** All 7 flagged rows removed exactly as recommended, the missing Preview override added and verified genuinely active, Production reconfirmed genuinely active, zero regressions found, `STRIPE_PRICE_WEEKEND`/`WEEKDAY` correctly left alone pending a later dedicated migration. **NO-GO still stands for the real domain cutover / publish / real ฿390 E2E test** — this session changed infrastructure config and verified it, but did not and could not add to what's live-visually-verifiable for the BNT customer journey (item 5); that gap is unchanged from the prior Phase 7 entry and still needs either admin credentials or the real DNS cutover itself to close.

### Phase 6 — BNT customer journey + transactional identity — COMPLETE, applied 2026-08-24, NOT merged/deployed

**Session scope, explicitly bounded:** Phase 6 ONLY — make a BNT-originated booking (ProductPage → `/book` → Stripe → booking-success → confirmation/cancellation email → ticket/QR) read as a BEST Nightlife Thailand experience end to end, while BCC's live journey stays provably unchanged. No pricing redesign (Phase 5's `resolveEventPricing()` untouched), no publish, no DNS/domain changes, no merge to `main`, no production deploy, no real Stripe payment.

**Verified before writing any code (source-of-truth-first):** branch `claude/phase4c-content-media-audit-dvu5c1` HEAD was exactly `4114d6b` (Phase 5's own final commit) at session start; `origin/main` reconfirmed at `8090708`, unchanged, 5 commits behind this branch; live Supabase (`oomhftxgvikzxlvqdcmr`) reconfirmed `new-in-bkk` — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, `early_bird_price=390`, `early_bird_cutoff_hours=48`, `default_price=490`; `bangkok-club-crawl` both new-tier columns still NULL; `bookings` row count still exactly 8 (unchanged from Phase 5's own closing record — zero rows created by any Phase 5 or Phase 6 testing). A full read-only audit of the existing implementation (via a search subagent, then re-verified directly by reading every file myself) preceded any edit — see item 1 below for what it found.

**1. What the pre-Phase-6 audit found, read directly from code:** `resolveStorefront(host)` (Phase 2) and the `bookings.storefront`/`price_tier` columns (Phase 5) already existed and were already correctly threaded through checkout/Stripe/webhook — Phase 5's own audit trail (section 6 above) was accurate. What Phase 5 explicitly deferred (its own item 11/12) was real: `/book`'s visual chrome (BCC logo, `DEFAULT_PRESENTATION` fallback tag hardcoded to `'BANGKOK CLUB CRAWL'`) was BCC-only regardless of the `storefront` prop it already received; `booking-success` had no storefront awareness of any kind (not even resolved); all four transactional-email templates (`confirmation`/`cancellation`/`reschedule`/`confirmed-meetup`) and their five caller routes had zero storefront parameter, with three of the four hardcoding the literal header string `"BANGKOK CLUB CRAWL"` (`cancellation.ts`, `reschedule.ts`, `confirmed-meetup.ts`) — this is the exact regression Guide observed after cancelling the real Stage 9 New in Bangkok test booking (section 9 of this session's brief); `RESEND_FROM` was a single shared env var with no BNT variant; `resolveBookingByToken()` didn't select `storefront` at all, so the ticket page/QR route couldn't have known a booking's brand even if asked; `ProductPage.tsx` resolved `storefront` at both its call sites (`/events/[slug]`, `/new-in-bangkok`) but only ever used it for the visibility gate, never passed it to the component itself, so it had no way to render a "back to BNT home" link — the exact gap Phase 4's own checkpoint (item under "Design decision made, not defaulted into — BNT chrome") flagged and left open. `BntNav`/`BntFooter` (Phase 3's ported BNT chrome) take no branding props and are only ever imported by the three static BNT marketing pages — never by anything in the booking journey; reusing them as-is inside `/book`'s or the ticket page's existing custom dark-theme layouts was rejected for the same reason Phase 4 rejected it in `ProductPage` (`BntNav`'s fixed-position hamburger button collides with the logo every one of these pages already renders in the same top-right corner).

**2. Storefront-branding architecture chosen, and why:** one new module, `lib/storefrontBrand.ts` — a `Record<Storefront, StorefrontBrand>` (`STOREFRONT_BRAND`) holding every presentation fact per brand (display name, header eyebrow tag, logo path, home link, support WhatsApp/email, footer domain, Resend sender display name), plus two pure functions: `brandFor(storefront)` (defaults anything not `'bnt'` to `'bcc'`, matching every other storefront default already in this codebase — `resolveStorefront()`'s own host fallback, `getAppUrl()`'s default parameter) and `resendFromHeader(storefront)` (builds the Resend `from` header, see item 6). Chosen over duplicating brand strings per call site (what every pre-Phase-6 file already did, which is exactly how the cancellation-email regression happened — one of four templates missed the memo) and over a heavier per-brand theme/component system (rejected as materially larger than this requirement — nothing here needs different fonts, layouts, or component trees per brand, only different names/logos/links/contacts against the SAME shared UI, matching this session's own "shared components + storefront context = correct brand presentation" principle). WhatsApp number is identical for both brands (`https://wa.me/66660399569`) and BNT's support email (`bestnightlifethailand@gmail.com`) — neither invented: both are the exact values already live on the ported `components/bnt/BntContactPage.tsx`, confirmed by reading that file rather than guessing.

**3. `/book` calendar/booking surface — what changed for BNT, what stayed for BCC:** `BookingCalendarClient.tsx`'s nav logo (`<img src={brand.logoSrc}>`, was hardcoded `/images/bcc-logo.png`) and its per-event marketing tag fallback (`presentationFor(slug, storefront)`, was a single hardcoded `DEFAULT_PRESENTATION = {tag: 'BANGKOK CLUB CRAWL', ...}`) now key off the `storefront` prop the component already received from `app/book/page.tsx` (Phase 5's own server/client split) but never used for chrome. `PRESENTATION`'s two explicit per-slug entries (`tgif`, `saturday-signature`) are untouched — those still render their own specific tags regardless of storefront, exactly as before; only the *fallback* (hit by `new-in-bkk`, which has no explicit entry) is now brand-correct instead of always saying "BANGKOK CLUB CRAWL". Nothing else in this file changed — same calendar grid, same pricing display (Phase 5's Early Bird/Regular rendering untouched), same checkout call. **BCC regression proof:** `bkkclubcrawl.com` resolves `storefront='bcc'` exactly as it always did, `brandFor('bcc')` returns the literal same logo path and tag string the file previously hardcoded — byte-identical output, confirmed by live Host-header sweep (item 9).

**4. `booking-success` — how it determines BNT vs BCC:** split into a server wrapper (`app/booking-success/page.tsx`, new — resolves `storefront` from the request's own Host header via `resolveStorefront()`, the identical pattern Phase 5 established for `/book`) and a client component (`app/booking-success/BookingSuccessClient.tsx`, the pre-existing polling/Pixel/UI logic, now taking `storefront` as a prop instead of hardcoding everything). This is presentation-only, not a security boundary — the booking itself, and its own persisted `storefront` column, were already written by `create-checkout`/the webhook independently, before the customer ever lands on this page; nothing this page resolves can retroactively change what was actually purchased. BNT gets a **generic** "what happens next" (check email → ticket has meeting point/timing → show ticket/QR at check-in) and a **generic** headline ("You're in. See you out there.") — deliberately NOT reusing BCC's "WhatsApp group by 7 PM" / "arrive 9:30 PM" copy, per this session's explicit instruction, since New in Bangkok (and any future BNT product) doesn't share BCC's specific run-of-show format. BCC's copy (headline, 3-step WhatsApp/9:30-PM next-steps, "Back to Bangkok Club Crawl") is the exact pre-existing literal text, now sourced from `brand`/a `storefront==='bnt'` branch rather than being the only text that existed — confirmed byte-identical for `storefront==='bcc'` by direct code diff (the BCC branch of every conditional reproduces the prior unconditional value exactly). The Meta Pixel `fbq()` call is untouched and still fires unconditionally in this component — it's a no-op on the BNT host because `window.fbq` is never defined there (Phase 3's `app/layout.tsx` `isBcc` gate, confirmed unaffected by this session — see item 9), not because of a new check added here.

**5. Every transactional email path audited (all five caller routes, all four templates):**
- `app/api/webhook/route.ts` (confirmation email + internal admin alert) — `storefront` was already resolved here from Stripe metadata (Phase 5); now also normalized to a `Storefront` type (`meta.storefront === 'bnt' ? 'bnt' : 'bcc'`) and threaded into `generateConfirmationEmail({...})` and `resendFromHeader()`. The internal admin alert (Guide's own inbox, not customer-facing) keeps its existing "BCC Bookings" sender identity — only its subject line gained a `[BCC]`/`[BNT]` prefix for Guide's own operational clarity, a small, low-risk, non-customer-facing addition.
- `app/api/cancel-booking/route.ts`, `app/api/reschedule-booking/route.ts`, `app/api/resend-confirmation/route.ts` — each already `select('*')`s the full booking row (so `booking.storefront` was already in scope, just never read); each now normalizes it the same way and threads it into its template call + `resendFromHeader()`.
- `app/api/send-confirmed-meetup/route.ts` — the one path that batches guests from BOTH `bookings` (has `storefront`) and `ota_bookings` (confirmed via `information_schema.columns` — no `storefront` column exists on that table at all, it's an external-channel-only integration with no BNT concept). Branches **per guest**, not per request: each `bookings` guest gets their own row's real storefront, each `ota_bookings` guest defaults to `'bcc'` (matching that table's real-world exclusivity to BCC today, the same default this codebase already uses everywhere a value is absent).
- Templates (`emails/confirmation.ts`, `cancellation.ts`, `reschedule.ts`, `confirmed-meetup.ts`) — each gained an optional `storefront?: Storefront | null` parameter, defaulting through `brandFor()` to `'bcc'`. **Every pre-Phase-6 call site that doesn't pass this parameter is byte-identical to before** — confirmed by direct diff, not just assumption, since `brandFor(undefined)` resolves to the exact same literal strings each template previously hardcoded.

**6. How confirmation-email branding works (a deliberately different treatment than the other three):** the audit found `confirmation.ts`'s header eyebrow already read the literal string `"BEST NIGHTLIFE THAILAND"` — unconditionally, for every booking regardless of brand, including today's real BCC bookings. Reading the rest of that template (footer: `© 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok`) confirmed this isn't a bug to fix — `"BEST Nightlife Thailand"` is the true parent/umbrella company identity (Sanctuary Nexus Co., Ltd.'s consumer-facing name), correctly shown on every booking of either brand today, same as an invoice showing the legal entity above the specific product line. Changing that string to be brand-conditional would have been a real, unrequested change to BCC's live confirmation-email appearance — exactly the kind of regression this session was told to avoid. So the header eyebrow was left untouched, unconditional, exactly as-is. What WAS a genuine bug: the footer's support **email** (`bangkokclubcrawl@gmail.com`) and **domain** (`www.bkkclubcrawl.com`) were hardcoded regardless of brand — a BNT/New-in-Bangkok customer's confirmation email pointed them at BCC's own contact channel. Both are now `brand.supportEmail`/`brand.siteDomain`. Also updated: the `appUrl` used for the ticket-page CTA link and the inline QR `<img>` src now resolves via `getAppUrl(storefront)` instead of `getAppUrl()` — see item 8 for why this is safe today and what it does once BNT DNS cutover happens.

**7. How cancellation-email branding works (the specific regression fix):** `cancellation.ts`, `reschedule.ts`, and `confirmed-meetup.ts` all hardcoded the literal header eyebrow `"BANGKOK CLUB CRAWL"` and a `<title>...— Bangkok Club Crawl</title>` — unlike `confirmation.ts`, these three are NOT the neutral umbrella identity, they are BCC's own consumer brand name, hardcoded regardless of which brand the booking actually belonged to. This is exactly what Guide observed: cancelling the real Stage 9 New in Bangkok test booking produced a "BANGKOK CLUB CRAWL" email. Fix: all three now render `${brand.shortName}` (`'BANGKOK CLUB CRAWL'` for `'bcc'` — byte-identical to before; `'BEST NIGHTLIFE THAILAND'` for `'bnt'` — the correct identity) in both the `<title>` and the header eyebrow, plus the same footer support-email/domain fix as item 6. `reschedule.ts`'s and `confirmed-meetup.ts`'s BODY copy (the "WhatsApp group chat by 7 PM"/"9:30 PM" and dress-code language) was deliberately left untouched — that's real, BCC-specific operational content describing BCC's actual run of show, and this session has no evidence New in Bangkok (or any future BNT product) uses the same format; rewriting it to a guessed-generic version risked being wrong in a different way. Flagged as a residual gap, not fixed: if/when a BNT product actually triggers a reschedule or confirmed-meetup email, its body copy will still assume BCC's format even though the header/footer will correctly say BEST Nightlife Thailand. Low current risk — New in Bangkok is a fixed-schedule weekly product, not contingent on a minimum headcount, so it may never actually use the confirmed-meetup flow at all; a real reschedule is plausible but hasn't happened yet for any BNT booking.

**8. Sender identity (Resend/RESEND_FROM) — implementation and manual steps still required:** `resendFromHeader(storefront)` (`lib/storefrontBrand.ts`) builds the `from` header. For `'bcc'`: identical to every pre-Phase-6 call site — always `RESEND_FROM`, the one address this app has ever used, with `emailSenderName` (`'Bangkok Club Crawl'`) as the display name — zero change. For `'bnt'`: prefers a new optional env var `RESEND_FROM_BNT` when set; when NOT set (its state today — this session did not, and could not, configure Resend domain verification or DNS), falls back to the SAME `RESEND_FROM` address, but with the correct `'BEST Nightlife Thailand'` display name. This means: **today**, a BNT confirmation/cancellation email already displays "BEST Nightlife Thailand <bcc's-existing-verified-address>" instead of "Bangkok Club Crawl <...>" — a real, immediate identity fix, delivered by code alone. **Manual step still required from Guide, not performed by this session (explicitly out of reach — no DNS/Resend dashboard access from this environment):** verify a `bestnightlifethailand.com` sending domain in the Resend dashboard (add the SPF/DKIM/DMARC DNS records Resend provides at a registrar Guide controls), then set `RESEND_FROM_BNT=booking@bestnightlifethailand.com` (or similar) in Vercel's env vars for this project. Once that's done, BNT email automatically starts sending from the real domain with zero further code change — the code-side selection logic is already complete and tested (build/typecheck clean, both branches read correctly in `lib/storefrontBrand.ts`). Both new env vars are documented with this exact explanation in `.env.example`. **`bestnightlifethailand@gmail.com` was deliberately never used as a Resend "from" address** — a plain Gmail address cannot be domain-verified and Resend will reject or spam-flag it; it's used only as the footer *support/contact* mailto link (a `<a href="mailto:...">`, which has no domain-verification requirement), matching how it's already used on the live `BntContactPage.tsx`.

**9. Ticket/QR branding and URL decision:** `resolveBookingByToken()` (`lib/bookingResolution.ts`) now also selects/returns `storefront` (previously omitted from its `select()` entirely). `/ticket/[token]` (`app/ticket/[token]/page.tsx`) now renders `brand.logoSrc`/`brand.logoAlt` as a small logo above "Your Ticket" (the audit found this page had NO logo or literal brand-name text before — visually anonymous — so this is a genuine new addition, not a swap), and both WhatsApp support links (the cancelled-ticket message and the bottom "Message on WhatsApp" button) now use `brand.supportWhatsappUrl`/`brand.supportWhatsappDisplay` instead of the hardcoded number (same literal number for both brands today, so this is presentation-correctness/future-proofing, not a behavior change). **The QR/check-in lifecycle itself is untouched, per explicit instruction:** the `checkinUrl` embedded inside the actual QR code (`${appUrl}/dashboard/checkin/${token}`) still calls `getAppUrl()` with NO storefront argument — i.e. always resolves to the canonical/production app URL regardless of which brand the booking belongs to. This is deliberate, not an oversight: that URL is a HOST-facing staff tool (gated by the existing `/dashboard` auth middleware), not customer presentation, and creating a second check-in URL/host per storefront would be exactly the "different QR security mechanism by storefront" this session was told not to build. **What DID change:** the CUSTOMER-facing ticket link and inline QR-image `src` inside the confirmation EMAIL (`emails/confirmation.ts`'s `appUrl`, used for `${appUrl}/ticket/${token}` and `${appUrl}/api/tickets/${token}/qr`) now resolves via `getAppUrl(storefront)` instead of `getAppUrl()`. **Decision on which host that resolves to, reported explicitly:** on today's Preview/production reality, `getAppUrl('bnt')` returns the SAME value `getAppUrl('bcc')` does whenever `NEXT_PUBLIC_BNT_APP_URL` is unset (Phase 5's own fallback logic, untouched) — so this change is currently dormant/inert, not observably different yet. Once BNT domain cutover happens and `NEXT_PUBLIC_BNT_APP_URL` is set, BNT customers' ticket links will automatically start pointing at `bestnightlifethailand.com` instead of `bkkclubcrawl.com` with zero further code change — this session's explicit **preference is for the BNT domain to carry BNT customer-facing ticket links** (matching this session's own stated preference for "customer-facing continuity"), implemented now while safely inert, rather than deferred to a second code change at cutover time. `/api/tickets/[token]/qr/route.ts` itself needed NO change — it's a pure PNG generator with no visible branding (confirmed by the pre-change audit), and its own `getAppUrl()` call is the SAME host-facing check-in URL as the ticket page's QR, correctly left alone for the same host-facing-tool reasoning above.

**10. BNT navigation/chrome — what was and wasn't added:** `ProductPage.tsx` gained one new optional prop pair, `backHref`/`backLabel` — renders nothing when absent (every pre-existing caller/prop-shape is unaffected), renders a small `← {backLabel}` link above the product-name in the existing nav bar when present. Wired ONLY for the BNT storefront: `/new-in-bangkok` (which only ever renders for `storefront==='bnt'`, so always passes it) and `/events/[slug]` (which serves both storefronts — only passes `backHref`/`backLabel` when the resolved storefront is `'bnt'`, leaving BCC's rendering of this same shared route completely unchanged, confirmed by direct code read). This closes the exact gap Phase 4's own checkpoint flagged and explicitly left open ("the page has no link back to the BNT homepage/About/Contact... an easy, low-risk follow-up... if Guide wants tighter site integration"). **`BntNav`/`BntFooter` (Phase 3's hamburger-drawer nav + footer) were deliberately NOT wired into any booking-journey page** — same reasoning Phase 4 already established for `ProductPage` (the hamburger's fixed top-right position collides with the logo every one of `/book`, `booking-success`, and the ticket page already render in that same corner) — confirmed this reasoning extends to `/book`'s own nav (which places the BCC/BNT logo in exactly that spot) and the ticket page (no fixed nav today, but adding one would create the same collision risk with the new logo this session added there). The `/book`/ticket-page/booking-success logo IS the BNT chrome — same logo asset (`/bnt/logo/best-nightlife-thailand-logo.png`) `BntFooter.tsx` already uses — just placed inline rather than inside a reused nav component that doesn't fit this page family's layout.

**11. Full regression/test results:**
- `npx tsc --noEmit` — clean, no errors.
- `npm run build` — clean; `/events/[slug]` and `/new-in-bangkok` unchanged at 180 B; `/booking-success` grew from a single client bundle to a 3.69 kB server+client split (same pattern Phase 5 already established for `/book`); `/ticket/[token]` unchanged at 152 B; every pre-existing route still lists, no route disappeared, no new build error.
- **Live Host-header sweep**, `next dev` (this sandbox still has no `.env.local`, the same constraint recorded at every prior stage), via raw `http.request` with an explicit `Host` header:
  - `Host: bkkclubcrawl.com`: `/`, `/book`, `/booking-success`, `/tgif`, `/weekends`, `/solo-night`, `/login` → 200 (unchanged). `/new-in-bangkok` → 404 (unchanged — pure host-string short-circuit, no Supabase needed, per Phase 4's own design). `POST /api/create-checkout` with an empty body → 400 "Missing required fields" (unchanged).
  - `Host: bestnightlifethailand.com`: `/`, `/about`, `/contact`, `/book`, `/booking-success` → 200 (unchanged). `/new-in-bangkok`, `/events/new-in-bkk` → 500, confirmed via the dev server's own stack trace to be the identical pre-existing "no `.env.local`" `supabaseUrl is required` failure at `getServiceSupabase()` — thrown BEFORE either route reaches this session's `backHref`/`brandFor()` code, so not a regression from this session's changes (same failure mode/line Phase 4's own sweep documented for this exact route).
  - `/ticket/fake-token-123` on both hosts → 500, same pre-existing Supabase-env constraint, confirmed via stack trace to fail inside `resolveBookingByToken()` before reaching this session's brand-rendering code.
  - **Direct proof of correct per-host branding** (not just "didn't crash"): `/book`'s raw SSR HTML (no client JS needed — the logo renders unconditionally in the nav, not behind async state) contains `bcc-logo.png` and NOT the BNT logo path on `bkkclubcrawl.com`, and the BNT logo path and NOT `bcc-logo.png` on `bestnightlifethailand.com` — confirmed by direct string search on the raw response body. `/booking-success`'s server-resolved `storefront` prop was confirmed correct per host by inspecting the React Server Component flight payload embedded in the raw HTML (`{"storefront":"bcc"}` for `bkkclubcrawl.com`, `{"storefront":"bnt"}` for `bestnightlifethailand.com`) — its actual branded copy is behind client-side state (`status==='success'`, set synchronously on mount when a `session_id` is present) and so isn't visible in a JS-less raw fetch, but the prop it receives — the only input its branding logic depends on — is proven correct at the source.
  - Meta Pixel gating (Phase 3, unrelated to this session's changes) reconfirmed still intact: `bkkclubcrawl.com`'s `/booking-success` response preloads the Meta Pixel tracking pixel resource hint; `bestnightlifethailand.com`'s does not — the `isBcc` gate in `app/layout.tsx` this session never touched is still correctly excluding BNT.
- **Live Supabase re-verification after all testing:** `new-in-bkk` — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, `early_bird_price=390`, `early_bird_cutoff_hours=48`, `default_price=490` — unchanged. `bookings` row count: still exactly 8 — zero rows created by this session's testing, no real Stripe payment run, no email actually sent (all email-path changes were verified by direct code/type-check inspection, not a live send — this sandbox has no `RESEND_API_KEY`/`.env.local` to send through, and doing so wasn't requested or necessary to verify the branching logic itself).
- **Not run, per explicit instruction:** a real Stripe payment; activating `new-in-bkk`; any DNS/domain change; a merge to `main`; a production deploy.

**12. `new-in-bkk` remains Draft/invisible:** confirmed both before and after all code changes and all testing — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, unchanged throughout, exactly matching Phase 5's own closing record.

**13. Remaining blockers before real BNT production cutover (not this session's job to resolve, listed for Guide):**
- Resend domain verification for `bestnightlifethailand.com` (or another `@bestnightlifethailand.com` sender) + setting `RESEND_FROM_BNT` in Vercel — see item 8. Without this, BNT email still works (correct display name, BCC's verified address) but isn't yet sending from a real BNT domain.
- `NEXT_PUBLIC_BNT_APP_URL` still needs to be set once `bestnightlifethailand.com` actually points at this Vercel project — see item 9. Until then, BNT ticket links silently fall back to resolving the same as BCC's (safe, just not yet the intended final state).
- `reschedule.ts`/`confirmed-meetup.ts` body copy still assumes BCC's specific WhatsApp-group/9:30-PM run of show regardless of storefront — flagged in item 7, not fixed, low current risk since no BNT booking has ever triggered either flow.
- `app/booking-success/page.tsx`'s Meta Pixel value-lookup maps (`nightPriceMap`/`nightNameMap`, flagged by Phase 5 item 11) still don't have a `new-in-bkk` entry and use the stale slug `'new-in-bangkok'` rather than the canonical `'new-in-bkk'` — confirmed still dormant/harmless (Pixel never loads on the BNT host at all), not touched this session either.
- APT 101 Wednesday Ladies Night perks (3 free drinks for women, free entry for men) remain PENDING VENUE CONFIRMATION — not added to any copy this session, reconfirmed unchanged.

**14. GO/NO-GO:** **GO** for continued Preview-only QA and for beginning the manual Resend/DNS infrastructure work in item 8/13. **NO-GO** for real production cutover until: (a) Resend domain verification + `RESEND_FROM_BNT` is live, (b) `NEXT_PUBLIC_BNT_APP_URL`/DNS cutover is complete, (c) Guide has visually verified the BNT booking journey on a real Preview deployment with real Supabase credentials (this sandbox could not — no `.env.local` — see item 11's honest accounting of what was and wasn't directly observable here), and (d) a real end-to-end Stripe test payment is run per this session's own explicit deferral (section 16 of the brief: not before BNT domain cutover + Resend sender + final deployment exist). Nothing in this session was merged to `main`, deployed, published, or changed in DNS.

### Phase 5 — ticket pricing (Early Bird ฿390 / Regular ฿490) + storefront-aware booking/checkout — COMPLETE, applied 2026-08-24, NOT merged/deployed

**Session scope, explicitly bounded:** Phase 5 ONLY — pricing model + storefront-aware checkout/Stripe metadata/webhook threading. No BNT transactional-email branding/sender work (Phase 6), no publish, no DNS/domain changes, no merge to `main`, no production deploy, no real Stripe payment.

**Verified before writing any code (source-of-truth-first, per this session's own instruction):** branch `claude/phase4c-content-media-audit-dvu5c1` HEAD was exactly `40f8b65` (Phase 4's own final commit) at session start, matching this doc's prior record exactly; `origin/main` reconfirmed at `8090708`, unchanged; live Supabase (`oomhftxgvikzxlvqdcmr`) reconfirmed `new-in-bkk` — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, `default_price=490`, 12 open Wednesday `event_dates` (2026-09-02→2026-11-18) + 1 closed historical Tuesday (2026-09-01, still carrying the real cancelled/refunded Stage 9 booking, untouched) — byte-identical to Phase 4's own closing record. One unrelated, pre-existing finding surfaced by this session's `list_tables` call, not caused by this session and out of scope to fix here: `public._migration_p1_audit` has RLS disabled (a leftover migration-audit table, not customer data) — flagged to Guide, not remediated.

**1. Pricing architecture chosen, and why:** two nullable columns on `products` — `early_bird_price integer`, `early_bird_cutoff_hours integer` (CHECK: cutoff is required whenever a price is set) — plus a single pure function, `lib/pricing.ts`'s `resolveEventPricing()`, that is now the ONE place "what does this event cost right now" is computed. Chosen over Stripe Promotion Codes (rejected per explicit instruction — not a real automatic tier, and not server-enforced on a schedule) and over a generic multi-tier pricing-engine table (rejected as materially larger than this requirement — New in Bangkok needs exactly one tier + one cutoff, not an arbitrary number of tiers). A product that never sets `early_bird_price` (every BCC product today, confirmed via direct SQL: `bangkok-club-crawl` has both columns NULL) is never touched by the tiering branch — `resolveEventPricing()` always returns `{tier:'regular', price: regularPrice}` in that case, byte-identical to every pre-Phase-5 price computation. `resolveEventPricing()` is shared by four call sites so none can drift: `app/api/events/route.ts` (booking calendar), `lib/publicProductPage.ts` (ProductPage's `/events/[slug]` + `/new-in-bangkok`), `app/api/admin/products/[id]/preview/route.ts` (admin Draft Preview, kept accurate for QA), and `app/api/create-checkout/route.ts`'s dynamic path (the only security-critical one).

**2. Schema changes:** migration `supabase/migrations/20260824000002_stage10_phase5_pricing_storefront.sql`, applied directly to the live `BCC - Claude` project (no branching, matching every prior stage's precedent) and mirrored into `supabase-schema.sql`. `products.early_bird_price` / `products.early_bird_cutoff_hours` (nullable, opt-in per product). `bookings.storefront` / `bookings.price_tier` (nullable text with CHECK constraints, `bcc`/`bnt` and `early_bird`/`regular` respectively) — populated only by the dynamic checkout path from Stripe Checkout Session metadata the webhook reads back; the legacy checkout path and every pre-Phase-5 booking leave both NULL, same additive/no-backfill convention Stage 9a already established for `event_id`/`product_id`/`ticket_token`. Data-only follow-up (direct SQL, same precedent as Phase 3.5's price update): `new-in-bkk.early_bird_price = 390`, `early_bird_cutoff_hours = 48`. Reconfirmed after: `bangkok-club-crawl` (BCC's live product) still has both columns NULL, total `bookings` row count still exactly 8 (matches the pre-session baseline — zero real bookings created by any of this session's testing).

**3. Early Bird cutoff, exact implementation:** `lib/pricing.ts::resolveEventPricing()` combines an event's own `event_date` + effective start time (`start_time_override ?? default_start_time`) into an absolute instant using an explicit `+07:00` ISO offset (`new Date(\`${eventDate}T${time}+07:00\`)`) — Thailand has no DST, so this is always correct without a timezone library, consistent with this codebase's existing no-tz-library convention (`lib/dates.ts`). Cutoff instant = event start − `early_bird_cutoff_hours` hours. Early Bird is available strictly `now < cutoff` — AT and AFTER the cutoff instant it is unavailable, satisfying "exactly 48 hours before start, Early Bird becomes invalid" literally (the cutoff instant itself is already too late, not the last valid moment). Verified via 7 controlled-clock unit tests (no system clock touched — `now` is an injectable parameter) compiled with `tsc` and run standalone: 7 days before → early_bird; 1s before cutoff → early_bird; exactly at cutoff → regular; 1s after cutoff → regular; 10 minutes before the event itself → regular (still purchasable, confirming Early Bird closing doesn't block the sale, only reprices it); a product with no Early Bird tier → always regular regardless of "now"; two different upcoming Wednesdays evaluated at the same "now" resolve their own cutoffs independently (critical since New in Bangkok has 12 separate weekly instances, each with its own 48h window). All 7 passed.

**4. How the server prevents stale/forged ฿390 checkout:** the browser has never been able to submit a price to this endpoint — `create-checkout` has always computed `unit_amount` from the DB, never from the request body. Phase 5 extends that same principle to the tier: `createDynamicCheckout` (`app/api/create-checkout/route.ts`) calls `resolveEventPricing()` itself, server-side, using the request's own arrival time as `now` and the DB's `early_bird_price`/`early_bird_cutoff_hours`/`event_date`/effective start time — never anything the client sent (the client was never even given a way to send a price or tier). A customer who leaves an Early Bird page open past the cutoff and clicks Buy is silently repriced to the correct current amount (Regular ฿490) — Stripe is charged the authoritative price, not the stale one; Regular remains purchasable at every point up to the event, satisfying "Early Bird must no longer be purchasable, Regular remains available" without needing to reject the whole checkout attempt. Live-verified (see Testing below) that this code path executes cleanly from the quantity guard through the DB query construction, failing closed with the same pre-existing "Booking temporarily unavailable" 503 this sandbox's missing Supabase env has always produced — not a new crash, and not reachable by any prior stage's testing since the storefront-visibility/tier gates didn't exist before this session.

**5. How ProductPage displays ฿390 vs ฿490:** `components/ProductPage.tsx` derives `priceTier`/`regularPriceForDisplay` from `upcomingEvents[0]` (the same `resolveEventPricing()` output threaded through `lib/publicProductPage.ts`). When the next event is in its Early Bird window: the quick-facts price row reads "Early Bird Price — ฿390 / person · Reg. ฿490", the primary CTA button reads "Book Now — ฿390 Early Bird", and the mobile sticky bar gets a small gold "EARLY BIRD" eyebrow above "฿390 · Reg. ฿490". After the cutoff, all three collapse back to exactly their pre-Phase-5 form ("฿490 / person", "Book Now — ฿490 per person", plain sticky price) — zero new markup renders for a product with no Early Bird tier, confirmed by the `isEarlyBird` flag being derived from `price_tier`, which `resolveEventPricing()` only ever reports as `'early_bird'` when the product opted in. No redesign — same design-system component, same existing conditional-rendering pattern, per explicit instruction not to redesign ProductPage. `/book`'s per-date event list (the only place a real ticket purchase for a specific date happens) got the same small treatment: an "EARLY BIRD" tag + "Reg. ฿X" secondary line next to any event still in its window, sourced from `/api/events`'s now tier-aware response.

**6. How storefront identity travels BNT → checkout → Stripe → webhook/booking:** `/book` was split into a server component (`app/book/page.tsx`, resolves `storefront` from the request's own Host header via the existing `resolveStorefront()`, unchanged from Phase 2) and a client component (`app/book/BookingCalendarClient.tsx`, the pre-existing calendar UI, now taking `storefront` as a prop and fetching `/api/events?storefront=${storefront}` instead of the old hardcoded `?storefront=bcc`) — this was the literal bug Phase 4's own checkpoint flagged ("/book's checkout flow is still BCC-storefront-hardcoded"), now fixed. Critically, this prop-threading is NOT the security boundary — `create-checkout` independently re-resolves `storefront` from ITS OWN request's Host header (`resolveStorefront(req.headers.get('host'))`), never trusting anything the client's JSON body could claim (the body still only ever carries `eventId`/`nightSlug`/`eventDate`/`quantity` — no storefront field exists to forge). That resolved storefront then gates product visibility (`product[VISIBILITY_COLUMN[storefront]] !== true` → 409 — this REPLACES the old code, which only ever checked `product.visible_bcc` unconditionally regardless of which host the request came from, a real latent bug this session found and fixed alongside the pricing work since fixing pricing required touching the same gate) and is written into the Stripe Checkout Session's `metadata.storefront` (alongside the new `metadata.price_tier`) together with the pre-existing canonical `product_id`/`event_id`. The webhook (`app/api/webhook/route.ts`) reads both back (`meta.storefront || null`, `meta.price_tier || null`, same null-coercion convention as `event_id`/`product_id`) and persists them onto the new `bookings.storefront`/`bookings.price_tier` columns — giving Phase 6 exactly the per-booking brand signal it needs, without this session redesigning or even touching a single email template or sender identity.

**7. BNT success/cancel routing:** `lib/appUrl.ts`'s `getAppUrl()` gained an optional `storefront` parameter (default `'bcc'`) — every pre-existing call site (`app/ticket/[token]/page.tsx`, `app/api/tickets/[token]/qr/route.ts`, `emails/confirmation.ts`) calls it with zero arguments and is provably unaffected (the default branch is untouched code). `create-checkout`'s dynamic path now calls `getAppUrl(storefront)` instead of its own separate, non-Preview-aware `NEXT_PUBLIC_APP_URL` computation — a real second latent gap this session found (create-checkout never actually used Stage 9's `getAppUrl()` fix at all, despite the doc's own instruction assuming it did) and fixed as part of the same edit. On a real Vercel Preview deployment (`VERCEL_ENV==='preview'`), storefront is deliberately ignored and BOTH storefronts resolve to that Preview deployment's own `VERCEL_URL` — satisfying "do not accidentally send the user to production BNT" by construction, since a BNT-storefront Preview checkout can never be routed to real `bestnightlifethailand.com` (which doesn't even serve this app pre-cutover). On real production, BCC keeps `bkkclubcrawl.com` exactly as before; BNT resolves `NEXT_PUBLIC_BNT_APP_URL` or falls back to `https://bestnightlifethailand.com` — aspirational until DNS cutover, harmless today since `new-in-bkk` stays Draft/invisible so no real traffic reaches that branch. `success_url`/`cancel_url` keep their exact pre-existing shape (`${appUrl}/booking-success?...`, `${appUrl}/book?night=...`) for both storefronts — no new destination routes invented, `/book`'s own chrome (BCC logo/colors) deliberately left unchanged this session (see item 11).

**8. Confirmation existing BCC checkout remains unchanged:** `createLegacyCheckout` (the function BCC's checkout falls back to when `CHECKOUT_DYNAMIC_PRICING` is unset/false) was not touched at all — same function body, same `appUrl` computation, same metadata shape. In `createDynamicCheckout` (the path BCC's production actually runs, per this doc's own recorded `CHECKOUT_DYNAMIC_PRICING=true` state), the new storefront gate is mathematically identical to the old one for any `bkkclubcrawl.com` request: `resolveStorefront('bkkclubcrawl.com')` always returns `'bcc'`, so `VISIBILITY_COLUMN['bcc'] === 'visible_bcc'`, so the new check `product['visible_bcc'] !== true` is the exact same boolean expression the old hardcoded check was — confirmed by direct code inspection, not just assumption. `bangkok-club-crawl`'s pricing is provably unaffected: its `early_bird_price`/`early_bird_cutoff_hours` are NULL (confirmed via live SQL), so `resolveEventPricing()` returns `{tier:'regular', price: regularPrice}` for every one of its events, identical to the pre-Phase-5 `price_override ?? default_price` computation it replaced line-for-line.

**9. Full test/regression results:**
- `npx tsc --noEmit` — clean (one transient stale-`.next/types` error from a temporary debug route was resolved by deleting `.next` and re-running; final state clean with `.next` freshly rebuilt).
- `npm run build` — clean; every pre-existing route still lists at its same size class (`/book` grew from a single client file to a 4.3 kB server+client split, still correctly dynamic; `/events/[slug]` and `/new-in-bangkok` unchanged at 180 B), no route disappeared, no new build error.
- **Pricing unit tests:** 7/7 passed (see item 3).
- **Live route sweep**, `next dev` with `CHECKOUT_DYNAMIC_PRICING=true` (matching real production's recorded state) via raw `http.request` with an explicit `Host` header (this sandbox has no `curl`; confirmed via a temporary debug route that a real `Host` header does reach `req.headers.get('host')`/`headers().get('host')` correctly, both in Route Handlers and Server Components, before removing that route):
  - `Host: bkkclubcrawl.com`: `/`, `/book`, `/weekends`, `/login`, `/tgif`, `/solo-night` → 200 (unchanged). `/new-in-bangkok` → 404, `/contact` → 404 (both unchanged from Phase 4's own record). `/events/new-in-bkk` → 500 (identical pre-existing "no `.env.local`" constraint every Supabase-touching route hits in this sandbox, not a regression — reproduced identically in Phase 4's own sweep).
  - `Host: bestnightlifethailand.com`: `/` → 200, `/about` → 200, `/contact` → 200 — **byte-identical to Phase 4's own recorded baseline**, confirming zero regression from this session's `/about`/`/contact`-adjacent changes (none were made — this session touched neither file). `/new-in-bangkok` → 500, `/events/new-in-bkk` → 500 (same pre-existing Supabase-env constraint — new-in-bkk's page now needs a DB round trip to read the new pricing columns too, but the failure point is identical, before any of that data is read). `/book` → 200 — the new server/client split renders correctly on both hosts.
  - `POST /api/create-checkout` with a malformed body → 400 "Missing required fields" (unchanged). A valid-shaped BCC request (`tgif`) and a valid-shaped BNT request (`new-in-bkk`) BOTH reach the dynamic path and fail closed identically at the DB boundary with 503 "Booking temporarily unavailable" — proving the new storefront resolution + tiered-pricing code executes cleanly end-to-end up to (but not through, in this sandbox) the actual Supabase call, for both storefronts, with no new runtime error.
  - One transient false alarm during this sweep, root-caused and not a regression: the FIRST `next dev` boot returned 404 for `/about`/`/contact` on the BNT host; investigated via a temporary debug route/page (confirmed `headers().get('host')` and `resolveStorefront()` both resolve correctly) and resolved by a clean server restart — a dev-server hot-reload artifact from this session's many file edits landing while the server was running, not a code defect. Both debug files were deleted before finishing.
- **Live Supabase re-verification after all testing:** `new-in-bkk` — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, `early_bird_price=390`, `early_bird_cutoff_hours=48`. `bangkok-club-crawl` — both new columns NULL, unchanged. Total `bookings` row count: still exactly 8 — zero rows created by any testing this session (no real Stripe payment was run).
- **Not run, per explicit instruction:** a real Stripe payment (no live checkout attempted past the fail-closed DB boundary in this sandbox anyway); activating `new-in-bkk`.

**10. `new-in-bkk` remains Draft/invisible:** confirmed both before and after all code changes and all testing — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, unchanged throughout.

**11. Deliberately NOT done this session, flagged not fixed (matching Phase 4's own precedent of flagging cosmetic/out-of-scope gaps rather than fixing them preemptively):**
- `/book`'s visual chrome (BCC logo, red/magenta color scheme, "Back to [BCC]" framing) is unchanged for the BNT storefront — only the DATA layer (events listed, checkout storefront resolution, return-URL host) is storefront-correct. Low-risk because `new-in-bkk` stays Draft/invisible on both storefronts throughout Phase 5, so no real BNT visitor can reach this page yet regardless.
- `app/booking-success/page.tsx`'s `nightPriceMap`/`nightNameMap` (used only to size the Meta Pixel `Purchase` event's reported value) has no entry for `new-in-bkk` — falls back to ฿1,000. Pre-existing, dormant (the Meta Pixel script itself is already gated off entirely on the BNT host per Phase 3, and BCC's checkout gate has never allowed purchasing `new-in-bkk` since its `visible_bcc` has always been `false`), and cosmetic (only affects ad-attribution reporting, never the actual Stripe charge or booking record). Not touched — out of scope, no real customer impact today.
- Transactional email branding/sender identity — explicitly Phase 6, untouched, see item 12.
- APT 101 Wednesday Ladies Night benefits (3 free drinks for women, free entry for men) — still PENDING VENUE CONFIRMATION, not added to `product_content` or anywhere else this session. Reconfirmed unchanged.
- The pre-existing `public._migration_p1_audit` RLS-disabled advisory (found incidentally via `list_tables`, unrelated to this session's changes) — surfaced to Guide above, not remediated (out of scope, not customer data).

**12. What Phase 6 now needs to do:** BNT confirmation-page copy/branding (the `/booking-success` page itself, plus its `nightPriceMap` Pixel-value gap above); BNT transactional-email branding — sender identity (a second verified Resend domain, real infra work, not touched this session) and template header/copy for confirmation/cancellation/reschedule/confirmed-meetup/resend-confirmation, now resolvable per-booking via the new `bookings.storefront` column (or Stripe metadata directly, at webhook time) instead of the single hardcoded "Bangkok Club Crawl" identity every email currently shares; ticket/QR customer URLs already correctly resolve via the existing storefront-unaware `getAppUrl()` default (`'bcc'`) for every booking today — Phase 6 should decide whether ticket/QR links should also become storefront-aware (using the new `bookings.storefront` column) once BNT bookings actually start flowing, or whether a single canonical ticket-page host is fine regardless of purchase storefront; `/book`'s BNT visual chrome (item 11 above) if Guide wants tighter BNT integration before real launch.

**13. GO/NO-GO for Phase 6: GO** — Phase 5's pricing model, storefront-aware checkout, and Stripe-metadata/webhook/booking threading are complete, typecheck/build clean, pricing logic unit-verified (7/7), live-route-verified to the extent this sandbox and the Draft gate allow (zero regressions found across both storefronts), `new-in-bkk` confirmed Draft/invisible throughout, zero real bookings created, nothing merged or deployed.

### Phase 4 — canonical `/new-in-bangkok` public routing + BNT storefront presentation — COMPLETE, applied 2026-08-24, NOT merged/deployed

**Session scope, explicitly bounded:** Phase 4 ONLY — canonical New in Bangkok public routing + BNT storefront presentation. No Phase 5 checkout work, no Stripe/webhook/email changes, no publish, no DNS/domain changes, no merge to `main`, no production deploy. Verified before writing any code: `origin/main` is `8090708` (unchanged, matches Stage 10's own record of production); this branch (`claude/phase4c-content-media-audit-dvu5c1`) is up to date with its own origin at `69f4647`, the exact commit this session started from; `new-in-bkk` reconfirmed via direct SQL — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, `default_price=490`, `default_start_time='20:30:00'`, 12 open Wednesday `event_dates` + 1 closed historical Tuesday — matching Phase 3.5's own post-change verification exactly, nothing drifted between sessions.

**The problem found, read directly from code before changing anything:** `app/new-in-bangkok/page.tsx` was a fully static, hardcoded page (`NightPage` component, `slug="new-in-bangkok"`) with content that never matched the canonical Supabase product — Tuesday-era copy already partially updated to say "Wednesday" in some places but still ฿1,000 (vs. canonical ฿490), still routing through the legacy `/book?night=new-in-bangkok` → `/api/create-checkout` path with no `eventId`/ticket/QR/check-in lifecycle at all. Separately, `app/events/[slug]/page.tsx` (the existing Phase 4/Stage 8 canonical Product Page route) queried Supabase directly and gated exclusively on `visible_bcc`, with no host/storefront awareness whatsoever — meaning even after a future BNT cutover, visiting `bestnightlifethailand.com/events/new-in-bkk` would incorrectly check the BCC visibility flag instead of BNT's, a latent bug not yet triggered only because both flags are currently `false`.

**What was built:**
1. **`lib/publicProductPage.ts` (new)** — extracted the exact Product+`product_content`+`event_dates` query/gate logic (`status='active'` AND `visible_<storefront>=true`, mirroring `/api/products/[slug]` and `/api/events` byte-for-byte) into one shared `loadPublicProductPage(slug, storefront)` function, returning `null` on any gate failure. Both public product routes below call this — neither duplicates the query, so they cannot drift out of sync with each other or with the two existing canonical APIs.
2. **`app/events/[slug]/page.tsx` (modified)** — now resolves the request's real storefront via `headers().get('host')` + `resolveStorefront()` (the same Phase 2 function `/`, `/about`, `/contact` already use) instead of hardcoding `visible_bcc`. Zero behavior change for `bkkclubcrawl.com` (still checks `visible_bcc`, still 404s identically); adds correct `visible_bnt` gating for `bestnightlifethailand.com`, fixing the latent bug above before it could ever bite.
3. **`app/new-in-bangkok/page.tsx` (rewritten, not just edited)** — the old `NightPage`-based static content is gone entirely. New behavior: resolves storefront from the Host header; on any non-`bnt` host (`bkkclubcrawl.com` included) it `notFound()`s immediately, **without ever calling Supabase** (a pure host-string check short-circuits first) — this is deliberate: it means BCC's production behavior at this path changes from "serves stale ฿1,000 content" to "404", verified live (see below), and needs zero Supabase/env access to do so, so it can't fail open. On the `bnt` host, it calls `loadPublicProductPage('new-in-bkk', 'bnt')` and renders `<ProductPage {...data} mode="public" />` — the identical, unmodified, already-existing Phase 4/Stage 8 design-system component `/events/[slug]` and the admin Draft Preview already use, not a new design. `new-in-bkk` remains `visible_bnt=false`, so this path fails closed (404) for every real visitor today, exactly like `/events/new-in-bkk` — by design, not weakened for convenience.

**Design decision made, not defaulted into — BNT chrome:** considered wrapping the product page in `BntNav`/`BntFooter` (Phase 3's shared BNT hamburger-nav/footer components) for site-wide navigability back to Home/About/Contact, but did not — `BntNav`'s `.hamburger` button is `position: fixed; top:20px; right:20px` and `ProductPage`'s own `<nav>` already places its logo in that same top-right corner at `z-index:100` (the hamburger sits above it at `z-index:1002`, so the two would visually overlap, not stack cleanly). `ProductPage` is deliberately brand-neutral-but-already-BNT-styled by design (its own footer already reads "© 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok", its palette is the same crimson/magenta `#EA003A`/`#820065` gradient BNT uses elsewhere) — reusing it unmodified, exactly as `/events/[slug]` and the admin preview already do, honors the explicit "do not redesign the product page from scratch" instruction directly. Real gap this leaves: the page has no link back to the BNT homepage/About/Contact. Flagged, not fixed — an easy, low-risk follow-up (e.g. a small "← Best Nightlife Thailand" link in `ProductPage`'s existing nav bar, gated by a new optional prop) if Guide wants tighter site integration; not assumed or built here.

**BCC domain (`bkkclubcrawl.com/new-in-bangkok`) — decision:** 404, not a cross-domain redirect. A same-app conditional `notFound()` was chosen over redirecting to `bestnightlifethailand.com/new-in-bangkok` because the brief explicitly warned against a premature cross-domain redirect before the BNT domain cutover (it would fire for every BCC visitor today, including Preview testing, and `bestnightlifethailand.com` doesn't yet point at this app in production). 404 fully satisfies "no duplicate customer-facing implementation" without assuming a domain topology that isn't live yet; a redirect can be swapped in later at cutover time with a one-line change (replace the `notFound()` branch with a `redirect()`).

**`/events/new-in-bkk` — decision:** kept as a coexisting internal/alternate canonical route, now correctly storefront-aware (see above), per Guide's own stated preference ("ONE ProductPage implementation, ONE canonical data source, ONE customer-facing BNT URL, not necessarily one technical route"). It renders the exact same component from the exact same shared loader as `/new-in-bangkok` — there is no second data path, only a second URL, and it inherits the correct-per-host gate automatically now that it uses `loadPublicProductPage`.

**Verification performed:**
- `npx tsc --noEmit` — clean, no errors.
- `npm run build` — clean; both `/new-in-bangkok` and `/events/[slug]` list as dynamic routes at the same size class as before (180 B); every pre-existing route still lists (`/`, `/about`, `/contact`, `/book`, `/weekends`, `/dashboard`, `/dashboard/products`, `/dashboard/host`, `/login`, all 8 legacy night pages, all `/api/*` routes) — no route disappeared, no new build error.
- **Live verification via `next dev` + `curl` with an explicit `Host:` header** (this sandbox has no `.env.local` — the same constraint recorded at every prior stage of this document — but `curl` can set a Host header a real browser cannot spoof, which a prior Stage-10 session flagged as an untested gap; this session closed that gap for the routing-logic layer specifically):
  - `Host: bkkclubcrawl.com` → `/new-in-bangkok` → **404**, confirmed live, confirms the stale content is gone and the route needs zero Supabase access to fail closed.
  - `Host: bestnightlifethailand.com` → `/new-in-bangkok` → **500** (`supabaseUrl is required`, traced directly to `loadPublicProductPage` → `getServiceSupabase()`) — this is the identical, pre-existing "no `.env.local` in this sandbox" constraint every Supabase-touching route hits here (reproduced identically on `/events/new-in-bkk` on the BCC host, and on `/dashboard`/`/dashboard/products`/`/dashboard/host`, all pre-existing, all unrelated to this session's changes) — **not a code defect, and not something this session could resolve**, since the real gate (`visible_bnt=false` → `notFound()`) and the "can't reach Supabase" failure both short-circuit before rendering, and this sandbox cannot get past the second to observe the first live.
  - Regression sweep, all `Host: bkkclubcrawl.com` unless noted: `/` → 200, `/book` → 200, `/weekends` → 200, `/login` → 200, `/tgif` → 200, `/solo-night` → 200, `/contact` → 404 (correct — BCC never had this route, unaffected by this session). `Host: bestnightlifethailand.com`: `/` → 200, `/about` → 200, `/contact` → 200. `/dashboard/products` and `/dashboard/host` → 500, identical pre-existing "no `.env.local`" failure as `/dashboard` itself — not a regression, nothing in `app/dashboard/**` was touched this session.
- **What could NOT be verified, and why, honestly, per the explicit "do not weaken the Draft gate to preview" instruction:** the actual rendered `bestnightlifethailand.com/new-in-bangkok` page — real product name/price/Wednesday dates/photos on canonical BNT chrome — cannot be produced in this sandbox at all while `new-in-bkk` stays Draft, because doing so would require either (a) a working Supabase connection this sandbox doesn't have, at which point the gate would correctly 404 it anyway since `visible_bnt=false`, or (b) flipping `visible_bnt=true`, which is explicitly prohibited ("do not activate the product for convenience"). The content/pricing/photos themselves were already independently verified correct in Phase 3.5 via direct SQL against the live database (`default_price=490`, Wednesday `event_dates`, existing `product_content`) and remain visually inspectable today via the existing, unmodified, admin-authed `/dashboard/products/{id}/preview` route (`id=75466d68-23b6-45a9-bc68-96f002fb6b1e`) — unaffected by this session, already proven in Stage 9/Stage 10, the correct tool for this job per the brief's own instruction.

**Pricing — Phase 5 requirement, recorded not built, per explicit instruction:** New in Bangkok will eventually carry two real ticket tiers — **Early Bird ฿390** (available automatically when tickets first go on sale, closing ~1–2 days before each event) and **Regular ฿490** (the current `default_price`, remaining after Early Bird closes). This must be a genuine ticket-type/tier, not a customer-entered promo code. No pricing engine, schema migration, Stripe Price, coupon, promo code, or checkout behavior was created this session — the exact data model and mechanism (a real per-tier price with a time-based cutover, most likely `event_dates`-scoped rather than Stripe-Promotion-Code-scoped since it needs to auto-expire on a schedule per event rather than be redeemed) is an open design question for Phase 5 or a dedicated pricing sub-phase, not decided or started here.

**Wednesday APT 101 Ladies Night benefits — PENDING VENUE CONFIRMATION, not added:** reconfirmed this session (no `product_content` was touched) that `highlights`/`itinerary`/`whats_included` still say nothing about the Wednesday-specific APT 101 partner benefits (3 free drinks for women, free entry for men arriving with the group) — Phase 3.5 already established these need a real, current, confirmed partnership agreement with APT 101 before they become canonical, customer-facing content. Still not confirmed. Do not add them to `product_content` or any product-page copy until Guide confirms the partnership terms are live.

### Phase 4 STOP GATE report
1. **Routing architecture:** `bestnightlifethailand.com/new-in-bangkok` → host-resolved `resolveStorefront()` → `loadPublicProductPage('new-in-bkk', 'bnt')` (shared canonical loader, `lib/publicProductPage.ts`) → `<ProductPage mode="public" />` (existing, unmodified Stage 8 design-system component). `bkkclubcrawl.com/new-in-bangkok` → same route file, short-circuits to `notFound()` before any Supabase call. `/events/new-in-bkk` coexists, now also storefront-aware via the same shared loader.
2. **The old `app/new-in-bangkok/page.tsx`:** fully replaced. Zero hardcoded copy/price/schedule remains; it now only ever renders canonical `products`/`product_content`/`event_dates` data through `ProductPage`, or 404s. `components/NightPage.tsx` itself (the component the old page used) was left untouched, since 8 other legacy night pages (`tgif`, `solo-night`, `girls-night`, etc.) still depend on it — out of scope to touch.
3. **`/new-in-bangkok` → `new-in-bkk` without duplicating data:** both `/new-in-bangkok` and `/events/new-in-bkk` call the identical `loadPublicProductPage()` function against the identical `products`/`product_content`/`event_dates` rows — one data path, two URLs.
4. **BNT vs BCC hosts:** BNT → canonical product page (404 while Draft, by design). BCC → 404, always, regardless of product state (this path never even resolves `new-in-bkk`— the host check alone decides it).
5. **`/events/new-in-bkk`:** kept as a coexisting internal/alternate canonical route (Guide's stated preference: one data source, not necessarily one URL), now correctly storefront-aware instead of hardcoded to `visible_bcc`.
6. **Visual differences:** none observed to report — the real BNT-branded render could not be produced in this sandbox (Draft gate + no Supabase env, see above); code-level review confirms it will render via the exact same, already-approved `ProductPage` component `/events/[slug]` uses today, unmodified.
7. **Regression results:** `tsc`/`build` both clean; live `curl`-with-Host-header sweep across BCC and BNT hosts covering `/`, `/about`, `/book`, `/weekends`, `/login`, `/contact`, `/tgif`, `/solo-night`, `/dashboard/products`, `/dashboard/host` — all match their pre-existing behavior exactly (200/404/500-from-missing-env as applicable), zero new failures.
8. **`new-in-bkk` Draft/invisible confirmed:** reconfirmed via direct SQL both before and after this session's code changes (no data was touched this session) — `status='draft'`, `visible_bcc=false`, `visible_bnt=false`, unchanged.
9. **Unresolved, for Phase 5+:** (a) Early Bird ฿390 / Regular ฿490 pricing mechanism — design not started. (b) APT 101 Wednesday benefits — pending Guide's venue confirmation. (c) `/book`'s checkout flow is still BCC-storefront-hardcoded (`fetch('/api/events?storefront=bcc')` in `app/book/page.tsx`) — New in Bangkok cannot actually be purchased through BNT's storefront yet even once published; this is squarely Phase 5 checkout/storefront-aware-booking work, untouched and unstarted per this session's explicit scope. (d) No BNT-branded navigation link exists yet from the product page back to BNT Home/About/Contact (see chrome decision above) — cosmetic, low-risk, easy follow-up. (e) Storefront-aware transactional email branding remains exactly as Phase 3.5 already recorded it (still fully unbuilt) — unaffected by this session.
10. **GO/NO-GO for Phase 5: GO** — Phase 4's routing/canonicalization scope is complete, typecheck/build clean, live-verified to the extent this sandbox and the Draft gate allow, zero regressions found, nothing merged or deployed.

### Phases 5–9 (storefront-aware checkout/tickets/email, dynamic-pricing safety, Preview verification, domain-cutover plan)
Phase 5 (ticket pricing + storefront-aware booking/checkout) has since been completed in a later session — see the "Phase 5" section at the top of this document for its full report. Phases 6–9 (BNT transactional-email branding, Preview verification, domain-cutover plan) remain not started.

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
Not built as of Stage 10 Phase 3 (explicitly out of scope that session, "THIS SESSION IS PHASE 3 ONLY"). Phase 4 (canonical `/new-in-bangkok` public routing + BNT storefront presentation) and Phase 5 (ticket pricing + storefront-aware booking/checkout) have since been completed in later sessions — see the "Phase 5" and "Phase 4" sections near the top of this document for their full reports. Phases 6–9 (BNT transactional-email branding, Preview verification, domain-cutover plan) remain not started.

### STOP GATE status (of this session's requested report items)
1. **What was ported:** BNT homepage, About, Contact — full visual/behavioral parity (CSS/JS copied verbatim, only image paths rewritten); Private Experiences inquiry modal (all 4 steps, validation, dynamic Step 3, deck carousel) and Contact form, both fully interactive and wired to new API routes. 2. **Visual/behavioral differences from live BNT site:** none intentional; the 3 broken About-page images are now fixed (a bug fix, not a difference from *intended* design); Contact form's submit handling was reimplemented in React state rather than DOM `innerHTML` swap (same visible behavior). 3. **New DB tables/schema:** `bnt_experience_inquiries`, `bnt_contact_messages` in `BCC - Claude` Supabase — see above for full shape/rationale; both verified via direct-SQL test insert+cleanup, 0 rows in production now. 4. **Could not be verified:** a live HTTP round-trip through Supabase from this sandbox (no `.env.local`) and an actual Resend email send (no `RESEND_API_KEY`) — both are sandbox/environment constraints identical to every prior stage in this doc, not code-level uncertainty; full-page scrolled screenshots (tooling limitation, verified structurally instead — see above). 5. **DB changes:** zero unintended — `new-in-bkk` reconfirmed `status='draft'`/`visible_bcc=false`/`visible_bnt=false` after all testing; both new tables confirmed empty (0 rows) after test-row cleanup; no other table touched. 6. **GO/NO-GO for Phase 4:** **GO** — Phase 3's scope (BNT homepage/About/Contact + both forms) is complete, verified to the extent this sandbox allows, and typecheck/build are clean; the one open item before Guide relies on this in front of real customers is a real-device visual pass (this session's screenshot tooling limitation, not a known defect) and a live Supabase env to exercise the actual insert+email path once, either via Guide's own local `.env.local` or a Vercel Preview deployment with a share-bypass link.


## ⏸ Stage 9 SESSION PAUSED (STALE — the QR-scan crash this section investigates as unresolved was root-caused and fixed by main's separate work; see "Where things stand right now" above. Kept for history.) — read this section first


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

**Stage 9m — Real, live Stripe end-to-end acceptance test — RUN
2026-08-24.** The one remaining item from the Stage 9 launch policy
("a real paid Stripe transaction exercising the full chain... not yet
run"): a genuine live-mode payment was taken through the actual checkout
→ webhook → booking → email → ticket → QR chain, on the real production
Stripe account and the real production Supabase project, reusing existing
infrastructure throughout — no parallel Stripe/Vercel/Supabase setup.

**Pre-payment audit (branch `claude/stripe-e2e-new-bangkok-1v46mg`,
rebased onto `claude/qr-email-iphone-crash-mvk3tj` @ `69f5d77` — that
branch, not `phase4c-content-media-audit-dvu5c1`, turned out to hold the
actual latest Stage 9 work including the QR fix above; the checkpoint
doc's own "Branch" pointer had gone stale across sessions) traced the full
checkout→webhook→email→ticket→QR→check-in code path without redesigning
anything, and found one real, fixable gap plus several infrastructure
facts that needed verifying, not assuming:

1. **Blocker A (fixed, commit `ca902ee`):** `app/api/create-checkout/route.ts`
   was the one Stage 9 URL-building call site that never adopted
   `getAppUrl()` — it hardcoded `NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'`
   for `success_url`/`cancel_url`, so a Preview-initiated checkout would
   have redirected the browser back to production's pre-Stage-9
   `/booking-success` after payment. Swapped for `getAppUrl()`, matching
   every other Stage 9 call site. Minimal, single-file change; verified
   clean `tsc`/`build`.
2. **`CHECKOUT_DYNAMIC_PRICING` was not actually active for this branch.**
   Found via the Vercel dashboard, not assumed: the project had two
   existing rows for this key — one scoped to Production, one scoped to
   Preview but restricted to a **Custom Preview Branch** of
   `phase4-stage0-baseline` specifically. Neither matched
   `claude/stripe-e2e-new-bangkok-1v46mg`, so the flag would have resolved
   to `undefined` on this deployment and silently fallen through to the
   legacy hardcoded-Price checkout path (wrong product, wrong price, no
   `event_id`/`product_id` metadata). Fixed by Guide adding a third row
   scoped to Preview + this exact branch name, then redeploying.
3. **Confirmed live Stripe account, confirmed production runs the legacy
   checkout path today:** all 7 pre-existing real bookings had
   `stripe_session_id` starting `cs_live_...` with `event_id`/`product_id`
   NULL — live mode, legacy path, not assumed.
4. **Temporary Stripe webhook, reaching a protected Preview deployment —
   the actual mechanism, not a guess:** Vercel's Deployment Protection
   ("Vercel Authentication") blocks unauthenticated requests to any
   `*.vercel.app` URL for this project, including server-to-server ones.
   Used Vercel's documented **Protection Bypass for Automation** — a
   project-level secret appended as `?x-vercel-protection-bypass=<secret>`
   — rather than disabling deployment protection project-wide. A second,
   temporary Stripe LIVE webhook endpoint (listening ONLY to
   `checkout.session.completed`) was pointed at this branch's stable
   alias (`bcc-claude-git-claude-str-7dd00c-bestnightlifethailand-projects.vercel.app`)
   with that query param; its own new signing secret was stored as a
   Preview-scoped `STRIPE_WEBHOOK_SECRET` override (the existing
   Production-scoped value untouched). **A real near-miss caught before
   the real test:** the first bypass URL also included
   `x-vercel-set-bypass-cookie=true`, which makes Vercel 307-redirect to
   set a cookie instead of passing the request through — correct for a
   browser flow, wrong for a one-shot POST from curl or Stripe. Caught by
   testing with `curl -i` (saw the 307, not the expected response) before
   Stripe was ever configured to use it; corrected to the bare
   `?x-vercel-protection-bypass=<secret>` form (matches Vercel's own
   documented webhook example), then reachability was independently
   confirmed by curling the corrected URL and getting back this
   deployment's own `400 {"error":"Invalid signature"}` — proof the
   request reached our actual `/api/webhook` code, not Vercel's auth wall.
5. **Product activated, one real checkout created, verified pre-payment:**
   `new-in-bkk` flipped to `status='active'`, `visible_bcc=true`,
   `visible_bnt=false` directly via SQL (mirroring exactly what the
   Stage 7 activate endpoint would produce). One checkout session created
   against the real Sept 1, 2026 event id via the dynamic `eventId` path
   (confirmed used, not assumed: the request carried no `nightSlug`/
   `eventDate`, so a legacy-path fallback would have hard-failed with
   `400`instead of returning a session — it didn't). ฿590, quantity 1,
   live mode (`cs_live_...`).

**The real payment (completed 2026-08-24 by Guide personally; this session
never had and does not have Stripe credentials to complete a charge
itself):** first checkout link 404'd in-app (Stripe's generic
"session not found" — traced to the very long percent-encoded URL
fragment being mangled by an in-app browser hop, not a real defect; a
second session, opened by pasting the full URL directly into Safari,
worked). Result, verified directly against the database:

- **Exactly one booking row created** — total count 9→10, enforced by the
  pre-existing `UNIQUE(stripe_session_id)` constraint, not just observed.
  `product_id`, `event_id`, `ticket_token`, `quantity=1`, `total_paid=590`,
  correct guest name/email all present and correct.
- Confirmation email received with the "View Ticket & QR" CTA; `/ticket/[token]`
  loads correctly (QR, real meeting point, booking reference `NEW-01F2D2`);
  the booking joins correctly to the Sept 1 `event_dates` row that
  Event Operations/the dashboard calendar query by — all re-verified via
  direct SQL after the fact, not assumed from the code trace alone.
- **Real finding: a second, stray confirmation email was also sent** —
  not a duplicate booking. Stripe delivers a `checkout.session.completed`
  event to EVERY endpoint subscribed to it on the account, not just one;
  the pre-existing PRODUCTION webhook (`www.bkkclubcrawl.com/api/webhook`,
  running pre-Stage-9 code) also received and processed this same live
  event independently of the temporary Preview one. Both attempted an
  `INSERT`; the `UNIQUE(stripe_session_id)` constraint let only the first
  (this session's Preview webhook, which won the race) succeed — so no
  duplicate booking — but the production webhook's code doesn't stop on
  that insert failure, it logs and continues, and unconditionally sends
  its OWN (legacy, non-canonical, `ticket=null`) confirmation email
  regardless. This is the one real, unplanned side effect a real launch
  needs to be immune to — see "Recorded technical debt" below. Not
  refactored now, per instruction, since it isn't launch-blocking (the
  canonical booking/email/ticket path all worked correctly) and isn't
  required to close this stage.
- **Real UI bug found and fixed, commit `2f52a68`:** `app/booking-success/page.tsx`'s
  post-payment subtitle and "WHAT HAPPENS NEXT" steps were hardcoded BCC
  copy ("WhatsApp group by 7 PM", "show up at 9:30 PM") shown for every
  product, including New in Bangkok. Fixed using the same
  canonical-vs-legacy split pattern Stage 9k/9l already established for
  the confirmation email: once a `ticketToken` resolves (Stage 9+ dynamic
  checkout), the page shows generic, product-agnostic copy pointing to
  the email/ticket/QR instead; a legacy booking with no ticket token
  keeps the original BCC-specific copy unchanged. Also fixed the steps
  list's last-item spacing, which was hardcoded to `step === '3'` and
  would have broken once the canonical list has only 2 steps. Verified:
  `tsc`/`build` clean. Not retroactively reflected in the email Guide
  already received; applies to the page going forward.
- **Real content gap found and fixed:** `product_content.whats_included`
  for `new-in-bkk` said "Welcome shot on arrival" (singular) — the real
  offer includes two shots, one at Don't Open the Fridge and one at APT
  101. Updated directly via SQL (same shape the admin Content API writes)
  to two separate `{icon:"wine", text:...}` items, keeping the existing
  icon/card style, ahead of the "Hosted introductions"/"Entry to two
  venues" items already there.

**Recorded technical debt (not fixed, explicitly deferred per
instruction):** the webhook (`app/api/webhook/route.ts`) should not send
the customer confirmation email or the internal `ADMIN_NOTIFY_EMAIL` alert
when its own booking `INSERT` fails because `stripe_session_id` already
exists (i.e., a genuine "another endpoint/retry already recorded this
payment" case, distinct from a real insert error worth alerting on) — right
now it logs and sends anyway with `ticket=null`, which is what produced
the stray legacy email during this test. Only surfaces when more than one
webhook endpoint is subscribed to `checkout.session.completed` on the same
Stripe account at once (true during this test's temporary dual-webhook
setup; not the normal single-endpoint steady state) or on a genuine Stripe
retry of an already-processed event. Not required for launch as currently
scoped — noted here so it isn't rediscovered as a surprise later, not
before this Stripe test.

**Real physical QR scan + operator check-in — SUCCEEDED, 2026-08-24.**
Guide personally scanned the real paid booking's QR (via a Vercel
share-bypass link to `/ticket/{token}` on this Preview deployment,
necessary only because New in Bangkok isn't merged/published yet — not an
app defect) and completed the check-in herself, per her explicit
instruction that this session not do it for her. Confirmed via direct SQL
after: `attendance_status='checked_in'` on the real booking
(`id=cf064654-2bda-4314-83ec-fcc05001f2d2`). This is the SAME QR-scanner
code path fixed earlier in this doc (`69f5d77`) — no crash, confirming
that fix holds for a genuinely paid, genuinely product-driven booking,
not just the earlier preview-test ones.

**Cleanup performed after the test, all confirmed via direct SQL/Guide's
own confirmation:**
- Temporary Stripe LIVE webhook endpoint (`TEMP - Stage9 preview E2E test
  - delete after`) — **deleted by Guide directly in the Stripe dashboard,
  confirmed 2026-08-24.** This session has no Stripe API access to verify
  the deletion independently, but Guide confirmed it directly; the
  existing production webhook (`BCC Booking completed`) was never touched
  by either party.
- Alex Chen's and Jamie Rivera's `preview-test-*` bookings — deleted
  (`DELETE ... WHERE ticket_token IN (...)`). The real ฿590 booking
  (`stripe_session_id` starting `cs_live_b1ma6R3p...`) was explicitly
  preserved as a legitimate paid booking, not touched.
- `new-in-bkk` restored: `status='draft'`, `visible_bcc=false`,
  `visible_bnt=false` — confirmed via `RETURNING`, and re-confirmed again
  at the very end of this stage.
- Total `bookings` count after cleanup: 8 (the 7 original real BCC
  bookings + this one real New in Bangkok booking). No other production
  data touched. Bangkok Club Crawl's production behavior was not modified
  at any point in Stage 9m.

**Stage 9 — CLOSED (2026-08-24).** Every item in the original Stage 9
launch policy ("a real paid Stripe transaction exercising the full chain
... not yet run") is now done and verified: real live ฿590 payment →
webhook → exactly one canonical booking (correct `product_id`, `event_id`,
`ticket_token`, quantity, customer data) → product-driven confirmation
email → ticket page → real QR scan → real operator check-in, all
succeeded. Two real bugs found during the test were fixed (Blocker A;
booking-success's hardcoded BCC copy) and one content gap was corrected
(the two-shots inclusion). One piece of technical debt (the stray-email
side effect) was found and deliberately left open, per instruction. Not
merged to `main`; `new-in-bkk` is Draft/invisible again. Closing this
stage does NOT mean ready to publish — see the two new pre-launch items
below (BNT storefront/domain decision, transactional sender identity)
plus everything already listed in "Not done yet" further down, none of
which are resolved by Stage 9m.

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
- **BNT storefront/domain integration — explicit pre-launch architecture
  decision needed, not yet made.** New in Bangkok's entire post-checkout
  lifecycle (success page, confirmation email, ticket page, QR, check-in)
  currently runs entirely on this app (`bcc-claude`) — by design, per the
  Stage 9 launch policy's "reuse existing infrastructure" instruction.
  `bestnightlifethailand.com` is a separate repo/app (`NightlifeAntigravity`)
  with only a read-only Product API (BNT Stage A) built against it; BNT
  Stages B–F (its own booking surface, storefront-aware shared checkout,
  publish, legacy cleanup) are not started. **Guide is now considering
  consolidating BNT into this repo instead of building that cross-repo
  storefront integration** — this is the next real architecture decision
  for New in Bangkok/BNT, not yet made. Do not start either path (BNT
  Stages B–F, or a BNT-into-`bcc-claude` consolidation) without an explicit
  decision and instruction first.
- **Transactional email sender identity — pre-launch item, not started.**
  Every transactional email (BCC and New in Bangkok alike) sends from the
  single shared `RESEND_FROM=bangkokclubcrawl@gmail.com` env var — found
  during Stage 9m's real test (Guide noticed the real New in Bangkok
  confirmation email arrived from the BCC address). Before a real BNT/New
  in Bangkok public launch, a proper BEST Nightlife Thailand sender
  (ideally a verified `@bestnightlifethailand.com` domain in Resend, for
  SPF/DKIM deliverability — not just a different `@gmail.com` address)
  needs to be established and verified, then wired in **without changing
  the existing BCC production sender** (`RESEND_FROM` is currently global;
  making it product/storefront-aware is itself part of this item, not a
  one-line env var swap). Not started — flagged here so it isn't
  rediscovered as a surprise right before launch.
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
1. `git fetch && git checkout claude/stripe-e2e-new-bangkok-1v46mg` (verify
   latest commit — this is the current branch as of Stage 9m, 2026-08-24;
   `phase4-stage0-baseline` is an old, now-superseded baseline branch).
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
