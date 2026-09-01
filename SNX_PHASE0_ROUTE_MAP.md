# SNX Operator OS — Phase 0 Route Map

Date: 2026-09-01
Scope: planning only. No code, schema, or routing changes made. Completes the last open Phase 0 output from `SNX_OPERATOR_ARCHITECTURE_V1.md` ("define the SNX mobile shell route structure"), building on [BCC_EXISTING_OPERATIONS_AUDIT.md](./BCC_EXISTING_OPERATIONS_AUDIT.md).

## Shell placement decision

New route group: **`/operator/*`**, mobile-first, additive alongside the existing `/dashboard/*` console.

Why not repurpose `/dashboard`:
- `/dashboard/page.tsx` is a large, desktop-biased, BCC-branded monolith (per audit §4/§6). Rebuilding it in place risks breaking the owner console operators already rely on daily.
- The architecture doc's general rule is "wrap before replacing" — `/operator` wraps existing `/api/admin/*` and `/api/*` endpoints; it doesn't touch them.
- `/dashboard` keeps serving desktop owner workflows (product admin, day-panel edits) until specific modules are proven in `/operator` and can be deprecated deliberately.

Naming is not locked — `/operator` is a placeholder. `/snx` was considered but reads as brand-specific inside a repo that's still BCC/BNT-branded at the domain level; `/operator` describes the function and survives a future rename, matching the doc's "architecture should not depend on a rename" instruction. **Open decision — confirm before scaffolding.**

## Auth boundary

Reuse the existing pattern exactly (audit §1 "Login/Auth", §2 "Auth And Authorization"):
- `middleware.ts` gains `/operator/:path*` alongside `/dashboard/:path*` and `/api/admin/:path*`, requiring a valid Supabase session.
- A new `/operator` layout requires `admin_users` membership the same way `app/dashboard/layout.tsx` does.
- No new role model for V1. `owner` / `admin` / `staff` from `admin_users` carries over unchanged; staff-visible surfaces mirror the redactions the host dashboard already does (no revenue, profit, `total_paid`, `price_per_person`, `host_fee_final`, `host_payment_status`).
- This does **not** fix the RLS gap the audit flags as Critical (public `SELECT` on `bookings`, `event_dates`, `expenses`, `ota_bookings`). That's a Security Phase 0 item independent of routing and should land before `/operator/records` exposes bookings/expenses more broadly than the current dashboard does.

## Route map by shell area

### Home — `/operator`

"What needs attention now."

| Signal | Backing source | Status |
|---|---|---|
| Today's events | `event_dates` filtered to today, via same query shape as `app/api/admin/dashboard/events/route.ts` | Reuse |
| Urgent approvals | — | New (Phase 4, no proposal/approval table exists yet) |
| Failed workflows | — | New (Phase 5, no workflow tracking exists yet) |
| Pending partner tasks | — | New (Phase 3, no partner tables exist yet) |
| Hermes alerts | — | New (Phase 0 Hermes doesn't exist; alerts come after a Hermes connection point ships) |
| Open closeout items | `event_dates.operation_verdict`, unfinalized `host_fee_final`/`host_payment_status` | Reuse, needs a "still open" query BCC's dashboard doesn't currently surface as a list |

V1 Home is honestly thin: today's events plus open closeout items are the only real signals available until Partners (Phase 3) and Workflows (Phase 5) exist. That's expected — the architecture doc scopes Home's richer content to later phases.

### Work — `/operator/work`

"Active workflows and approvals."

| Item | Backing source | Status |
|---|---|---|
| Proposals | — | New (Phase 4) |
| Reviews | — | New (Phase 4) |
| Content drafts | — | New (Phase 4, Hermes-assisted) |
| Partner follow-ups | — | New (Phase 3) |
| Operational tasks | `event_dates` rows missing host assignment, unclosed dates past their time, unfinalized host fees | Reuse as a filtered list; no dedicated "task" table exists — this is a view over existing operational fields, not a new model |

V1 Work is almost entirely new surface. The one thing reusable today is reframing existing "stuff that's still open" operational fields as a task list, which the current owner dashboard doesn't do explicitly (it shows state per-event, not an aggregate queue).

### Hermes — `/operator/hermes`

"AI/operator interaction."

Nothing today. This is genuinely new and gated by the doc's Hermes boundary: read/summarize/draft/recommend only, no silent mutation, human confirmation before anything that touches payments/bookings/pricing/event-critical data, audit trail on anything that does touch production.

First connection points per the doc, ranked by what already has a clean read surface per the audit:
1. **Event briefing** — reads `event_dates` + related `bookings`/`ota_bookings`/`expenses`, all already resolvable through existing admin routes. Lowest lift.
2. **Post-event summary** — same data, after the fact.
3. **Approval queue summary** — blocked until Work/proposals exist (Phase 4).
4. **Partner profile summary / follow-up suggestion** — blocked until Partners exist (Phase 3).

### Records — `/operator/records`

"Canonical operational records." This maps most cleanly onto what already exists.

| Record type | Table(s) | Existing surface | Status |
|---|---|---|---|
| Events | `event_dates`, `products`, `product_schedules` | `/dashboard`, `/dashboard/products/[id]` | Reuse |
| Bookings | `bookings`, `ota_bookings` | `/api/admin/dashboard/bookings`, `/api/admin/dashboard/ota-bookings` | Reuse |
| Expenses | `expenses` | `/api/admin/dashboard/expenses` | Reuse |
| Attendance | `bookings.attendance_status`, `ota_bookings.attendance_status` | `/api/update-attendance` | Reuse |
| Partners | — | — | New (Phase 3) |
| Venues | — | — | New (Phase 3, likely folded into Partners) |
| Proposals | — | — | New (Phase 4) |

`/operator/records/events`, `/records/bookings`, `/records/expenses`, `/records/attendance` are close to drop-in list/detail views over existing admin API responses — the audit already flags these as "reusable with moderate confidence" (Attendance module, product instances table logic, booking resolution). `/records/partners` and `/records/proposals` are placeholder routes until Phase 3/4 land.

### More — `/operator/more`

"Less-used systems and settings."

| Item | Backing source | Status |
|---|---|---|
| Admin settings | `admin_users`, existing `/login` | Reuse |
| Product admin | `/dashboard/products/*` — link out rather than rebuild | Reuse (linked, not ported) |
| Email preview | `/dashboard/email-preview/[token]` — link out | Reuse (linked, not ported) |
| Knowledge | — | New (Business Memory, Phase 5) |
| Internal tools | — | Undefined, low priority for V1 |
| Runtime/workflow inspection | — | New (Phase 5) |

Product admin and email preview are desktop/admin-console tools per the audit (§4, §6) — not worth porting into the mobile shell for V1. `/operator/more` links out to the existing `/dashboard/products` and `/dashboard/email-preview` routes rather than reimplementing them.

## What Phase 1 actually has to build

Stripping out everything flagged "New" above, Phase 1 (Mobile Operator Shell) is realistically:

1. `/operator` layout + nav (Home / Work / Hermes / Records / More), auth-gated like `/dashboard`.
2. Home: today's events list + open-closeout-items list, both read-only queries over existing tables.
3. Records: events / bookings / expenses / attendance list-detail views, wrapping existing `/api/admin/dashboard/*` endpoints.
4. Work: a filtered "still open" operational queue, no new table.
5. Hermes: empty/placeholder tab, or skip until a Phase 0 security pass clears Hermes to read production data at all.
6. More: settings + links out to `/dashboard/products` and `/dashboard/email-preview`.

Partners, Proposals, and any real Hermes interaction are out of scope until Phase 3/4, matching the doc's non-goals ("do not migrate every feature at once").

## Open decisions before scaffolding starts

1. **Route prefix**: `/operator` vs. `/snx` vs. something else.
2. **RLS timing**: does the Security Phase 0 pass (tightening public `SELECT` policies) land before or alongside `/operator/records`? Recommend before, since Records is the first place SNX would expose booking/expense data through a second surface.
3. **Host assignment**: audit flags `event_dates.host_assigned` as free-text, not a foreign key. Does `/operator` inherit that fragility for V1, or is this the moment to key it to `admin_users`?
4. **Hermes gating**: ship an empty Hermes tab in Phase 1, or hold the tab back entirely until a read-only event-briefing connection point exists?
