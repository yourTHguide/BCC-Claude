# SNX Operator — Phase 2B: Manage → Calendar / Instances

Date: 2026-09-02
Scope: analysis + plan only. No code changes made. Checkpoint: `2117758` (Phase 2A Event Operations, clean, committed).
Inputs: direct file audit of the production BCC codebase (citations below), the two mockups you attached ("Calendar / Instances" 6-screen flow, "Instance Architecture / Template System" — same architecture reference as Phase 2A), and `SNX_PHASE2A_EVENT_OPS_PLAN.md`.

## 1. Existing Calendar/Instances architecture (as it actually is today)

The full chain is real and already matches your PRODUCT → SCHEDULE → INSTANCE → OPERATIONS model:

- **PRODUCT** = `products` (unchanged from Phase 2A's audit).
- **SCHEDULE** = `product_schedules` — `id, product_id, night_slug, night_name, freq('once'|'weekly'), weekday, start_date, until_date, start_time_default, generated_through, is_active, created_at`. `generated_through` is a real watermark: schedule creation generates occurrences synchronously up to a 12-week horizon (or an explicit `until_date`), and extension is a separate, explicit, owner-initiated action — nothing auto-extends in the background.
- **INSTANCE** = `event_dates`, unchanged — `capacity`, `price_override`, `start_time_override`, `schedule_id`, `product_id` are the fields relevant to this phase specifically.
- **OPERATIONS** = the Phase 2A module, already built at `/operator/manage/events/[id]/*`.

**The month calendar itself** (`app/dashboard/page.tsx`'s `Dashboard` component) fetches `GET /api/admin/dashboard/events?start&end` for the visible month — the exact same route Home/Work already use elsewhere in `/operator`, just with different date bounds. It renders every `event_dates` row in range with no product/storefront join — **no brand filter exists today**, and nothing gates the calendar by `visible_bcc`/`visible_bnt`.

**The important negative finding, twice:**
1. **No "remaining capacity" or "sold out" is computed anywhere in the codebase** — admin or public. `capacity` and `booking_count` render as two separate, unsubtracted numbers in the one screen that shows both (`InstancesPanel.tsx`). The public availability API explicitly comments that `capacity` "does NOT drive the calendar's purchase quantity" and computes nothing from it either.
2. **No conflict/double-booking detection exists anywhere.** Exhaustive grep for conflict/double-booking/sold-out/alert logic across `app/dashboard/`, `app/api/admin/`, `lib/` found zero real matches beyond `lib/operator/queue.ts`'s three existing reasons (missing host, past-event-still-open, host-fee-unfinalized) — which are Event-Operations territory, not scheduling conflicts.

**Two routes both write `is_open` today** — the Day Panel via `/api/admin/dashboard/events/[id]` (`requireAdmin()`) and the Products/Instances editor via `/api/admin/events/[id]` (`requireRole(['owner','admin'])`). This dual-surface-same-field pattern is existing, deliberate production behavior (the dashboard route's own comment calls this out explicitly) — Phase 2B's Calendar module editing the same fields Phase 2A's Overview can touch is not a new risk, it's the same precedent already live.

## 2. Mockup-to-reality matrix

| Mockup area | Existing source | Read/write | Proven? | Decision |
|---|---|---|---|---|
| **Calendar view** — month grid, day cells with instances | `event_dates` via `GET /api/admin/dashboard/events` | Read | Yes | REUSE |
| Calendar view — brand filter chips (All/BEST/BCC/Flow Lab/YTG) | `products.visible_bcc/visible_bnt` (product-level only) | — | Partial | DO NOT BUILD for Flow Lab/YTG (no data exists, confirmed in Phase 1A audit); DEFER a BCC/BNT-only filter — not requested in your Step 3 scope |
| Calendar view — "Upcoming Next 7 Days" list | — | — | No | DEFER — no equivalent exists in the desktop calendar either, and not in your Step 3 scope |
| **Day/date record** — instances for a selected date | Same `event_dates` rows, filtered client-side to one date | Read | Yes | REUSE — no second fetch needed, filter the already-fetched month |
| **Instance detail** — product/event name, date/time | `event_dates.night_name/event_date`, `start_time_override` ?? `products.default_start_time` | Read | Yes | REUSE |
| Instance detail — hero image, tagline | `product_media` (cover kind), `product_content.tagline` | Read | Yes | REUSE — same tables Product Admin already uses |
| Instance detail — capacity, booked/remaining | `event_dates.capacity`, computed `booking_count` (same query `/api/admin/products/[id]/events` already runs) | Read | Yes | REUSE (capacity/count), MINIMAL NEW (a derived "remaining" — pure subtraction of two real numbers, not stored anywhere yet) |
| Instance detail — host/guide assignment | `event_dates.host_assigned` | Read/write | Yes | REUSE — same field/route Phase 2A's Overview already writes |
| Instance detail — operational/status state | `event_dates.operation_verdict` | Read | Yes | REUSE (display only here — editing stays owned by Phase 2A) |
| Instance detail — sales open/closed | `event_dates.is_open` | Read/write | Yes | REUSE |
| **Availability/Instance Edit** — capacity stepper | `event_dates.capacity` via `PATCH /api/admin/events/[id]` | Write | Yes | REUSE |
| Instance Edit — date field | — (`PATCH /api/admin/events/[id]` explicitly does not accept `event_date`) | — | No | DO NOT BUILD — editing an instance's date isn't supported anywhere in production |
| Instance Edit — start time | `event_dates.start_time_override` | Write | Yes | REUSE |
| Instance Edit — duration dropdown | — (no duration field anywhere in `event_dates` or `products`) | — | No | DO NOT BUILD |
| Instance Edit — pricing override (standard vs. override) | `products.default_price` (read), `event_dates.price_override` (write) | Read/write | Yes | REUSE |
| Instance Edit — sales cut-off | — (no such field anywhere) | — | No | DO NOT BUILD |
| Instance Edit — visibility Public/Private (per-instance) | — (`visible_bcc`/`visible_bnt` are product-level only, confirmed) | — | No | DO NOT BUILD — would require a schema change (a new per-instance visibility column), not approved |
| **Bookings for instance** | `bookings`/`ota_bookings`, already surfaced at `/operator/manage/events/[id]/guests` | Read/write | Yes | REUSE — deep-link to the existing Phase 2A Guests screen, per your Step 2 instruction, zero new booking UI |
| **Conflict/alert — Double Booking Detected** | — (zero detection logic anywhere; would require new cross-product time-overlap modeling) | — | No | DO NOT BUILD |
| Conflict/alert — Missing Assignment | `lib/operator/queue.ts`'s `getOpenOperationalItems()` — already computes this exact condition | Read | Yes | REUSE the existing function directly |
| Conflict/alert — Sold Out | `capacity` vs. `booking_count`, both real, never subtracted anywhere yet | Read | Partial | MINIMAL NEW — a derived boolean (`capacity != null && bookingCount >= capacity`), not a stored field, not an "alert engine" |
| Conflict/alert — Date Closed | `event_dates.is_open = false` | Read | Yes | REUSE — already renders as "Closed" everywhere else in the shell |
| A dedicated "Alerts & Conflicts" hub screen (mockup 2.6) | — | — | Partial | DEFER — the three real signals above are proposed as inline chips on existing rows, not a standalone alerts-management screen; that's a bigger surface than what's proven necessary this phase |

## 3. Exact APIs/functions/data fields to reuse

**Reads** — direct Server Component queries (same pattern as `lib/operator/queue.ts` and `lib/operator/eventOps.ts`), or the exact existing admin routes where a client component needs a fetch:
- `event_dates` for a month range — same shape `GET /api/admin/dashboard/events` returns, read directly via service role instead of a fetch round trip.
- Per-instance `booking_count` — same computation `app/api/admin/products/[id]/events/route.ts:41-51` already does (sum `bookings`+`ota_bookings` by `night_slug`+`event_date`), ported into a shared helper the way Phase 2A ported `suggestedHostFee`.
- `product_content`/`product_media` for hero image/tagline, same tables Product Admin reads.

**Writes** — exact existing routes, unchanged:
- `PATCH /api/admin/events/[id]` — `capacity`, `priceOverride`, `startTimeOverride`, `isOpen`
- `PATCH /api/admin/dashboard/events/[id]` — `hostAssigned` (same route/field Phase 2A's `OverviewControls` already uses)

**Reused function:** `getOpenOperationalItems()` from `lib/operator/queue.ts`, for the "Missing host assignment" signal — literally the same call, not a re-derivation.

**Deep-link, not rebuilt:** `/operator/manage/events/[id]/guests` (Bookings), `/operator/manage/events/[id]` (Overview — for anything operational/verdict/closeout-adjacent).

## 4. Mockup fields/states that do not exist

Brand filter chips beyond BCC/BNT (no Flow Lab/YTG data) · "Upcoming Next 7 Days" widget · editable instance date · duration dropdown · sales cut-off · per-instance visibility (Public/Private) · double-booking detection · a dedicated Alerts & Conflicts screen. None of these get built this phase.

## 5. Proposed mobile routes

```
/operator/manage/calendar            month grid + inline day-instance list (single page,
                                      client-side date selection over the already-fetched
                                      month — same single-page pattern the desktop
                                      calendar already uses, no extra route/fetch)
/operator/manage/calendar/[id]       Instance Detail + Edit (scheduling fields only:
                                      capacity, price override, start time, host
                                      assignment, sales open/closed)
```

`[id]` is the `event_dates.id` — the same identifier Phase 2A's routes use, just a different route namespace for a different responsibility (scheduling vs. operations).

## 6. Exact relationship to Phase 2A's Event Operations routes

Calendar owns **scheduling** fields (capacity, price override, start time, sales open/closed, host assignment display+edit). Event Operations owns **operational** fields (verdict, closeout, host fee, brief, guests, expenses) — unchanged, nothing moves.

From `/operator/manage/calendar/[id]`, two explicit links out, no duplication:
- **"Bookings"** → `/operator/manage/events/[id]/guests` (existing Phase 2A screen, same `id`)
- **"Open Operations"** → `/operator/manage/events/[id]` (existing Phase 2A Overview, same `id`)

`host_assigned` and `is_open` are the two fields both modules can touch — this mirrors the exact dual-surface pattern already live in production (Day Panel and Products/InstancesPanel both edit `is_open` today), not a new risk.

## 7. Required schema change

**None.** Every REUSE/MINIMAL-NEW item above maps to existing columns and existing routes. The one MINIMAL NEW item (a derived "sold out" boolean) is computed at render time from two already-real numbers, never stored.

## 8. Smallest safe implementation plan (not started)

1. `lib/operator/eventOps.ts` (or a new adjacent `lib/operator/calendar.ts`) gains: a month-range instance read, the ported `booking_count` computation, and a small `isSoldOut(capacity, bookingCount)` helper — read-only additions, no new tables.
2. `/operator/manage/calendar` — Server Component fetching the month, a small client component for date selection/navigation (prev/next month, tap a date) rendering that date's instances inline, each row showing name/time/capacity+booked/host/status chips (including the two new inline signals: missing-host reusing `getOpenOperationalItems()`, sold-out from the new helper).
3. `/operator/manage/calendar/[id]` — Overview-style read display of the scheduling fields, plus a small edit form for capacity/price-override/start-time (client component calling `PATCH /api/admin/events/[id]`) and host assignment (calling `PATCH /api/admin/dashboard/events/[id]`, same as Phase 2A), plus the two "Bookings" / "Open Operations" link-outs.
4. Update Manage's "Calendar / Instances" row from a `/dashboard` link-out to `/operator/manage/calendar`.
5. `/dashboard`'s calendar and Products/Instances editor stay fully untouched and functional throughout.
6. No brand filter, no Flow Lab/YTG, no double-booking detection, no dedicated alerts screen, no Tour/Community templates.

No Stripe/checkout/webhook changes, no `event_dates` redesign, no new guest/person schema, no Products module work, no Partners/Proposals/Captions/Inquiry/Quest/Hermes, no removal of existing `/dashboard` behavior.

---

Stopping here per your instruction. Waiting for approval before any code changes.
