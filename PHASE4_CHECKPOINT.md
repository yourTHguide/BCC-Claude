# Phase 4 — Internal Product & Schedule Builder — Checkpoint

_Last updated: 2026-08-23 (SNX Product Admin session: Stages 1–4, then a 4.1 presentation refinement and a 4.2 Quick Facts formatting fix — see "SNX Product Admin — Icon System, Content Model, ProductPage Refinement" below. New in Bangkok's ProductPage/Draft Preview is now considered feature-complete and approved; the earlier "Not done yet" bullets below claiming ProductPage/Draft Preview/public route were "not started" are STALE — see that section and "Where we are, revised" for the corrected current state)._ Compact resume doc for continuing in a fresh conversation.

### Stage A functional-parity pass (locks "mobile = desktop, minus space")

Principle: mobile must reach every canonical field desktop can reach — desktop
just shows more at once. This pass closed the remaining "read-only dashboard"
spots, UI-only (the one API route this whole track ever needed, `PATCH
/api/admin/products/[id]`, already existed from the prior correction pass):

- **Quick Facts (Content tab) are now shortcuts, not a dead end.** Removed
  "read-only, not editable here." Each of the 4 rows (Next Date/Start Time/
  Price/Duration) is tappable: Duration opens this tab's own Basics section;
  Start Time and Price switch to the Overview tab AND auto-open that field's
  focused editor in one tap (`ContentEditor`'s new `onNavigate` prop, wired
  by `page.tsx`'s `handleNavigateFromQuickFacts`); Next Date switches to
  Schedule. A missing value shows "Not set" and is still tappable — still
  zero new fields/routes, still derived exactly like `ProductPage.tsx`.
- **Overview/Operational got the same desktop/mobile split as Content/Media/
  Schedule** (it never had one before — same always-expanded form on every
  screen size, which is why it read as "a dashboard" on a phone despite
  already being wired to real PATCH calls). Desktop: unchanged. Mobile:
  Status (plain, since Draft<->Active stays exclusively behind Activate/
  Deactivate — no raw status editor), Storefront Visibility as two switches
  that **apply immediately** (the one explicit inline-control exception —
  everything else is tap-then-save), Default Price/Default Start Time as
  tap-to-edit rows opening a single-field focused editor, a Preview Product
  row, then Activate/Deactivate (shared JSX with desktop, extracted once).
  Immediate switches read straight from `product` (never from `opDraft`),
  so they can't be affected by an abandoned edit sitting in a sibling field.
  Tapping Back on a Price/Time focused editor resets the shared `opDraft`
  back to `draftFromProduct(product)` — required specifically because Price/
  Time and the switches share one draft object; without this reset, an
  unsaved Price edit would silently ride along on the next switch toggle's
  PATCH. Verified via a mocked-fetch harness that renders the REAL
  `dashboard/products/[id]/page.tsx` (not a copy) from a route outside
  `/dashboard` so neither `middleware.ts` nor `dashboard/layout.tsx` gate it
  — no auth file touched: typed 9999 into Price, hit Back, then toggled BCC
  off; the resulting PATCH carried `defaultPrice: 1200` (the original,
  confirmed value), not 9999, alongside the confirm-dialog-gated
  `visibleBcc: false`.
- **Media's mobile summary is now visual**, not text-only. `CoverSummaryCard`
  and `GallerySummaryCard` (new, in `sections/mediaSections.tsx`) show the
  actual cover image / a 5-photo gallery strip on the main Media screen,
  tapping either opens the exact same focused Cover/Gallery editors that
  already existed (upload/replace/delete/reorder/alt-text) — zero new media
  routes, zero new upload paths.
- **Content**: `Basics` summary now reads "Complete" instead of "4 of 4
  filled" once every field is set — the only Content-tab change.
- **Fixed a pre-existing horizontal-overflow bug** in the shared tab-bar
  header (found while screenshotting the above): the "Preview Event Page"
  ghost link, sitting next to 4 tab buttons with no wrap, forced sideways
  scroll below 768px. Hid it on mobile (redundant now that Overview has its
  own "Preview Product" row) behind a wrapper div — putting the
  `pe-desktop-only` class directly on the `<Link>` doesn't work, because its
  own inline `display: 'inline-flex'` style always wins over a class-based
  `display: none`, media query or not.
- **Explicitly deferred** (flagged, not built — matches "don't overbuild in
  one pass"): schedule type/weekday/start-date/generation-horizon have no
  edit API today, only Extend exists. A future stage, not this one.

### Stage A correction pass (same track, after the initial Stage A commit)

Three fixes on top of the initial Stage A pass, all still UI-only except one
small additive route:

1. **Nav rename, no architecture change.** Top-level tab "Schedule /
   Instances" -> "Schedule". `ScheduleEditor.tsx` replaces
   `InstancesPanel.tsx`. Product -> Schedule -> Event Instance is untouched.
2. **Event Dates are genuinely mobile-first.** The old table forced
   horizontal scroll on mobile to see Start/Capacity/Bookings/Actions.
   Desktop keeps the exact table. Mobile gets 3 screens: a read-only
   Schedule summary (type/day/start date/generate-through + Extend), an
   Event Dates card list (no horizontal scroll — date/status/time/price/
   bookings/capacity all visible per card), and a focused Edit Event Date
   editor. That editor's "Save Changes" bundles start-time/price/capacity
   into one `PATCH /api/admin/events/[id]` call (verified: that route only
   ever touches keys present in its body, so this is safe); Close/Reopen
   and Delete stay separate immediate actions — identical action boundaries
   to the desktop table. No new routes for this part.
3. **Operational is now actually editable**, per explicit follow-up
   request. Before this, `GET /api/admin/products/[id]` was read-only and
   activate/deactivate only ever touched `visible_bcc`/`visible_bnt` as part
   of the guarded Draft<->Active transition — there was no way to edit
   `default_price`, `default_start_time`, or flip visibility on an
   already-created product. **Added `PATCH /api/admin/products/[id]`**
   (same file as the existing `GET`): partial-update semantics (only keys
   present in the body change, same pattern as `PATCH /api/admin/events/
   [id]`), accepts only `defaultPrice`/`defaultStartTime`/`visibleBcc`/
   `visibleBnt` — **deliberately never `status`**, so Draft<->Active stays
   exclusively behind activate/deactivate's guarded transitions and this
   route can't bypass them. The Overview tab's Operational card now has
   live inputs/toggles for those 4 fields plus a "Save Changes" button
   (disabled when nothing changed); turning BCC visibility off while the
   product is Active shows a confirm() first (same pattern as the existing
   Deactivate confirm), since that immediately affects checkout (gate 5
   checks `visible_bcc` directly). Identity (Product ID/Created/Updated)
   stays read-only, visually secondary.
   Verified via a throwaway harness mirroring the exact handler logic (real
   route is behind middleware.ts + dashboard/layout.tsx auth gates this
   environment can't authenticate through): Save disabled with no changes,
   enabled after an edit, PATCH body carries all 4 current values on save,
   confirm() fires only when BCC transitions true->false while Active (not
   on unrelated edits), and the resulting state matches the confirmed edit.

## Mobile-first Admin Product Editor (separate track — UI-only, no data model changes)

A third, separately-scoped track: the `/dashboard/products/[id]` Content and
Media tabs get a responsive, mobile-first editing shell, planned as
**A. Section-component refactor + mobile shell (content read/write only) →
B–E. TBD (not scoped yet) → F. Desktop layout refinement**. This track is
explicitly **UI-only** — it changes zero routes, zero schema, zero save
semantics beyond what already existed. Branched from
`claude/phase4c-content-media-audit-dvu5c1` @ `46db54d` (the BNT integration
Stage A commit) — this is the "current Phase 4 admin branch" referenced
below, not `main`.

### Stage A — mobile section shell for Content + Media — COMPLETE

**The problem this solves:** before Stage A, `/dashboard/products/[id]`'s
Content tab was one ~600px-tall form with every field open at once
(tagline, 3 descriptions, duration, 4 meeting-point fields, 3 repeatable
lists, an itinerary builder, 2 more repeatable lists) and no way to jump to
just one part of it on a phone. Stage A does not add or remove any field —
it restructures how the *same* fields are reached and saved.

**Mobile shell architecture.** New `app/dashboard/products/[id]/sections/`
directory holds the pieces every section shares:
- `types.ts` — `ProductContent`/`MeetingPoint`/`MediaRow` (the exact shapes
  `GET /api/admin/products/[id]/content` and `.../media` already return —
  no new fields added here).
- `Controls.tsx` — `StringListEditor`/`ItineraryEditor`, moved verbatim out
  of the old `ContentTab.tsx`.
- `contentSections.tsx` — the 6 EVENT PAGE CONTENT sections, each a pure
  `{ id, label, Fields, summary }` tuple: `Fields` is a controlled
  `(content, onChange) => JSX` editor for that section's slice;
  `summary(content)` is a **display-only** derivation ("3 items", "Added",
  "Not started") never sent to the server. Sections: **Basics**
  (tagline/short & full description/duration — added as a 6th section per
  explicit follow-up decision so these stay mobile-editable; not one of the
  5 originally sketched in the mockup), **Highlights**, **What's Included**,
  **How The Night Goes** (itinerary), **Meeting Point**, **Good To Know**
  (`whats_not_included` + `important_info` together — matches
  `ProductPage.tsx`'s actual public "GOOD TO KNOW" section 1:1, which
  already renders those two fields side by side).
- `mediaSections.tsx` — **Cover** and **Gallery**, same pattern, but their
  handlers (`onUploadCover`, `onDelete`, `onMove`, …) call the existing
  media routes directly and immediately — there is no deferred draft for
  media, so their focused-editor chrome shows "Done" instead of "Save".
- `MobileSectionShell.tsx` — `SectionListGroup` (the compact tappable list
  with live summaries) and `FocusedEditorChrome` (the sticky
  "← Back / Title / Save" header). Purely presentational, no data
  knowledge — this is the one reusable "mobile-first section shell"
  component both editors below are built from.
- `QuickFacts.tsx` — read-only, re-derives Next Date/Start Time/Duration/
  Price from the same inputs `ProductPage.tsx` already uses (product
  default price/time, next open Event Instance date, `duration_minutes`).
  **No editor, no new field, no new route** — it is explicitly labeled
  "Auto-generated from schedule, time, duration and price — read-only, not
  editable here" and shown once, above the mobile section list.

**Orchestrators** (replace the old `ContentTab.tsx` / `MediaTab.tsx`,
same import site in `page.tsx`, same tab structure — Overview / Schedule-
Instances / Content / Media are unchanged on both breakpoints):
- `ContentEditor.tsx` — loads the one `product_content` row, and renders
  responsively via a CSS breakpoint at 768px (`.pe-desktop-only` /
  `.pe-mobile-only`, same technique `ProductPage.tsx` already uses for its
  sticky mobile bar — both trees are in the DOM, CSS decides which one
  paints, so there's no client JS breakpoint detection to get wrong or
  flash on hydration). Desktop: all 6 sections stacked, one "Save Content"
  button — pixel-identical structure to the pre-Stage-A form. Mobile: the
  Quick Facts card, then the compact list; tapping a row opens
  `FocusedEditorChrome` around just that section's `Fields`.
- `MediaEditor.tsx` — same shape for Cover/Gallery, all upload/delete/
  reorder/alt-edit logic moved verbatim from the old `MediaTab.tsx`.

**Desktop is intentionally untouched behaviorally.** Same 4 tabs, same
stacked forms, same single Save button, same Cover/Gallery panel — Stage A
only moved the JSX into shared components; Stage F owns any future desktop
layout redesign.

### Save semantics — the part audited before writing any editor code

`PUT /api/admin/products/[id]/content` (`app/api/admin/products/[id]/
content/route.ts`) is a **whole-row upsert**: it builds one `product_content`
row from the request body and every field the validators don't see as a
present value becomes `null`/`[]`/`{}` — there is no partial-update path,
and the route was correctly never asked to grow one (that would be a schema/
API change, out of Stage A's scope). Before Stage A, this was safe by
construction because `ContentTab.tsx` was one form holding the *entire*
content object in memory and always PUT all of it. Splitting the UI into
independently-tappable sections would have broken that guarantee if a
focused section's Save PUT'd only its own field — every sibling field would
have been wiped.

Stage A's fix, enforced in `ContentEditor.tsx`:
- The full `ProductContent` is loaded once and held as `content` (the
  last-saved baseline).
- **Desktop:** every section's `Fields` component is bound directly to
  `content`; the one Save button PUTs `content` in full — unchanged from
  before.
- **Mobile:** opening a section clones the *entire current baseline* into a
  local `draft`. That section's `Fields` component can only patch its own
  keys (e.g. `HighlightsFields` only ever calls `onChange({ highlights })`),
  so every other key in `draft` stays byte-identical to `content`. **Save**
  PUTs `draft` in full (all fields, touched or not) and only then replaces
  `content` with the server's response. **Back** discards `draft` without
  ever calling the API — no request is sent, so an abandoned edit can't leak
  into a later save from another section.
- Media's routes are already row-scoped (`POST` one upload, `PATCH`/
  `DELETE` one media row by id) with no whole-row upsert, so this risk does
  not apply there — Stage A changed nothing about how those calls are made.

**Verified**, via a temporary local mock harness (mocked `fetch`, no real
Supabase reachable in this environment — real product data will need this
re-verified in Preview, see PR description) driven with Playwright:
1. Opening **Highlights**, adding a 4th item, and tapping **Save** produced
   one `PUT` whose body carried the new highlight *and* every other field
   (`tagline`, `meetingPoint`, all 5 itinerary steps, `whatsIncluded`,
   `whatsNotIncluded`, `importantInfo`) unchanged from the loaded baseline —
   11/11 automated assertions passed.
2. Opening **Meeting Point**, editing `display_name`, then tapping **Back**
   (not Save) fired **zero** PUT requests, and reopening Meeting Point
   showed the original unmodified value — confirming discard-on-Back works
   and can't accidentally persist.
3. `npx tsc --noEmit` and `npm run build` both clean before and after.

### Not done / explicitly out of scope for Stage A
- Ticket Types, Category, SEO, Minimum Notice, Cancellation Policy,
  product-level capacity, product-level booking status — not touched, not
  added anywhere in this stage.
- No show/hide toggles were added for optional sections — a section still
  renders publicly purely because `ProductPage.tsx` finds non-empty data in
  it, exactly as before.
- `ProductPage.tsx` (public renderer), `/dashboard/products/[id]/preview`
  (authenticated Draft Preview), and `/events/[slug]` (public route) were
  **not modified at all** — verified by `git diff` showing zero changes to
  any of the three.
- Desktop's tab bar and per-tab layout were not restructured — still
  Overview / Schedule-Instances / Content / Media, unchanged.
- Stages B–E of this track are unscoped placeholders; **Stage F** (desktop
  layout refinement) is explicitly reserved and not started.

## SNX Product Admin — Icon System, Content Model, ProductPage Refinement (Stages 1–4.2, THIS session)

A fourth, separately-scoped track, on the SAME branch as the Mobile-first
Admin Product Editor track above (`claude/mobile-admin-editor-stage-a-kv6e43`
— see "Where we are, revised" below for the exact current HEAD). Where the
Mobile-first Admin Product Editor track (above) restructured HOW the admin
reaches fields, this track changed WHAT the public `ProductPage.tsx` looks
like and added icon support to one content field. Sequenced as Stage 1
(data contract) → Stage 2 (public rendering) → Stage 3 (admin item editor)
→ Stage 4 (scope narrowed to What's Included only + Quick Add presets,
after user review of real screenshots) → Stage 4.1 (What's Included card
grid + real map preview) → Stage 4.2 (Quick Facts compact formatting).
**All of it is Preview-only on this branch; nothing here has touched
`main` or production.**

### Canonical content-item data contract (Stage 1, unchanged since)
`lib/contentItems.ts` defines `ContentItem = string | { icon?: string; text:
string }` — the type for `product_content.highlights` / `whats_included` /
`whats_not_included` / `important_info` (all `JSONB` columns already, per
Migration C v3 above — **no DB migration was ever needed for icon
support**). A plain string (every row saved before this track existed, and
still valid forever after) means exactly what it always meant: text, no
icon. `validateContentItemList()` (used by `PUT /api/admin/products/[id]/
content`) accepts either shape additively, checking `icon` only for being a
string — never for membership in the current icon registry — so a future
icon addition/removal can never retroactively invalidate stored data.
`getItemText()`/`getItemIcon()` are the two accessors every consumer
(editor and renderer alike) uses instead of ever branching on `typeof item`
by hand.

### Icon registry (Stage 1, extended in Stage 4)
`lib/contentIcons.tsx` — `CONTENT_ICONS` (a `Record<id, LucideIcon>`, ~24
entries after Stage 4's `camera`/`vip`/`other` additions),
`resolveContentIcon(id)` (returns the component or `null` for anything
missing/unknown/deprecated — the "fail gracefully" contract: nothing here
ever throws on a bad id), and `CONTENT_ICON_LABELS` (human-readable picker
labels, e.g. `wine` → "Drinks" — admin-only; **`components/ProductPage.tsx`
never imports `CONTENT_ICON_LABELS`**). Chose `lucide-react` over a
hand-built SVG set after confirming it tree-shakes cleanly (`sideEffects:
false`, proper ESM entry) — named-import usage here adds only a few KB to
the relevant routes, not the full ~31MB unpacked package.

### Icons are scoped to What's Included ONLY (Stage 4 — narrowed from the original Stage 1–3 plan)
Stages 1–3 built icon support generically across Highlights/What's
Included/What's Not Included/Important Info. **After the user reviewed real
mobile screenshots, this was deliberately narrowed**: icons only make sense
on What's Included; Highlights and Good To Know should stay clean text,
with visual hierarchy coming from layout/typography, not per-line
decoration. The underlying `ContentItem` data contract was **not** rolled
back (still `string | {icon, text}` for all four fields, so nothing
breaks if a legacy/imported row happens to carry an icon on one of the
other three) — only the ADMIN EDITOR UX and the PUBLIC RENDERING were
narrowed:
- **Admin** (`app/dashboard/products/[id]/sections/`): `ItemListEditor`
  (icon picker + text + reorder + delete, in `Controls.tsx`) is used ONLY
  by `WhatsIncludedFields` (`contentSections.tsx`). `HighlightsFields` and
  `GoodToKnowFields` use the new `TextListEditor` (`Controls.tsx`) — same
  interaction model (reorder/delete/add), no icon button. `TextListEditor`
  still operates on `ContentItem[]`: editing a plain string's text keeps it
  a plain string; editing a (hypothetical, currently nonexistent in real
  data) structured item's text preserves its icon field untouched — the
  editor restriction never mutates data on its own.
- **Public** (`components/ProductPage.tsx`): `IconItemList` (icon-led) is
  used ONLY for What's Included, rendered as `IncludedCardGrid` (see next
  section). `BulletList` (always a plain crimson dot, ignores any icon
  field even if present) is used for Highlights and both Good To Know
  lists.

### What's Included: admin Quick Add + icon picker (Stage 3, extended Stage 4)
Focused editor (`WhatsIncludedFields` in `contentSections.tsx`) layout, top
to bottom:
1. **Quick Add grid** — 9 preset tiles (`app/dashboard/products/[id]/
   sections/whatsIncludedPresets.ts`, admin-only, **never imported by
   ProductPage.tsx**): Welcome drink, Entry to venues, Host, Drinking
   games, Transport, Food, Photo ops, VIP access, Other. Tapping one
   appends a normal `{icon, text}` `ContentItem` — **no preset id is ever
   stored**, matching the original architecture rule. A best-effort
   duplicate guard skips a second tap of the same preset if an item with
   identical (trimmed, case-insensitive) text already exists; it never
   restricts manually-typed custom text, including intentional near-
   duplicates.
2. **"Your Items (n)"** heading + "Clear all" link, then the `ItemListEditor`
   list itself: `[icon button] [text input] [↑] [↓] [✕]` per row. Tapping
   the icon button opens `IconPickerPanel` (`Controls.tsx`) — a visual grid
   of every registry icon with its human-readable label plus a "No icon"
   option, never a raw id to type. Assigning an icon is the ONLY thing that
   upgrades a plain string to `{icon, text}` object form; picking "No icon"
   converts it back to a plain string.
3. **"+ Add custom item"** — appends a blank item; icon/text set the same
   way as any preset-added item. Presets never restrict what a custom item
   can be.
Mobile: compact section list → this focused editor (Stage A's
established interaction shell, `MobileSectionShell.tsx`, reused unchanged).
Desktop: same `WhatsIncludedFields` component, stacked inline with every
other section — same data, same editor, per the original "no separate
mobile/desktop editors" rule.

### ProductPage.tsx rendering (Stage 2, then revised in Stage 4.1)
Current section order (unchanged since Stage 2, approved): **Hero → Quick
Facts → Highlights → Gallery → What's Included → How The Night Goes
(itinerary timeline) → Meeting Point → Good To Know → Book CTA**. Key
pieces:
- **Quick Facts** — 4 items (Next Date/Start Time/Duration/Price), each
  with a fixed Lucide icon (Calendar/Clock/Timer/Tag — NOT admin-
  selectable, unrelated to the content-item icon registry). **Stage 4.2**:
  `formatEventDate()` drops the weekday (`"1 Sept"`, not `"Tue 1 Sept"` —
  `en-GB`'s Intl abbreviation for September specifically is "Sept", not
  "Sep"; this is locale/ICU behavior, not a hardcoded string, and other
  months are unaffected) and the Price quick-fact shows the bare amount
  (`"฿590"`, no `"/ person"` suffix — the Book Now CTA and sticky bar still
  spell "per person"/"PERSON" out in full, unchanged). The four items' gap/
  font-size/letter-spacing/icon-size live in `.pp-quickfacts-row/-item/
  -label/-value` CSS classes (NOT inline styles — see the code comment
  right above them for why: an inline style on a property always beats a
  class's `@media` override) with a `max-width:480px` query that tightens
  spacing so all 4 fit on one row on a phone without wrapping — verified
  by real bounding-box measurement (~422px of content+gaps at mobile width
  before the fix, ~319px after, against a ~350px available width).
- **Highlights** — `BulletList`, `twoCol` (2-col grid ≥640px). Plain
  crimson-dot bullets always, regardless of any icon field.
- **Gallery** — horizontal scroll-snap strip, positioned right after
  Highlights (moved up from its original end-of-page position in Stage 2
  specifically so photography breaks up the copy sooner).
- **What's Included** — `IncludedCardGrid` (Stage 4.1, replacing the
  Stage 2–4 `IconItemList` row-list treatment for this field only): compact
  cards, centered icon badge (a generic `Check` icon as the graceful
  fallback for a plain string or unresolvable icon id — never an empty
  circle), text below, dark card + restrained fuchsia border
  (`.pp-included-grid`/`.pp-included-card`/`.pp-included-icon-badge`/
  `.pp-included-text`). 2 columns on mobile, 3 from 640px, wrapping
  naturally — never a fixed card count.
- **How The Night Goes** — the itinerary timeline (`.pp-timeline-row`/
  `.pp-timeline-marker`), untouched since Stage 2's visual refinement
  (marker size/border/shadow only; the underlying `{title, description}[]`
  data/logic has never changed in this track).
- **Meeting Point** — **Stage 4.1** replaced the Stage 2 decorative
  grid/pin placeholder with a REAL map preview: `mapEmbedSrc()` builds
  `https://maps.google.com/maps?q=<display_name>, <address>&z=16&
  output=embed` — the classic no-API-key Google Maps embed endpoint
  (distinct from the billed Google Maps Embed API), reusing the EXACT
  pattern `components/WeekendsPage.tsx` (Bangkok Club Crawl's own "Where We
  Go" section) already used in production, confirmed by inspection before
  writing any code. Built only from canonical `meeting_point.display_name`/
  `address` — **never a hardcoded venue**. Layout: `.pp-map-embed` (iframe,
  220px tall, `overflow:hidden`, 1px border matching BCC's own
  `.map-placeholder`) on top, `.pp-meeting-card` (venue name, address,
  instructions, "Open in Google Maps →" linking to the stored
  `maps_url`) below. **Privacy rules** (verified, not just assumed):
  - `public` → map + full card renders.
  - `after_booking` → NO map, NO address, NO maps link; only "Full address
    sent after booking." The PUBLIC route (`app/api/products/[slug]/
    route.ts`, `sanitizeMeetingPoint()`) already strips ALL location fields
    server-side for this case, unchanged by this track. The authenticated
    admin Draft Preview route (`/api/admin/products/[id]/preview`)
    intentionally passes the FULL `meeting_point` through for admin
    review, so `ProductPage.tsx`'s own `visibility` check is what keeps
    after_booking/private from rendering location details THERE too —
    confirmed via a 3-way synthetic render (public/after_booking/private
    of the same real venue) that neither leaks.
  - `private` (or unset/invalid) → the entire Meeting Point section is
    omitted, not just the address.
- **Good To Know** — `BulletList` for both `whats_not_included` and
  `important_info` (Stage 4, narrowed from Stage 2's icon-capable
  treatment — see "Icons are scoped to What's Included ONLY" above).

### New in Bangkok's real current state (as of this session's last commit)
`product_id = 75466d68-23b6-45a9-bc68-96f002fb6b1e`, `slug = new-in-bkk`.
Confirmed via a read-only query immediately before this session's final
commit:
- `products.status = 'draft'`, `visible_bcc = false`, `visible_bnt = false`
  — **unchanged throughout this entire track**, reconfirmed after every
  stage and again at session close.
- `product_content.whats_included` — the only field this track wrote to
  for real (once, explicitly, in Stage 4 — see next bullet):
  `[{"icon":"wine","text":"Welcome shot on arrival"}, {"icon":"host",
  "text":"Hosted introductions throughout the night"}, {"icon":"ticket",
  "text":"Entry to two venues"}]`. Wording and order are byte-identical to
  the pre-existing approved copy — only the `icon` keys were added.
- `product_content.highlights` / `whats_not_included` / `important_info` —
  still the original plain-string arrays from before this track; never
  touched.
- `product_content.tagline`/`short_description`/`full_description`/
  `duration_minutes`/`itinerary`/`meeting_point` (real Don't Open the
  Fridge venue, `visibility:'public'`) — all pre-existing, unchanged by
  this track.
- `product_media` — the 3 real rows from Stage 8d (1 cover + 2 gallery),
  unchanged.
- `event_dates` — 12 real open weekly Tuesday rows starting 2026-09-01,
  unchanged (this track never touched `event_dates`/`product_schedules`).

**How the `whats_included` write was done**: no authenticated admin browser
session exists in this sandboxed agent environment (same constraint noted
throughout this doc — see "How to resume" below), so every admin-workflow
verification in Stages 3–4 used a throwaway harness under
`app/dev-preview/*` (always deleted before that stage's commit) rendering
the REAL admin components with `window.fetch` intercepted for the
auth-gated `/api/admin/*` routes only. The one real write — assigning the
three icons above — was applied as a single `UPDATE ... SET whats_included
= ...` mirroring `PUT /api/admin/products/[id]/content`'s exact validated
output shape (same technique already used earlier in this doc's history to
originally populate this row, see Stage 8d) — not a migration, not an
automatic conversion of any other product's data.

### Known unresolved technical issues (not fixed in this track — out of scope, no visual/behavioral effect)
1. **`<style>{...}}` SSR/CSR text-escaping hydration warning in
   `ProductPage.tsx`.** Console shows "Text content did not match" /
   "error while hydrating" warnings in dev mode. Root-caused in Stage 4.2:
   apostrophes/quotes inside the giant `<style>{`...`}`}` template
   literal's CSS comments (e.g. "Bangkok Club Crawl's own map", "class's
   @media override") cause React to HTML-entity-escape them during SSR
   (`&#x27;`) while the client's re-render produces the literal character —
   a mismatch in the `<style>` tag's own text content, not in any visible
   page text. This predates this session (the very first version of this
   `<style>` block, written in Stage 2, already had a quoted phrase —
   `'View on map'` — inside a comment). Purely cosmetic/console-only; never
   observed to affect actual rendered output. The previously-suspected
   SEPARATE cause (locale-dependent weekday+comma date formatting,
   `"Tue 1 Sept"` vs `"Tue, 1 Sept"`) is very likely resolved as a side
   effect of Stage 4.2 removing `weekday` from `formatEventDate()` — not
   independently re-verified beyond what's in the Stage 4.2 commit message.
   A real fix (if ever wanted) would move the `<style>` block to
   `dangerouslySetInnerHTML` or a `.css`/CSS-module file instead of a JSX
   template-literal child.
2. Everything else flagged as "explicitly deferred" in each stage's own
   commit message (Stage 4's Meeting Point admin visual treatment inside
   the EDITOR — as opposed to the PUBLIC page, which Stage 4.1 did handle —
   was never separately revisited; the admin `MeetingPointFields` form is
   still the plain Stage-A text-field form, not visually enhanced to match
   the public page's new map preview. Not blocking — admins can still set
   every field correctly, just without a live map preview in the editor
   itself.)

### Protected areas confirmed untouched by this entire track (git-diff-verified, not just assumed)
- **Bangkok Club Crawl** (`components/WeekendsPage.tsx` and everything else
  under its live production path) — read once (Stage 4.1) purely for
  reference to find its map-embed pattern; zero lines changed.
- **Legacy `/new-in-bangkok`** page — never opened or touched.
- **Checkout / Stripe** (`/api/create-checkout`, `/api/webhook`, `/book`) —
  never opened or touched.
- **`main` branch** — every commit in this track is on
  `claude/mobile-admin-editor-stage-a-kv6e43`; nothing merged.
- **Bangkok Club Crawl's live product row, bookings, or any operational
  data** — this track's only database write ever was the single
  `whats_included` UPDATE on `new-in-bkk` described above; every other
  interaction with Supabase in this track was a read-only `SELECT`.

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

> **Where we are, revised (2026-08-23):** the branch/HEAD line immediately
> below is HISTORICAL (as of Stage 8d) — the branch has since moved on
> through the Mobile-first Admin Product Editor track and the SNX Product
> Admin track (both documented above). **Current branch:
> `claude/mobile-admin-editor-stage-a-kv6e43`. Current HEAD:
> `1f62910` ("Final Quick Facts refinement: compact date/price, no wrap on
> mobile").** Still not merged to `main`. `ProductPage.tsx`, the
> authenticated Draft Preview (`/dashboard/products/[id]/preview`), and the
> public `/events/[slug]` route mentioned as "not started" a few bullets
> down are now BUILT and, as of this session, considered feature-complete
> and approved for New in Bangkok — see the SNX Product Admin section
> above and "Not done yet, revised" below.

- **Working branch (historical, Stage 8d):** `claude/phase4c-content-media-audit-dvu5c1`, based on
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

## Not done yet (historical, Stage 8d — see "Not done yet, revised" immediately below for current reality)
- ~~`ProductPage.tsx`, authenticated Draft preview
  (`/dashboard/products/[id]/preview`), public `/events/[slug]` — not
  started (Stages 8e–8k)~~ **SUPERSEDED — these are now built and refined**,
  see "SNX Product Admin — Icon System, Content Model, ProductPage
  Refinement" above.
- **New in Bangkok stays Draft** through all of Stage 8 — Preview and
  production share the same Supabase project, so Activate/Publish is never
  used as a preview mechanism. Draft review happens via the authenticated
  admin preview route once built (Stage 8f), not by flipping `status`.
  **Still true today** — New in Bangkok is still Draft, reconfirmed at the
  end of this session.
- **BNT storefront + BNT checkout** — not started; `visible_bnt` is inert.
  **Still true today.**
- **Archive** product-lifecycle state — intentionally deferred (not needed for
  New in Bangkok; Draft ⇄ Active is the full lifecycle for now). **Still
  true today.**
- **Security hardening** (deferred tech debt): old dashboard anon-key writes,
  public `bookings` read (PII), unauthenticated legacy ops routes,
  `daily_summary` SECURITY DEFINER. See the security tech-debt notes.
  **Still true today — not touched by any track in this doc.**

### Not done yet, revised (2026-08-23) — current reality
New in Bangkok's canonical Product/content/media/schedule and its
`ProductPage.tsx` rendering are now considered **feature-complete and
approved** (this session's final user message: "New in Bangkok now looks
good and I approve the current ProductPage direction"). What's genuinely
not done, going into the next session:
- **The booking/customer journey** — see "Next session objective" right
  before "How to resume" below. This is the explicit next phase.
- **BNT storefront + BNT checkout** — still not started; `visible_bnt`
  still inert.
- **Admin `MeetingPointFields` visual treatment** — the admin EDITOR form
  for Meeting Point is still Stage-A's plain text fields; only the PUBLIC
  page (Stage 4.1) got the real map preview. Not blocking, just noted as
  the one visual-parity gap between admin and public for this field.
  Explicitly not requested for this session, do not build unprompted.
  It is a candidate for the next-session inspection, not a mandate.
- **Archive product-lifecycle state, security hardening** — unchanged from
  the historical bullets above.

## Next session objective — booking/customer journey (DO NOT implement yet)
The next development session moves from the completed New in Bangkok event
page into the booking/customer journey:

> New in Bangkok booking flow → Stripe checkout → successful Booking record
> → customer confirmation/ticket → QR-based check-in foundation.

**Before writing any code, the fresh session must first inspect the
existing shared BCC/SNX checkout architecture** (`/api/create-checkout`,
`/api/webhook`, `/book`, the `bookings` table, and whatever confirmation/
ticket mechanism already exists for Bangkok Club Crawl) and determine what
can be reused, rather than building a New-in-Bangkok-specific booking
system or a separate deployment/environment. The intended architecture is
one connected lifecycle:

> Product → Event Date → Checkout → Stripe → Booking → Confirmation/Ticket
> → QR → Host Check-in

feeding the consolidated SNX mobile operations layer (calendar, bookings,
guest list/check-in) — not New-in-Bangkok-specific operational tooling.
Relevant existing context already in this doc: the BNT integration
section's Stage D note that `create-checkout` "still hardcodes
`visible_bcc` and a single `NEXT_PUBLIC_APP_URL`/`bkkclubcrawl.com`
redirect" and will need `APP_URL_BCC`/`APP_URL_BNT` server-only env names —
read that note before assuming checkout is storefront-agnostic today.
**No implementation work on this objective has started.**

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
