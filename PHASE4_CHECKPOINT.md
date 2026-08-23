# Phase 4 — Internal Product & Schedule Builder — Checkpoint

_Last updated: 2026-08-23 (Stage 9a — booking canonical identity + ticket token — APPLIED to production). Compact resume doc for continuing in a fresh conversation._

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
change. **Not done yet:** 9b (webhook populates these columns on new
bookings) through 9e (see the staged plan in the Stage 9 architecture audit
transcript for this session).

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
- **Security hardening** (deferred tech debt, unchanged by Stage 9 except
  where noted): old dashboard anon-key writes/reads, public `bookings` read
  policy (`USING (true)` — exposes guest name/email/phone AND, as of Stage
  9a, `ticket_token` to anyone with the anon key, bypassing the QR resolver
  entirely; not worsened by Stage 9a, but directly relevant to it — the
  "opaque QR token" security property only defends against someone reading
  the QR image, not direct DB access), 6 unauthenticated
  `/api/*` ops routes — `cancel-booking`, `reschedule-booking`,
  `delete-ota-booking`, `resend-confirmation`, `send-confirmed-meetup`, and
  `update-attendance` (Stage 9e secures only `update-attendance` + the new
  Stage 9d check-in resolver, since those are the two this booking lifecycle
  directly depends on; the other 4 remain untouched, unauthenticated legacy
  debt — do not assume Stage 9e fixed them), `daily_summary` SECURITY
  DEFINER. None of this blocks New in Bangkok's launch; all pre-existing,
  tracked here so it isn't rediscovered as a surprise later.

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
