# SNX Operator — Phase 2A: Manage → Event Operations

Date: 2026-09-02
Scope: analysis + plan only. No code changes made. Checkpoint: `d6f17d6` (Phase 1A shell, clean).
Inputs: direct file audit of the production BCC codebase (citations below), the two mockups you attached ("SNX Event Operations" 5-screen flow, "Instance Architecture / Template System"), and everything already established in `SNX_PHASE1_ALIGNMENT_AUDIT.md`.

## 1. Existing Event Operations architecture (as it actually is today)

The production system already has almost everything the mockup needs — it's just desktop-shaped, in one large component (`app/dashboard/page.tsx`, the `DayPanel`), and "closeout" isn't a single thing.

**Instance identity.** `event_dates` is the instance row — `event_date` + `night_slug` (unique pair) + FK `product_id`. This already matches your PRODUCT/SCHEDULE/INSTANCE split: `products` = what's sold, `product_schedules` = recurrence, `event_dates` = one occurrence. There is no separate "operation" table — operational state (verdict, host assignment, logistics, host fee) lives as columns directly on `event_dates`.

**Shared core, exactly as your architecture diagram describes it, mapped to real columns:**
- date/time → `event_dates.event_date`, `start_time_override` (falls back to `products.default_start_time`)
- bookings → `bookings` + `ota_bookings`, joined by `event_date` + `night_slug`
- people/guest data → guest fields inline on those two tables (no normalized Person/Guest model — confirmed still true)
- assignment → `event_dates.host_assigned` (free-text against a hardcoded `['Guide','Ice','Boom','JJ']` list — same fragility the Phase 0 audit already flagged, unchanged)
- status → `event_dates.operation_verdict` (6-value enum, DB-constrained) + `is_open` (a *separate* concept — bookable vs. not, not operational status)
- operational notes/communication → `special_notes` (owner-edited, actually shown in UI) + `notes` (write-only audit trail, never rendered) + one real send action (confirmed-meetup email)

**Host fee** — a real, working formula, not a placeholder:
```js
// app/dashboard/page.tsx:13-17
function suggestedHostFee(showUpGuests) {
  if (showUpGuests <= 5) return 1500
  return 1500 + (showUpGuests - 5) * 300
}
```
computed from checked-in guest count, editable, tracked through `host_payment_status` (`Not calculated` → `Calculated` → `Paid`).

**Revenue/profit** — real, computed client-side from raw rows (not from the `daily_summary` view, which exists in the schema but nothing in the audited code path reads it):
```js
// app/dashboard/page.tsx:491-499
profit = (webRevenue + otaRevenue) - totalExpenses   // does NOT subtract host_fee_final
```

**Closeout — the important negative finding:** there is no closeout button, route, or object anywhere. "Closeout" today is the *combination* of `operation_verdict` reaching `Completed`/`Reviewed`, attendance no longer sitting at `expected`, expenses having been logged, and `host_payment_status` reaching `Paid` — four independently-settable fields an owner happens to set over the course of a night, not one workflow.

**Host-scoped view already redacts correctly.** `/dashboard/host/[id]` deliberately never fetches `host_fee_final`, `host_payment_status`, `total_paid`, or `guest_email` — enforced server-side in the API route, not just hidden client-side. Any new mobile surface needs to preserve this boundary.

**Check-in is booking-level, not guest-level, by design.** A `quantity > 1` booking checks in as one unit — there is no per-guest sub-state. The QR flow (`/dashboard/checkin` → `/dashboard/checkin/[token]` → `GET`/`POST /api/admin/checkin/[token]`) is already mobile-built and works via an opaque per-booking token, no camera-integration work needed.

## 2. Mockup-to-reality matrix

| Mockup area | Existing source | Read/write | Proven? | Decision |
|---|---|---|---|---|
| **Overview** — event name, date/time | `event_dates.night_name/event_date`, `start_time_override` | Read | Yes | REUSE |
| Overview — venue/location | `meet_up_location` (imperfect fit — it's "where guests meet," not a venue name) | Read | Partial | ADAPT — reuse the field, don't invent a separate venue field |
| Overview — Live/status badge | Derived from `is_open` + `operation_verdict` | Read | Partial | MINIMAL NEW — a computed display state, no new data |
| Overview — guest/checked-in counts | `bookings`+`ota_bookings` quantity sums, filtered by `attendance_status` | Read | Yes | REUSE — same calc `lib/operator/queue.ts` and the dashboard already do |
| Overview — host | `host_assigned` | Read | Yes | REUSE |
| Overview — meeting point, WhatsApp link, route, van/taxi, notes | `meet_up_location`, `whatsapp_group_link`, `venue_route`, `van_or_taxi_contact`, `special_notes` | Read/write | Yes | REUSE |
| Overview — WhatsApp "24 members active" | — | — | No | DO NOT BUILD — no WhatsApp integration exists, it's a stored link only |
| Overview — "View on Maps" live map | `venue_route` (structured text) | Read | Partial | DO NOT BUILD a map integration; ADAPT by displaying the text fields |
| Overview — Hermes Insight card | — | — | No | DO NOT BUILD — hard boundary |
| **Guest List** — names, quantity, source, attendance status | `bookings`/`ota_bookings` | Read/write | Yes | REUSE |
| Guest List — search/filter | — | — | No | MINIMAL NEW — client-side filter over already-fetched data |
| Guest List — VIP tag, table number | — | — | No | DO NOT BUILD — no such columns exist |
| Guest List — checked-in timestamp ("9:58 PM") | — | — | No | DO NOT BUILD — `attendance_status` is a status enum with no timestamp |
| **Check-in** — QR scan | `/dashboard/checkin/*`, `/api/admin/checkin/[token]` | Read/write | Yes | REUSE (link-out — see §6) |
| Check-in — manual status change | `POST /api/update-attendance` | Write | Yes | REUSE |
| **Expenses** — total, count, list, add | `expenses` table, existing POST route | Read/write | Yes | REUSE |
| Expenses — Cash/Card breakdown | — | — | No | DO NOT BUILD — no payment-method column |
| Expenses — "logged by" attribution | — | — | No | DO NOT BUILD — no such column |
| **Host Brief** — Brief tab content | Assembled in `buildHostBriefText()` from real fields | Read | Yes | ADAPT — same field sources, mobile-formatted instead of a plain-text block |
| Host Brief — Logistics tab | Same fields as Overview's logistics group | Read/write | Yes | ADAPT — regroup existing fields |
| Host Brief — Timeline, Team tabs | — | — | No | DO NOT BUILD — no stops/itinerary data (that's Tour-template territory) and no multi-host roster |
| Host Brief — auto-generated narrative paragraph | — | — | No | DO NOT BUILD — would require generation (Hermes); show real structured fields instead |
| Host Brief — Objectives checklist, Dress Code, Spend Target, VIP Tables, Attendance range | — | — | No | DO NOT BUILD — no source data; `special_notes` may contain some of this as prose already |
| **Closeout** — attendance/expenses/host-fee/verdict signals | All four fields above | Read | Yes | ADAPT — present as a checklist derived from existing fields, nothing new stored |
| Closeout — "Close Out Event" action | — (no such action exists) | — | Partial | MINIMAL NEW — a client action that sets `operation_verdict = 'Completed'` via the *existing* PATCH route; zero schema change |
| Closeout — success screen | — | — | No | MINIMAL NEW — UI feedback only |
| Closeout — "Generate summary report" | — | — | No | DO NOT BUILD as AI-generated; could ADAPT to just display the same real revenue/expense numbers, no generation |
| "Other Actions" panel (Edit Details, Send Announcement, Share Link, View Reports, Duplicate) | Send Announcement = existing confirmed-meetup email | Read/write | Partial | Send Announcement: REUSE. Everything else: **not in scope** — not part of your Step 3 target list, DEFER |
| All Hermes Insight cards, everywhere | — | — | No | DO NOT BUILD — hard boundary |

## 3. Exact existing APIs/data/functions to reuse

**Reads** — direct Server Component queries against `event_dates`/`bookings`/`ota_bookings`/`expenses`, same pattern `lib/operator/queue.ts` already established (service role, no new API route needed):
- Single instance by id: `event_dates` row (all operational columns)
- Guest list + expenses for that instance: same shape as `app/api/admin/dashboard/day-detail/route.ts` (`bookings` `status='confirmed'`, `ota_bookings`, `expenses`, filtered by `event_date`+`night_slug`)

**Writes** — call these exact existing routes, unchanged, same `requireAdmin()` gate:
- `PATCH /api/admin/dashboard/events/[id]` — `isOpen, hostAssigned, operationVerdict, meetUpLocation, whatsappGroupLink, venueRoute, vanOrTaxiContact, specialNotes, hostFeeFinal, hostPaymentStatus` (allowlisted keys, confirmed in the route)
- `POST /api/update-attendance` — `{ table: 'bookings'|'ota_bookings', id, status }`
- `POST /api/admin/dashboard/expenses` — `{ eventDate, nightSlug, category, description, amount }`
- `POST /api/admin/dashboard/ota-bookings` — manual OTA guest add, if the Guest List screen needs it
- `POST /api/send-confirmed-meetup` — the "Send Announcement" action, with its existing server-side precondition checks intact

**Logic to port, not reinvent:**
- `suggestedHostFee()` formula (`app/dashboard/page.tsx:13-17`)
- Revenue/profit calc (`app/dashboard/page.tsx:491-499`)
- `buildHostBriefText()`'s field-assembly list, as the source-of-truth for what a mobile Host Brief should show
- `sendMeetupIssuesFor()` precondition logic for the announcement action

**Reuse unchanged, as a link-out (not rebuilt):** the entire `/dashboard/checkin/*` QR flow.

## 4. Fields the mockup shows that do not exist

VIP flag / table number · checked-in timestamp · WhatsApp active-member count · live map integration · expense payment-method (Cash/Card) · expense "logged by" attribution · Host Brief Timeline tab · Host Brief Team/multi-host roster · auto-generated narrative overview · Host Objectives checklist · structured Dress Code / Average Spend Target / VIP Tables / Estimated Attendance fields · a single atomic closeout object · AI-generated summary reports · every Hermes Insight card.

None of these are being built this phase. Where a real field can stand in for the *intent* (e.g. `special_notes` for "key info"), I'll use it; where nothing real exists, the mockup element is simply omitted, not faked.

## 5. Proposed mobile route structure

```
/operator/manage/events            instance list (today + upcoming — reuses the same
                                    date-window query Home/Work already use)
/operator/manage/events/[id]       Overview (default landing)
/operator/manage/events/[id]/guests     Guest List / Check-in status
/operator/manage/events/[id]/expenses   Expenses
/operator/manage/events/[id]/brief      Host Brief
/operator/manage/events/[id]/closeout   Closeout
```

Mirrors the mockup's own icon-row sub-navigation (Overview → Guest List / Expenses / Host Brief / Closeout) as sub-routes under one instance.

## 6. What remains a link-out

- **QR camera scanning** — the Guest List screen's "Scan" action links to `/dashboard/checkin`, unchanged. The existing `html5-qrcode` integration already works and is mobile-ready; rebuilding it inside the new shell isn't worth the risk this phase. Revisit as an ADAPT candidate once the rest of Event Operations is proven.
- **Full calendar browsing** — Manage's existing "Calendar / Instances" row keeps linking to `/dashboard` for month-view browsing. The new `/operator/manage/events` list only needs today/upcoming, not a full calendar picker.
- **Products/Experiences, Check-in (as a standalone Manage row)** — unchanged from Phase 1A.

Everything else that currently lives in "Event Operations" (Overview through Closeout) graduates from link-out to in-shell this phase.

## 7. Required schema change

**None required for this slice as scoped.** Every REUSE/ADAPT/MINIMAL-NEW item above maps to existing columns, existing routes, or new client-side orchestration over existing PATCH/POST endpoints.

One item is explicitly *not* being proposed, only flagged for your future call: a checked-in timestamp column and/or an expense payment-method/logged-by column, if you later decide those specific mockup details matter enough to be real. Not requesting that now — recommending we omit them.

## 8. Smallest safe implementation plan (not started)

1. `/operator/manage/events` (list) + `/operator/manage/events/[id]` (Overview) + four sub-routes, all Server Components reading directly via service role — same pattern as existing `/operator` pages, no new API routes for reads.
2. Small client components for the mutable pieces (attendance toggle, add-expense form, verdict/host-fee edit, logistics fields), each calling the exact existing routes listed in §3 — zero new endpoints, same auth.
3. Closeout screen: a read-only checklist derived from existing field state (attendance not all `expected`, ≥1 expense or explicit none, `host_payment_status`, `operation_verdict`) plus a "Mark Complete" action that PATCHes `operation_verdict` to `'Completed'` through the existing route.
4. Update Manage's "Event Operations" row to point at `/operator/manage/events` instead of `/dashboard`.
5. `/dashboard`'s day panel stays fully untouched and functional throughout — nothing removed or deprecated.
6. Structure the code so a future `OPERATION_TEMPLATES` concept (nightlife/tour/community) is a plausible later extension point (e.g., one config object keyed by type), without implementing Tour or Community — nightlife is the only template this phase.

No Stripe/checkout/webhook changes, no `event_dates` redesign, no normalized Person/Guest model, no Partners/Proposals/Captions/Inquiry/Quest/Hermes work, no removal of existing `/dashboard` workflows.

---

Stopping here per your instruction. Waiting for approval of this plan before any code changes.
