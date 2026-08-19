# Phase 4 — Internal Product & Schedule Builder — Checkpoint

_Last updated: 2026-08-19 (Stage 8b). Compact resume doc for continuing in a fresh conversation._

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
  three have `rolbypassrls=true`). Bucket is empty (0 objects) after test
  cleanup. No admin upload/delete code exists yet — that's Stage 8d.

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

## Dashboard UI
- `/dashboard/products` (list, + Create Product), `/dashboard/products/new`
  (neutral blank Create form + live preview + Save as Draft), `/dashboard/products/[id]`
  (detail: narrow info cards, Publish/Deactivate controls, full-width interactive
  Event Instances panel). Publish opens an inline panel with non-blocking warnings
  (no upcoming open instances, no default price) and BCC/BNT visibility toggles;
  confirming requires BCC on. `visible_bnt` is labeled "not live yet" everywhere
  it's shown — no BNT storefront/checkout exists yet.

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
- **Content UI, Media UI, `ProductPage.tsx`, authenticated Draft preview
  (`/dashboard/products/[id]/preview`), public `/events/[slug]`** — not
  started (Stages 8c–8k). Schema (Stage 8a) and Storage bucket (Stage 8b) are
  both live; no content/media has been entered for New in Bangkok yet, and no
  admin upload/delete route exists yet to enter it with.
- **New in Bangkok stays Draft** through all of Stage 8 — Preview and
  production share the same Supabase project, so Activate/Publish is never
  used as a preview mechanism. Draft review happens via the authenticated
  admin preview route once built (Stage 8f), not by flipping `status`.
- **BNT storefront + BNT checkout** — not started; `visible_bnt` is inert.
- **Archive** product-lifecycle state — intentionally deferred (not needed for
  New in Bangkok; Draft ⇄ Active is the full lifecycle for now).
- **Security hardening** (deferred tech debt): old dashboard anon-key writes,
  public `bookings` read (PII), unauthenticated legacy ops routes,
  `daily_summary` SECURITY DEFINER. See the security tech-debt notes.

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
