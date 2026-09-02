# SNX Operator OS — Session Handoff

Date: 2026-09-02
Branch: `preview/phase-2c-products` (not yet merged to `main`)
HEAD: `232de99` — `fix(operator): prioritize blocked check-in states`

## Completed phases

| Phase | Commit | What |
|---|---|---|
| Phase 1A | `d6f17d6` | Five-tab shell rewire (Home/Manage/Create/Quest/More) |
| Phase 1A polish | `8c683d5` | Copy cleanup — dev/audit language removed from visible UI |
| Phase 2A | `2117758` | Manage → Event Operations (Overview/Guests/Expenses/Brief/Closeout) |
| Phase 2B | `116f7a1` | Manage → Calendar/Instances (month grid + scheduling edit) |
| Phase 2C (base) | `3eb4cd0` | Manage → Products/Experiences graduates in-shell (list, overview, details, media) |
| — reconciliation | `404a56c` | Merge `origin/main` into the Phase 2C branch — content-identical BNT homepage commits, zero conflicts, zero net file change |
| Phase 2C polish | `961a0a6` | Product detail mobile layout: removed Archived filter, fixed misleading "No schedule" → "Not configured" wording, restructured Overview hierarchy, density/touch-target/spacing fixes |
| Phase 2C label fix | `9d198eb` | Create Hub card relabeled to disclose true current scope (see below) |
| Phase 2D (base) | `2913118` | Manage → Check-in graduates in-shell (QR scanner + confirmation) |
| Phase 2D live-test fix | `232de99` | Confirmation screen: cancelled/refunded state now takes visual priority over "Already Checked In" |

**Phase 2C and Phase 2D are both approved and complete on `preview/phase-2c-products`.** Not yet merged to `main` / pushed to production — that's a separate future decision, not made in this session.

## Current five-tab architecture

`Home · Manage · Create · Quest · More` — approved, in production use. Superseded the original `Home/Work/Hermes/Records/More` architecture (`SNX_OPERATOR_ARCHITECTURE_V1.md`); `Work` and `Hermes` routes still exist but are unlinked from primary nav.

## Current `/operator` route map

```
/operator                                       Home
/operator/work                                  unlinked, still present (deep-link target for the attention bell)
/operator/hermes                                unlinked, still present (placeholder, not wired)

/operator/manage                                Manage hub
/operator/manage/products                       Products/Experiences — list (search/status/storefront filters, list/grid) (Phase 2C)
/operator/manage/products/[id]                  Product Overview — identity, lifecycle, pricing, schedule, instance context (Phase 2C)
/operator/manage/products/[id]/details          Product content editor (tagline, descriptions, meeting point, inclusions, itinerary) (Phase 2C)
/operator/manage/products/[id]/media            Product media editor (cover + gallery, full CRUD) (Phase 2C)
/operator/manage/calendar                       Calendar/Instances — month grid (Phase 2B)
/operator/manage/calendar/[id]                  Instance scheduling detail/edit (Phase 2B)
/operator/manage/events                         Event Operations instance list (Phase 2A)
/operator/manage/events/[id]                    Overview
/operator/manage/events/[id]/guests             Guest list / check-in status
/operator/manage/events/[id]/expenses           Expenses
/operator/manage/events/[id]/brief              Host Brief
/operator/manage/events/[id]/closeout           Closeout
/operator/manage/checkin                        QR scanner + manual code fallback (Phase 2D)
/operator/manage/checkin/[token]                Booking confirmation — preview + explicit Check In (Phase 2D)

/operator/create                                Create hub (1 active flow, 2 "Coming next" inert rows)

/operator/quest                                 Empty shell only — no backend

/operator/more                                  More hub
/operator/more/records                          Records index
/operator/more/records/events                   event_dates, read-only
/operator/more/records/bookings                 bookings + ota_bookings, read-only
/operator/more/records/expenses                 expenses, read-only
/operator/more/records/attendance               attendance rollup, read-only
```

## What is fully implemented (in-shell, real reads/writes)

- **Home** — attention feed, today's events, real metrics, notification bell (deep-links to `/operator/work`).
- **Manage → Products/Experiences** — catalog list (search, status filter, BCC/BNT storefront filter, list/grid toggle), Product Overview (identity, Activate/Deactivate lifecycle, pricing incl. early-bird, derived schedule-configuration label, instance context, deep-links to Calendar/Instances and Event Operations), Details editor (full `product_content` CRUD), Media editor (cover + gallery, full CRUD). Reuses the existing production Product Admin API routes unchanged — no new write endpoints, no schema changes.
- **Manage → Event Operations** — full instance-level workflow: attendance, expenses, host brief/logistics, host fee, closeout (`operation_verdict='Completed'`).
- **Manage → Calendar/Instances** — month browsing, per-instance scheduling (capacity, price override, start time, sales open/closed, host assignment).
- **Manage → Check-in** — camera QR scanner (`html5-qrcode`, same integration/decode semantics as the legacy scanner) + manual code-entry fallback, routing to a booking confirmation screen (guest identity, party size, booking ref, product/event context, payment status) with an explicit two-step "preview → Check In" action. Event Operations → Guests' "Scan QR Code" button now also opens this in-shell scanner instead of `/dashboard/checkin`. Reuses `GET`/`POST /api/admin/checkin/[token]` unchanged — no new mutation route.
- **More → Records** — 4 read-only views over `event_dates`/`bookings`/`ota_bookings`/`expenses`.

## What still uses temporary link-outs (to `/dashboard`)

- Create → **New Nightlife Product / Experience** → `/dashboard/products/new`

This is explicitly labeled as temporary in code comments (not in the visible UI, per the Phase 1A polish decision). **Manage now has zero remaining temporary link-outs** — Products/Experiences (Phase 2C) and Check-in (Phase 2D) both graduated in-shell; `/dashboard/checkin/*` remains fully untouched and functional in parallel (nothing in Phase 2D modified it, the QR/token/attendance engine, or `/api/update-attendance`).

**Create Hub labeling (Phase 2C label fix, `9d198eb`):** the Create card now reads **"New Nightlife Product / Experience"** with subtitle **"BCC / BNT scheduled product flow"** — corrected from the previous generic "New Product / Experience," which implied the flow already supported YTG, Flow Lab, tours, private/on-request services, etc. It doesn't. The card still routes to the existing `/dashboard/products/new` form, unchanged, unmigrated. This is temporary truthful labeling, not new scope.

**Check-in architecture (Phase 2D):**
- **Booking-level, not per-guest.** `attendance_status` is one value per row in `bookings`/`ota_bookings` — there is no per-guest/per-seat sub-state anywhere in the schema. A `quantity > 1` group booking checks in as **one atomic unit** — `quantity` is display/context only, never partially decremented. No per-guest checkboxes, no partial group check-in, no timestamps, no table/VIP fields — none of that data exists, none was built.
- **OTA stays manual.** `ota_bookings` has no `ticket_token` column — QR check-in is structurally impossible for OTA guests. OTA attendance is handled exactly as before, through Event Operations → Guests' manual attendance dropdown (`POST /api/update-attendance`, unchanged). No token was invented for OTA.
- **Presentation priority (live-test fix, `232de99`):** when a booking is both cancelled/refunded *and* already checked in (a real state seen in production data), the confirmation screen now shows "Booking Cancelled"/"Booking Refunded" as the primary card, with "Attendance status: Already checked in" as a smaller secondary note underneath — not the reverse. Purely a rendering-priority change; `isBlocked`/`isCheckedIn` computation and all mutation logic are untouched.
- **Brand-agnostic by construction.** Neither the scanner nor the confirmation screen contains any BCC/BEST/nightlife-specific copy or routing — product/event context is read entirely from the resolver's response (`data.product.name`, `data.event.eventDate`, etc.), never hardcoded. Works today for any booking the existing `bookings` + `ticket_token` engine resolves; no YTG/Flow Lab-specific logic was added, none was faked.

## What is intentionally deferred

- **Unified Product Creation V2** — explicitly deferred. The current creation flow (`/dashboard/products/new`) only knows how to create fixed-date BCC/BNT nightlife products. A future unified SNX Product/Experience creation architecture must support the broader catalog (private nightlife, VIP clubbing, yacht/private events, tours, guide services, personalized travel, community experiences, etc.) and — critically — **must be designed fulfillment-model first, not brand first**: schedule mode (recurring / one-time / on-request — the last of which doesn't exist yet, see Phase 2C audit's Refinement 2) and operation type (how a booking is actually fulfilled) are the real architectural axes; brand/storefront is presentation on top, not the organizing principle. Do not design V2 as "add a brand picker to the existing form."
- Partners, Proposals, Captions — proven engines exist in Living OS (per the Codex/`OX_OPERATOR_REUSE_AUDIT.md` audit) but not migrated; Create shows them as inert "Coming next," not built.
- Quest's actual functionality — route/shell only, no table, no backend.
- Inquiry management UI — real data exists (`bnt_experience_inquiries`, `bnt_contact_messages`) but no operator-facing surface built.
- Hermes — no wiring anywhere; Telegram remains the conversational interface.
- Tour / Community Event operation templates — nightlife is the only implemented template; architecture left extensible, not built.
- Double-booking detection, per-instance visibility, sales cut-off, editable instance date, expense payment-method/logged-by fields — no source data or detection logic exists for any of these; not built anywhere.
- A dedicated "Alerts & Conflicts" hub screen — real signals (missing host, at-capacity) surface as inline chips instead.
- Product Basic Info/Pricing editing (name, slug, default price, early-bird pricing, default start time) — no write route exists anywhere in production for these fields (confirmed by the Phase 2C audit); shown read-only in the operator UI, not invented.

## Current database/schema assumptions

- `event_dates` is the canonical instance record (PRODUCT → SCHEDULE → INSTANCE → OPERATIONS chain, unchanged).
- **`capacity` is NOT a hard booking limit** — verified against `app/book/BookingCalendarClient.tsx`'s own comment; checkout enforces only a flat 24-ticket-per-order UX cap. Operational/planning signal only. UI must say "At capacity," never "Sold Out."
- `host_assigned` is free-text against a hardcoded `['Guide','Ice','Boom','JJ']` list, not FK'd — known fragility, not fixed in any phase so far, still open.
- `is_open` (sales) and `operation_verdict` (operational status) are separate, independent fields — both writable from more than one route today (matches pre-existing `/dashboard` precedent, not a new risk).
- `products.visible_bcc`/`visible_bnt` are two hardcoded storefront-visibility booleans, not a canonical Brand model — no schema/data exists anywhere for Flow Lab or YTG. Do not treat these as an extensible brand system.
- `product_schedules.freq` (`'once'`/`'weekly'`) is the real, existing schedule-mode data — recurring/one-time genuinely exist today. Zero `product_schedules` rows for a product is a real, valid state (older products can have `event_dates` with no schedule row) — displayed as "Not configured," never inferred as "On Request." A true on-request mode doesn't exist in the schema.
- `products.early_bird_price`/`early_bird_cutoff_hours` are real, live, checkout-consumed columns (Stage 10 Phase 5) — but Product Admin's own API never selected them and no write route exists; the operator UI now displays them read-only where set.
- **Zero schema changes made across every phase, including Phase 2C.** No new tables, no new columns, no migrations.

## Important safety boundaries (held across every phase)

- No Stripe, checkout, webhook, or booking-truth changes — ever.
- No schema/migration change without explicit surfaced approval first.
- `/dashboard` (including `/dashboard/products/*`) must remain fully functional in parallel at every step — verified via `git status`/build-output diffing before every commit, never touched.
- No client-side/anon-key Supabase reads anywhere in `/operator` — service role only, from Server Components.
- No new Product write API — every Phase 2C write reuses an existing `/api/admin/products/**` or `/api/admin/media/**` route unchanged.
- No new attendance mutation route — every Phase 2D write reuses `GET`/`POST /api/admin/checkin/[token]` and `POST /api/update-attendance` unchanged. QR generation, `ticket_token` minting, `resolveBookingByToken()`, and `/dashboard/checkin/*` are all untouched.
- No Hermes integration, no Partners/Proposals/Captions migration, no Quest backend, no Unified Product Creation V2, without separate explicit approval.

## Current audit/plan documents

- `SNX_OPERATOR_ARCHITECTURE_V1.md` — original architecture brief (nav superseded, Hermes boundaries/migration rules still stand)
- `BCC_EXISTING_OPERATIONS_AUDIT.md` — production BCC/BNT system audit
- `OX_OPERATOR_REUSE_AUDIT.md` — Living OS / sanctuary-nexus Codex audit
- `SNX_PHASE0_ROUTE_MAP.md` — original 5-tab route plan (superseded by Phase 1A's actual nav)
- `SNX_PHASE0.5_SECURITY_REPORT.md` — RLS verification (closed)
- `SNX_PHASE1_ALIGNMENT_AUDIT.md` — v2 alignment audit, mockup-to-reality matrix, Codex corrections
- `SNX_PHASE2A_EVENT_OPS_PLAN.md` — Event Operations audit + plan
- `SNX_PHASE2B_CALENDAR_INSTANCES_PLAN.md` — Calendar/Instances audit + plan
- Phase 2C's audit/plan (Products/Experiences architecture, mockup-to-reality matrix, brand/schedule-mode/operation-type schema mapping) was delivered in-conversation, not as a separate committed file — see this session's transcript if a written copy is needed later.
- Phase 2D's audit/plan (Check-in workflow map, data/API audit, reuse/adapt/defer matrix) was likewise delivered in-conversation, not as a separate committed file.

## Next recommended module

**Manage is now fully in-shell — no remaining temporary link-outs.** Products/Experiences (Phase 2C) and Check-in (Phase 2D) both graduated; there is no more low-risk "audit an existing proven `/dashboard` engine and migrate it" work left in Manage the way the last four phases each had. The two real options left both need an explicit decision before starting, not just an audit:

1. **Unified Product Creation V2** — deferred, see above. Needs its own fulfillment-model-first architecture decision (and likely a real schema conversation, e.g. an on-request booking path) before any implementation.
2. **One of Create's "Coming next" items** (Partner+Proposal or Caption Set) — proving out the Living OS migration path instead. Bigger, riskier slice (would require a durable-storage decision, per `SNX_PHASE1_ALIGNMENT_AUDIT.md` §7a's flagged exception) and should only start with explicit sign-off on the schema question it raises.

Neither should be started without that sign-off first.

---

No product code was modified while writing this file.
