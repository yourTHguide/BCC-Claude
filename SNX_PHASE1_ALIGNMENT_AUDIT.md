# SNX Operator — Phase 1 Alignment Audit (v2)

Date: 2026-09-02
Scope: analysis only. No code changes made. Supersedes the v1 audit's classifications wherever the new evidence below contradicts them — v1 was written without the Codex audit or the App Index mockups and said so explicitly; this version closes that gap.

## 0. Inputs (v1's gaps closed)

Now available, read directly (not summarized secondhand):
- `OX_OPERATOR_REUSE_AUDIT.md` (the "Codex audit") — a full inspection of `sanctuary-nexus`: routes, data model, auth, every workflow, Hermes/Cortex routing, the artifact system, memory/knowledge tiers, reusable UI patterns, and a 49-row capability table with Codex's own reuse classification per item.
- Five top-level mockups: Home, Manage, Create, Quest, More — navigation/UX intent only, per your instruction, not automatic scope.
- `SNX Event operation.png` (from the prior pass) — still the only Instance Operations detail evidence; unchanged status.

Still not available, unchanged from v1: deeper workflow mockups (explicitly withheld by you, to arrive per-module later); direct read access to the `sanctuary-nexus` repo itself (I'm relying on the Codex audit's findings, per your instruction not to re-derive what Codex already established).

## 1. Current `/operator` state (unchanged from v1, restated briefly)

`/operator` is a real, committed, 100% read-only prototype (commits 35d90a8 → 8c683d5): `Home / Work / Hermes / Records / More`, all data via `getServiceSupabase()` from Server Components against `event_dates`/`bookings`/`ota_bookings`/`expenses`. No write action exists anywhere in it — every mutation still lives in `/dashboard`. No Partners/Proposals/Hermes wiring, no new tables. Full file inventory is unchanged from v1; see that section if needed.

## 2. Five-tab navigation — confirmed by mockups

`Home · Manage · Create · Quest · More` is now evidenced by real top-level screens, not just your prose description. Per-tab purpose as shown:

- **Home** — cross-venture attention/overview (Needs Attention, Today's Operations, Business Pulse, Notifications).
- **Manage** — control surface for existing operational records (Calendar/Instances, Products, Event Operations, Check-in, People, Inquiries, Bookings, Partners, Communications).
- **Create** — structured-creation entry point (Quick Create tiles, categorized workflow picker, asset-remix "turn into" handoff).
- **Quest** — Guide's personal capture/execution space (inbox, quest detail with steps, delegation, archive).
- **More** — Records & History, Knowledge & Memory, Files & Outputs, System & Settings.

One thing the Home mockup adds that your prose didn't spell out: **brand-scoped filtering** (`All SNX / BEST / BCC / Flow Lab / YTG` chips) across Home, Manage, and Business Pulse. This is mockup UX intent, not proof those four ventures have real backends — see §6.

## 3. Real capability map

`Mockup capability → real source system → evidence → classification → final destination`

Classification key: **REUSE** (proven engine, already production-grade) · **MIGRATE** (proven engine, not yet on SNX's production stack) · **ADAPT** (proven engine + UI, needs a new mobile front end) · **MINIMAL NEW** (no proven engine anywhere, small enough to build fresh) · **DEFER** (real somewhere, but not proven for operator use yet) · **DO NOT BUILD** (no operational evidence, or explicitly Living-OS-only).

### HOME

| Capability | Real source system | Evidence | Classification | Final destination |
|---|---|---|---|---|
| What needs attention (BCC) | `event_dates` fields | Already built: `lib/operator/queue.ts` | REUSE | Bell/notification surface (already the v1 plan) |
| Today's operations (BCC) | `event_dates`, `bookings`, `ota_bookings` | Already built: `getTodaysEvents()` | REUSE | Home agenda (already built) |
| Business Pulse metrics | `bookings`/`expenses` aggregates, `daily_summary` view | BCC audit confirms these tables/view exist and are queried elsewhere in `/dashboard` | REUSE (BCC only) | Small addition — real numbers, no new backend logic (matches "Home aggregates existing data") |
| Cross-venture (BEST/BCC/Flow Lab/YTG) filtering | — | No production backend for Flow Lab or YTG anywhere in either audit; BEST/BCC is the only real venture pair (BCC-website serves both storefronts already) | DO NOT BUILD (beyond BCC/BNT) | Keep the filter-chip *pattern* for later; don't wire Flow Lab/YTG data that doesn't exist |
| Notifications (bell) with unread/mentions/updates tabs | Living OS: none found — Codex audit lists no generic notification store | No evidence | MINIMAL NEW | A single, simple feed from `getOpenOperationalItems()` is enough for V1; the mockup's tabbed inbox is aspirational |

### MANAGE

| Capability | Real source system | Evidence | Classification | Final destination |
|---|---|---|---|---|
| Calendar / Instances | `event_dates`, `product_schedules`, `/dashboard` owner calendar | BCC audit: fully implemented, production | REUSE (engine) | See §4 — UI is currently `/dashboard`-only |
| Products / Experiences | `/dashboard/products/*`, full CRUD + content + media | BCC audit: fully implemented | REUSE (engine) | See §4 |
| Event Operations (host brief, closeout, expenses) | `/dashboard` day panel, `/api/admin/dashboard/*`, `/api/admin/events/[id]` | BCC audit: fully implemented; also the "SNX Event Operations" 5-screen mockup you sent last round | REUSE (engine) | See §4 — biggest write-workflow gap in current `/operator` |
| Check-in | `/dashboard/checkin`, QR scanner | BCC audit: "cleanest existing SNX-module candidate" | REUSE (engine) | See §4 |
| People / Guests | `bookings`/`ota_bookings` guest fields | BCC audit: implemented, no normalized guest table | REUSE (data), ADAPT (presentation) | Already read-only in Records/Bookings |
| Bookings | same | same | REUSE | Already read-only in Records/Bookings |
| **Partners** | `sanctuary-nexus` Partner model, entity resolution, Partner Hub | **Codex: "implemented and usable locally"** — real canonical record, contacts/venues/notes/agreements, entity resolution to prevent duplicates, full API + UI | **MIGRATE (engine), ADAPT (UI)** — corrected from v1's "DO NOT BUILD" | Needs a durable store on SNX's production stack (Codex: "Production durability/auth: partially implemented" — local JSON today) — see §5 |
| Inquiries — **refined 2026-09-02, approved** | `bnt_experience_inquiries`, `bnt_contact_messages` (real production data) + Living OS "partial/indirect" intake representation (not a proven pipeline) | BCC audit: real tables, public-facing only, no admin view. Codex: "no full deployed intake-to-resolution inquiry pipeline was found... comparable to a production backend" | Split, not blanket DEFER: **existing inquiry data → REUSE**; **SNX operator inquiry management/state → MINIMAL NEW / ADAPT**; **WhatsApp/Instagram/email channel integrations → DEFER** | Data is real and reusable now; a lightweight in-shell management surface is buildable without a full omnichannel inbox — not built in Phase 1A specifically (see Phase 1A scope), reserved for its own slice |
| Communications (48 unread, mockup) | No generic in-app comms/message-thread store in either system | Codex found only Resend email templates and Partner notes, no thread model | DO NOT BUILD | No evidence anywhere; this is a mockup-only concept |

### CREATE

| Capability | Real source system | Evidence | Classification | Final destination |
|---|---|---|---|---|
| New Product / Experience | `/dashboard/products/new` | BCC audit: full flow exists, production | REUSE (engine), TEMPORARY LINK-OUT (UI) | Create → link to existing flow now; in-shell mobile creation later |
| **Partner + Proposal — Phase 1A: "Coming next," inert** | `sanctuary-nexus` Proposal Builder: `src/lib/proposals.ts`, `proposalWriter.ts`, `proposalDocument.ts`, `/api/proposals`, PDF export | **Codex: "implemented and usable locally, with AI optional/fallback behavior"** — versioned proposals, deal variables, draft→approval freeze→PDF export, all real | **MIGRATE (engine), ADAPT (UI)** — corrected from v1's "DO NOT BUILD" | Same durable-storage caveat as Partners (Codex: "Live storage/auth: needs refactor") — see §5. Shown as a labeled, non-interactive "Coming next" row in Phase 1A |
| New Inquiry | See Manage row above | Partial/indirect only | DEFER | Not proven as an operator-initiated flow anywhere |
| Caption Set — **Phase 1A: "Coming next," inert** | Living OS caption library, SQLite-backed, `/livingos/.../caption-library`; `social-caption` is a real Artifact type | Codex: "Implemented Real local," explicit reusable UI pattern ("segmented available/used views," "copy-and-mark-used interaction") | MIGRATE (engine), ADAPT (UI) | Real, but needs the same storage refactor as everything else Living-OS-sourced — shown as a labeled, non-interactive "Coming next" row in Phase 1A, not a working entry point |
| Recommendation, Blog / SEO Article, Reel Ideas / Scripts, Carousel, Repurpose Content | — | **Not in Codex's artifact-type list at all** (`social-caption, instagram-story-copy, poster-ad-copy, event-brief, whatsapp-broadcast, email-draft, tour-itinerary, proposal, strategy-document, sop-runbook`) — no `blog-article`, `recommendation`, `reel-script`, or `carousel` type exists anywhere in Living OS | **DO NOT BUILD** | Zero implementation evidence in either system. This matches your own framing exactly — these are the mockup's "future possibilities," not proven work |
| "Turn into" asset-remix handoff | No equivalent found in Codex audit | — | DO NOT BUILD | Interesting UX pattern, no backend anywhere to power it |

### QUEST

| Capability | Real source system | Evidence | Classification | Final destination |
|---|---|---|---|---|
| Quick capture / notes / tasks / steps / archive | `sanctuary-nexus` `/quests`, `/api/quests`, `runtimeWorkStore.ts` (`.sanctuary/runtime/work-data.json`); also `/api/workflow-results` decision lifecycle (awaiting-review/approved/changes-requested/rejected) | Codex: "Implemented, Real local" for runtime work store — but tightly coupled to Cortex/specialist/realm routing, not a standalone module | **MINIMAL NEW** | Per your instruction ("do not assume wholesale migration; classify MINIMAL NEW or DEFER"): build a small, SNX-native quests table, inspired by the runtime-work-store *concept*, not its implementation. This is a genuine schema addition — flagged, not decided, in §7 |
| Delegation / assignees | Workflow result "Guide decision" records (approve/request changes/reject) | Codex: real, local | MINIMAL NEW | Same table can carry an `assignee` field; no separate system needed |
| "Ask Hermes" from a Quest | Hermes/Cortex routing | Codex: real routing, but LLM inference depends on a local Ollama-compatible endpoint (`HERMES_API`, default `127.0.0.1:11434`) unreachable from Vercel | DO NOT BUILD (yet) | Matches your "no Hermes wiring" constraint and the architecture doc's "Telegram remains primary" decision |

### MORE

| Capability | Real source system | Evidence | Classification | Final destination |
|---|---|---|---|---|
| Records & History | `event_dates`/`bookings`/`ota_bookings`/`expenses` | Already built | REUSE | Route move only (already planned in v1) |
| Knowledge & Memory / Business Memory | `sanctuary-nexus` `businessMemory.ts`, `businessMemoryStore.ts`, `/api/memories` | Codex: "Implemented locally... SNX read value: high" but storage is a local JSON file, not durable | MIGRATE (read-only), REFACTOR (storage) | A read-only "Knowledge" surface pulling from a *curated subset* of canon (SNX Operator canon, Partnership Framework, Proposal Writing Standard, BEST/BCC venture canon — Codex's own recommended read list), not the full knowledge-tier governance system |
| SOPs & References / Templates / Approved Facts | Living OS `foundation/`, `canon/`, `implementation/` Markdown tiers | Codex: real as documents; explicitly "KEEP IN LIVING OS" for the governance structure itself | DEFER | Codex is explicit: SNX should be able to *read* specific canon, not become a second copy of the knowledge-tier system |
| Files & Outputs (Proposal PDFs, Caption Sets, Event Briefs) | Proposal PDF export (real), Artifact types `event-brief`/`social-caption` (real) | Codex: real generation, but "not stored as durable binary files" in the inspected code | DEFER | Depends entirely on Partners/Proposals/Captions migrating first (§5) — nothing to surface until then |
| System / Integrations / Automations | Nothing found in either audit | — | DO NOT BUILD | No evidence anywhere |
| Team & Permissions | `sanctuary-nexus` permission gateway (P0–P5 authority levels, approvals, audit) | Codex: "Implemented, Real... REUSE IN SNX" as a *model*, but current auth is a local-only owner cookie, explicitly "not suitable as-is for a live mobile Operator OS" | DEFER | The permission *model* is worth reusing conceptually later; today's `admin_users` owner/admin/staff role system already does this job for BCC — don't replace it prematurely |
| Settings (account) | `admin_users` | Already built | REUSE | Already in More |

## 4. Engine vs. UI migration

You're right to separate these — v1 conflated them by defaulting everything BCC-sourced to "REUSE" without saying which half of "REUSE" that was. Restated per capability:

| Capability | Engine (backend/workflow) | Current UI | V1 UI decision |
|---|---|---|---|
| Calendar/Instances | REUSE — production, unchanged | `/dashboard` owner calendar | **TEMPORARY LINK-OUT** now; progressive mobile adaptation later |
| Products/Experiences | REUSE — production, unchanged | `/dashboard/products/*` | **TEMPORARY LINK-OUT** now (already true in More today) |
| Instance Operations | REUSE — production, unchanged | `/dashboard` day panel (desktop-biased, per the original BCC audit) | **ADAPT** — this is the one place a real mobile UI is overdue; matches the 5-screen mockup you sent last round |
| Check-in | REUSE — production, unchanged | `/dashboard/checkin` (already mobile-ready) | **TEMPORARY LINK-OUT** is nearly as good as a rebuild here — the existing UI is already phone-first |
| Partners | **MIGRATE** — real engine, wrong storage | `sanctuary-nexus` Partner Hub (React/Tailwind, tied to local JSON) | **ADAPT** — reuse the *interaction patterns* Codex flagged (directory cards, detail sections for contacts/venues/notes/agreements), not the literal components, against new production API |
| Proposals | **MIGRATE** — real engine, wrong storage | `sanctuary-nexus` Proposal Builder | **ADAPT** — same pattern-reuse approach; Codex explicitly calls this shell-plus-focused-workflow pattern reusable |
| Captions | **MIGRATE** — real engine, wrong storage | `sanctuary-nexus` caption library | **ADAPT** — Codex names the exact reusable interaction: "copy-and-mark-used" |

The rule this produces: **every "TEMPORARY LINK-OUT" is explicitly not final architecture** — it's what lets Manage exist in V1 without rebuilding a proven BCC engine's UI from scratch. Each one is a named candidate for a later ADAPT pass, not a permanent decision.

## 5. Proven Living OS corrections (v1 → v2)

v1 said this, plainly:

> "Partners" ... "No production table exists anywhere" ... **DO NOT BUILD**
> "Proposals" ... same reasoning ... **DO NOT BUILD**
> Content-studio items (captions included) ... **DO NOT BUILD**

That was correct about BCC-website (still true — no BCC production table for either) but wrong about "no proven engine anywhere," because it didn't have the Codex audit. Corrected:

- **Partners**: real, working engine in Living OS (canonical model, entity resolution, full CRUD API+UI) — not production-durable, but proven. **DO NOT BUILD → MIGRATE (engine) / ADAPT (UI)**.
- **Proposals**: real, working lifecycle (versioning, approval freeze, PDF export) — same caveat. **DO NOT BUILD → MIGRATE (engine) / ADAPT (UI)**.
- **Captions**: real, working (SQLite-backed library + a genuine Artifact type). **DO NOT BUILD → MIGRATE (engine) / ADAPT (UI)**.
- **Business Memory**: real, working (search/read model). Was mentioned only as a Phase 5 architecture-doc concept in v1, not classified. **Now: MIGRATE (read-only), REFACTOR (storage)**.

Still correctly unproven — the Codex audit doesn't change these:
- Blog/SEO Article, Recommendation, Reel Ideas/Scripts, Carousel, Repurpose Content — genuinely absent from Living OS's own artifact-type registry, not just absent from BCC.
- The full City Pulse / Observatory-district vision — Codex's own audit calls these "CONCEPT ONLY."
- World/realm visual interface, 3D assets, wildlife/specialist mythology — Codex's own audit says "DO NOT MIGRATE."

## 6. Deferred / mockup-only capabilities — do not build yet

Explicitly, with the reason each one is being held:

- **Cross-venture Flow Lab/YTG data on Home/Manage/Business Pulse** — no production backend for either venture exists in any audited system.
- **In-app Communications thread (48 unread, Home/Manage mockups)** — no message-thread store anywhere; only email templates and Partner notes exist.
- **Notifications with Mentions/Updates tabs** — no notification store anywhere; a simple single feed covers the real need.
- **New Inquiry (operator-initiated)** — no proven intake pipeline; Codex calls Living OS's version "partial/indirect."
- **Blog/SEO Article, Recommendation, Reel Ideas/Scripts, Carousel, Repurpose Content** — zero implementation evidence in either system; explicitly named by you as unproven.
- **"Turn into" asset-remix handoff (Create screen 3)** — no backend equivalent anywhere.
- **Knowledge/SOP/Canon browsing beyond a curated read list** — Codex is explicit these should stay governed inside Living OS.
- **Files & Outputs library** — nothing to show until Proposals/Captions actually migrate.
- **System/Integrations/Automations/Team & Permissions UI** — no evidence anywhere; the real permission model (Living OS's gateway) isn't production-ready, and BCC's existing `admin_users` role system already covers V1's actual need.
- **"Ask Hermes" anywhere in the shell** — matches your standing "no Hermes wiring" rule; also blocked practically since Hermes inference depends on a local-only endpoint unreachable from Vercel.

## 7a. Approved refinements (2026-09-02) and Phase 1A scope

This v2 audit is **approved**, with two classification refinements before implementation:

1. **Inquiry** is no longer a blanket DEFER — see the corrected Manage-table row above. Existing data REUSEs now; a lightweight management surface is MINIMAL NEW/ADAPT territory for its own future slice; channel integrations (WhatsApp/Instagram/email) stay DEFER indefinitely.
2. **Create Hub, Phase 1A** — not everything MIGRATE-classified gets a visible entry point yet. Active: New Product/Experience only. "Coming next" (visible, explicitly labeled, non-interactive): Partner + Proposal, Caption Set. Everything else in the Create matrix above (Blog/SEO Article, Recommendation, Reel Ideas/Scripts, Carousel, Repurpose Content, the asset-remix "Turn into" pattern) is hidden entirely from the Phase 1A shell, not shown even as a placeholder.

**Phase 1A ("Five-Tab Shell Alignment")** is the slice actually being implemented following this audit: rewire the bottom nav to Home/Manage/Create/Quest/More, populate Manage with temporary link-outs to proven BCC engines plus the existing in-shell Bookings/Events reads, populate Create per the two tiers above, ship Quest as an empty shell (no table, no backend), relocate Records under More, and unlink Work/Hermes from primary navigation without deleting their routes. No new tables, no schema changes, no Partner/Proposal/Caption/Quest migration, no deep Event Operations build, no Hermes wiring — all reserved for later, individually-approved slices.

## 7. Recommended first implementation slice (superseded by §7a — this is what's now approved and in progress)

Everything here is either REUSE, ADAPT (against an already-reused engine), or a link-out — with one flagged exception. No content-studio speculative work, no cross-venture data, no Hermes.

1. **Shell rewire**: `OperatorBottomNav.tsx` → 5 new tabs; route shells at `/operator/manage`, `/operator/create`, `/operator/quest`.
2. **Home**: keep as-is; convert "what needs attention" into the bell/notification pattern (unchanged from v1's recommendation); add one real Business Pulse metric (today's revenue/expense) since the data already exists.
3. **Manage**: populate with REUSE-tier BCC items only, as TEMPORARY LINK-OUTs (Calendar, Products, Check-in) plus in-shell Records/Bookings and Records/Events (already built, just relabeled). Do **not** build Partners here yet — see the flagged exception below.
4. **Create**: a menu — REUSE link-out for New Product; explicitly inert rows for everything else, including Partner+Proposal and Captions **for now** (see below).
5. **Quest**: ship as a visible placeholder tab, same as v1's recommendation — MINIMAL NEW still means new schema, which is a real scope decision, not a shell-alignment one.
6. **Records**: relocate under More, unchanged from v1.
7. **Hermes/Work**: unlink from bottom nav, keep files in place, unchanged from v1.

**Flagged exception, not decided here:** Partners, Proposals, and Captions are now correctly classified MIGRATE/ADAPT instead of DO NOT BUILD — but actually building any of them means new Supabase tables (`partners`, `proposals`, and reusing/extending `product_media`-style storage for captions) on SNX's production stack, which crosses every "no new tables / no schema changes" line you've drawn in every prior pass. That's a real, separate decision — bigger than a shell-alignment pass — and I'm surfacing it rather than either building it or quietly deferring it without saying so. If you want it in scope, it should be its own approved slice, not folded into the nav rewire.

---

Holding here per your instruction — no code changes made. Waiting on your approval of this alignment before Phase 2, and specifically your call on the Partners/Proposals/Captions scope question in §7.
