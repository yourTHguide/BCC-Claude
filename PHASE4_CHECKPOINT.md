# Phase 4 — Internal Product & Schedule Builder — Checkpoint

_Last updated: 2026-08-19. Compact resume doc for continuing in a fresh conversation._

## Where we are
Phase 4 adds an internal admin dashboard to create Products, generate their
Event Instances from a recurrence rule, and operate individual dates — so
launching a new experience becomes an **admin task, not a code/SQL task**.

- **Working branch:** `phase4-stage0-baseline` (GitHub `yourTHguide/BCC-Claude`).
- **NOT merged to `main`.** Production (`bkkclubcrawl.com`, `main` @ `03dc06c`)
  still runs the pre-Phase-4 app; all new admin code is Preview-only on the branch.
- **Stages 0–5 complete and verified.** Stage 6 is next (to be scoped in the
  fresh conversation). **New in Bangkok** is the first real onboarding exercise
  after Stage 6 is proven — it does NOT exist yet.

## Production database (Supabase `oomhftxgvikzxlvqdcmr`)
- Migration **A** applied — `admin_users` (owner/admin/staff, RLS + self-read),
  `products.updated_at` + `set_updated_at()` trigger (search_path pinned),
  **RLS enabled on `products`** (service-role only).
- Migration **B** applied — `product_schedules` + `event_dates.schedule_id`
  (FK `ON DELETE SET NULL`). The booking calendar never reads `product_schedules`.
- Migration **C** (product_content, product_media) — **authored, NOT applied.**
- Canonical data unchanged: 1 Product `bangkok-club-crawl` (active, ฿1200), 80
  `event_dates`, 0 `product_schedules`. Admin user seeded: bestnightlifethailand@gmail.com.

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

## Dashboard UI
- `/dashboard/products` (list, + Create Product), `/dashboard/products/new`
  (neutral blank Create form + live preview + Save as Draft), `/dashboard/products/[id]`
  (detail: narrow info cards + full-width interactive Event Instances panel).

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
  `visible_bcc`. Nothing is activated yet.

## Not done yet (remaining for New in Bangkok onboarding)
- **Activate / Publish** flow (flip status → active) — intentionally not built.
- **Additive `eventId` checkout resolution** — not started (checkout untouched).
- **Migration C + product content/media + landing pages** — not started.
- **Security hardening** (deferred tech debt): old dashboard anon-key writes,
  public `bookings` read (PII), unauthenticated legacy ops routes,
  `daily_summary` SECURITY DEFINER. See the security tech-debt notes.

## How to resume
1. `git fetch && git checkout phase4-stage0-baseline` (verify latest commit).
2. Scope Stage 6, keep changes additive + Preview-only, never merge to `main`
   without explicit approval.
3. Test with unmistakable `zzz-*` Draft products via the real authenticated UI,
   verify in the DB, then delete and confirm baseline.
