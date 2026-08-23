# Phase 4 — Internal Product & Schedule Builder — Checkpoint

_Last updated: 2026-08-23 (Stage 9k — mobile-QA closure pass — APPLIED). Compact resume doc for continuing in a fresh conversation._

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
  rest of Phase 4C — see "Not done yet" below.
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
