# BCC Existing Operations Audit

Audit date: 2026-09-01  
Repo: local `BCC-website` / Vercel project `BCC-Claude`  
Scope: audit only. No code, schema, deployment, routing, or architecture changes were made.

## 1. Existing Dashboard/Admin Modules

### Owner/Admin Operations Calendar

Source:
- `app/dashboard/page.tsx`
- `app/api/admin/dashboard/events/route.ts`
- `app/api/admin/dashboard/events/[id]/route.ts`
- `app/api/admin/dashboard/day-detail/route.ts`
- `app/api/admin/dashboard/bookings/route.ts`
- `app/api/admin/dashboard/ota-bookings/route.ts`
- `app/api/admin/dashboard/expenses/route.ts`

Capabilities:
- Month calendar over `event_dates`.
- Day/detail panel for one event instance.
- Open/close an event date.
- Assign host from a hardcoded host list: `Guide`, `Ice`, `Boom`, `JJ`.
- View confirmed website bookings.
- Add/delete OTA bookings.
- Add expenses.
- Update attendance for website and OTA guests.
- Set operation verdict.
- Store meet-up location, WhatsApp group link, venue route, van/taxi contact, special notes.
- Generate/copy/download host brief text.
- Copy pre-confirmation message.
- Send confirmed meet-up email after required fields are present.
- Calculate suggested host fee from checked-in headcount.
- Save final host fee and mark host payment paid.
- View revenue, expense, and profit totals.

### Host Operations

Source:
- `app/dashboard/host/page.tsx`
- `app/dashboard/host/[id]/page.tsx`
- `app/api/admin/host/events/route.ts`
- `app/api/admin/host/events/[id]/route.ts`
- `app/api/admin/host/events/[id]/expenses/route.ts`

Capabilities:
- Mobile-oriented host landing page.
- Lists upcoming actionable assigned events.
- Staff users are filtered by `event_dates.host_assigned = admin_users.display_name`.
- Owner/admin can view all actionable host events for QA.
- Host event detail shows operational brief, guest list, check-in state, and expenses.
- Host view intentionally omits revenue, profit, `total_paid`, `price_per_person`, `host_fee_final`, and `host_payment_status`.
- Host can update attendance via shared attendance endpoint.
- Host can add expenses via host-scoped endpoint.

Known coupling/risk:
- Host assignment is a free-text display-name match, not a foreign key or durable user relationship.
- The route response redacts sensitive fields, but underlying RLS still leaves some operational tables broadly readable via anon-key policies.

### Ticket Check-In

Source:
- `app/dashboard/checkin/page.tsx`
- `app/dashboard/checkin/[token]/page.tsx`
- `app/api/admin/checkin/[token]/route.ts`
- `app/api/update-attendance/route.ts`
- `app/api/tickets/[token]/qr/route.ts`
- `lib/bookingResolution.ts`
- `lib/qrTicket.ts`
- `lib/tickets.ts`

Capabilities:
- Mobile QR scanner using `html5-qrcode`.
- Manual ticket-code entry fallback.
- QR/check-in URL resolves to `/dashboard/checkin/[token]`.
- Booking lookup by opaque `bookings.ticket_token`.
- Check-in marks the whole booking, not individual guests inside a group.
- Shows already-checked-in and blocked/cancelled/refunded states.

SNX fit:
- This is the cleanest existing candidate for a shared SNX Operator OS module because it already resolves through a canonical booking token and is deliberately not tied to a product/date picker.

### Product Admin

Source:
- `app/dashboard/products/page.tsx`
- `app/dashboard/products/new/page.tsx`
- `app/dashboard/products/[id]/page.tsx`
- `app/dashboard/products/[id]/InstancesPanel.tsx`
- `app/dashboard/products/[id]/ContentTab.tsx`
- `app/dashboard/products/[id]/MediaTab.tsx`
- `app/dashboard/products/[id]/preview/page.tsx`
- `app/api/admin/products/*`
- `app/api/admin/events/[id]/route.ts`
- `app/api/admin/schedules/[id]/extend/route.ts`
- `app/api/admin/schedule/preview/route.ts`

Capabilities:
- List products.
- Create draft product.
- View product overview.
- Publish/activate and deactivate products.
- Control BCC/BNT storefront visibility flags.
- View and manage event instances.
- Add one-off event date.
- Extend weekly schedules.
- Open/close, edit, and delete event instances.
- Override per-instance price, start time, and capacity.
- Edit product content: tagline, descriptions, duration, meeting point, highlights, itinerary, inclusions/exclusions, important info.
- Edit product media using Supabase Storage `product-media` bucket.
- Preview event page.

### Email Preview

Source:
- `app/dashboard/email-preview/[token]/page.tsx`
- `emails/confirmation.ts`
- `emails/confirmed-meetup.ts`
- `emails/cancellation.ts`
- `emails/reschedule.ts`

Capabilities:
- Admin-visible preview path for transactional email output keyed by booking token.
- Email templates are already storefront-aware through `lib/storefrontBrand.ts`.

### Login/Auth

Source:
- `app/login/page.tsx`
- `middleware.ts`
- `app/dashboard/layout.tsx`
- `lib/admin-auth.ts`
- `lib/supabase/server.ts`

Capabilities:
- Supabase Auth session via SSR middleware.
- `/dashboard/:path*` and `/api/admin/:path*` require a valid Supabase session.
- Dashboard layout requires membership in `admin_users`.
- Staff role is redirected away from owner-only dashboard/product pages.
- API admin routes use `requireAdmin()` or `requireRole()`.

## 2. Current Auth, Backend, Database, APIs, And Environment Dependencies

### Runtime Stack

- Next.js 14 App Router.
- React 18.
- Supabase Auth, Database, and Storage.
- Stripe Checkout and Stripe webhooks.
- Resend transactional email.
- Tailwind configured, but dashboard/admin pages mostly use inline React style objects.
- `html5-qrcode` for mobile scanner.
- `qrcode` for QR image generation.

### Database Source Of Truth

Canonical schema source in repo:
- `supabase-schema.sql`
- `supabase/migrations/*`

The schema file identifies Supabase project ref `oomhftxgvikzxlvqdcmr` as the current production baseline.

Core tables:
- `products`
- `product_schedules`
- `event_dates`
- `product_content`
- `product_media`
- `bookings`
- `ota_bookings`
- `expenses`
- `promo_codes`
- `admin_users`
- `bnt_experience_inquiries`
- `bnt_contact_messages`

Storage:
- Supabase Storage bucket `product-media`, public-read, service-role write through admin routes.

Important view:
- `daily_summary`

### Auth And Authorization

Current model:
- Supabase Auth proves signed-in user.
- `admin_users` stores role: `owner`, `admin`, `staff`.
- Server-side `requireAdmin()` checks session and membership.
- `requireRole()` is used for owner/admin-only route protection where applied.
- Staff routing is UX-gated in `app/dashboard/layout.tsx`.

Important caveat:
- `bookings`, `event_dates`, `expenses`, and `ota_bookings` currently have permissive public `SELECT` policies in `supabase-schema.sql`.
- Several newer admin routes now read through service-role API handlers, but the underlying RLS posture remains a structural security concern for a broader SNX Operator OS.
- Code comments explicitly note this gap in `app/dashboard/layout.tsx` and `app/api/admin/host/events/[id]/route.ts`.

### Environment Variables

Read by code:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_WEEKDAY`
- `STRIPE_PRICE_WEEKEND`
- `CHECKOUT_DYNAMIC_PRICING`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `RESEND_FROM_BNT`
- `ADMIN_NOTIFY_EMAIL`
- `ADMIN_EMAIL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_BNT_APP_URL`
- `VERCEL_ENV`
- `VERCEL_URL`

Documented in `README.md`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`

Notes:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` appears documented but is not used by current code.
- `ADMIN_EMAIL` is read by BNT contact/VIP routes with fallback to `bestnightlifethailand@gmail.com`.
- `ADMIN_NOTIFY_EMAIL` is used by Stripe webhook admin booking alerts.
- `getAppUrl()` handles preview deployments with `VERCEL_URL` and supports BNT via `NEXT_PUBLIC_BNT_APP_URL`.

## 3. Functional Coverage

### Product

Exists via `products`, product admin pages, product APIs, public event pages, checkout, and email/ticket resolution.

Fields include:
- Slug, name, status.
- Default price and start time.
- Storefront visibility for BCC and BNT.
- Early-bird price and cutoff.
- Content and media are split into `product_content` and `product_media`.

### Schedule

Exists via `product_schedules` and generated `event_dates`.

Capabilities:
- Weekly and one-time schedules.
- Generated-through tracking.
- Schedule extension.
- Event date rows are what booking/calendar flows consume.

### Event Instance

Exists via `event_dates`.

Capabilities:
- Per-instance open/closed state.
- Host assignment.
- Price/start/capacity overrides.
- Operational verdict and logistics.
- Link to product and optional schedule.

### Calendar

Exists in owner dashboard and public booking/events routes.

Sources:
- Owner calendar: `app/dashboard/page.tsx`
- Public events API: `app/api/events/route.ts`
- Booking calendar: `app/book/BookingCalendarClient.tsx`

### Booking

Exists via Stripe Checkout and webhook insertion into `bookings`.

Sources:
- `app/api/create-checkout/route.ts`
- `app/api/webhook/route.ts`
- `app/api/bookings/by-session/route.ts`
- `app/api/cancel-booking/route.ts`
- `app/api/reschedule-booking/route.ts`
- `app/api/resend-confirmation/route.ts`

Current model:
- One booking row can represent multiple guests via `quantity`.
- Dynamic checkout uses product/event instance as source of truth when `CHECKOUT_DYNAMIC_PRICING=true`.
- Legacy fallback uses hardcoded Stripe Price IDs from `lib/stripe.ts`.
- Storefront and price tier are recorded when dynamic checkout metadata supplies them.

### Guest

Exists inline on booking rows and OTA booking rows.

Model:
- Website guest fields live on `bookings`.
- OTA guest fields live on `ota_bookings`.
- No normalized guest/person table for BCC operations.
- No per-seat/per-person ticket table.

### Attendance

Exists on `bookings.attendance_status` and `ota_bookings.attendance_status`.

Statuses:
- `expected`
- `checked_in`
- `no_show`

Limit:
- Attendance is booking-level for website bookings, not individual guest-level within a group quantity.

### Expense

Exists via `expenses`.

Owner dashboard can add and include expenses in profit math. Host dashboard can add and view expenses without revenue/profit.

Categories observed:
- Schema baseline: `van`, `host_pay`, `extra`
- Host UI: `van`, `host_pay`, `drinks`, `cover_charge`, `extra`

### Host Fee

Exists as operational fields on `event_dates`:
- `host_payment_status`
- `host_fee_final`

Owner dashboard includes suggested host fee:
- Flat THB 1,500 for up to 5 checked-in guests.
- THB 300 per checked-in guest beyond 5.

Host fee is owner/admin-facing and intentionally absent from the host event detail route.

### Event Closeout

Partially exists.

Current closeout-like pieces:
- `operation_verdict` includes `Completed` and `Reviewed`.
- Attendance can be finalized.
- Expenses can be logged.
- Host fee can be calculated/finalized/marked paid.
- Revenue, expense, and profit are visible in owner day panel.

Missing as a formal closeout module:
- No dedicated closeout table.
- No structured checklist.
- No immutable closeout snapshot.
- No approval/signoff history.
- No reconciliation object separate from live operational rows.

## 4. Reusable UI/Components

Reusable with moderate confidence:
- QR scanner page and scanner/token extraction flow.
- Check-in token confirmation screen.
- Host event list/detail layout concepts.
- Product instances table logic.
- Product content editor concepts.
- Product media upload/delete/list concepts.
- Confirmation modal pattern in owner dashboard.
- Storefront-aware email branding helpers.
- `ProductPage` public product rendering.
- Booking calendar concepts, if product/event-instance source of truth remains.

Reusable shared libraries:
- `lib/bookingResolution.ts`
- `lib/pricing.ts`
- `lib/recurrence.ts`
- `lib/calendarLinks.ts`
- `lib/appUrl.ts`
- `lib/storefront.ts`
- `lib/storefrontBrand.ts`
- `lib/media.ts`
- `lib/tickets.ts`
- `lib/qrTicket.ts`
- `lib/bookingReference.ts`

Less reusable without redesign:
- Dashboard styles are inline and BCC-branded.
- Owner calendar/day panel is a large monolithic client component.
- Host assignment UI uses hardcoded host names.
- Revenue/profit view is embedded in the BCC owner day panel rather than isolated as a finance module.
- Product admin language assumes BCC/BNT storefront flags.

## 5. Logic Tightly Coupled To BEST/BCC

Strong coupling:
- Route names and copy: `/dashboard`, `/dashboard/products`, `/dashboard/host`, BCC dashboard labels.
- Branding colors: dark red/magenta palette throughout dashboard inline styles.
- Host list: `Guide`, `Ice`, `Boom`, `JJ`.
- Emergency/Guide contact hardcoded into host brief text.
- Pre-confirmation message copy is BCC/Bangkok nightlife specific.
- Meeting time in host brief is hardcoded as `9:30 PM`.
- Night/product legacy slugs in `lib/stripe.ts`.
- Storefront visibility is currently binary BCC/BNT via `visible_bcc` and `visible_bnt`.
- BNT form tables are specifically for BEST private inquiries/contact.
- Public pages include legacy/static BCC/BNT marketing routes.
- `getAppUrl()` defaults to BCC/BNT domains.

Moderate coupling:
- Expense categories reflect nightlife operations.
- Attendance statuses are generic, but guest model assumes bookings/OTA rows.
- Product content sections work for experiences but not necessarily all SNX operator verticals.
- Ticket reference formatting is product/booking oriented.

Low coupling:
- Tokenized booking resolution.
- QR scan/check-in mechanics.
- Recurrence/date generation.
- Server-side dynamic pricing resolver.
- Media storage path derivation.
- Supabase Auth/admin membership pattern, once RLS is tightened.

## 6. Current Mobile Readiness

Good mobile readiness:
- Host landing page is narrow, phone-first, max-width 480px.
- Host event detail is narrow, phone-first, max-width 480px.
- Check-in scanner is explicitly mobile-oriented.
- Check-in token confirmation page is phone-friendly.
- Day panel was adjusted to avoid sub-420px overflow.

Partial mobile readiness:
- Product list uses horizontal table scrolling.
- Product instances table uses min-width 760px and horizontal scroll.
- Product detail tabs may crowd on small screens.
- Owner dashboard calendar/day panel is usable but not truly mobile-first.

Poor mobile readiness / likely gaps:
- Owner admin operations are dense and inline-styled.
- Large monolithic `app/dashboard/page.tsx` is difficult to adapt into native-feeling mobile operator workflows.
- Form controls and tables are not consistently designed around thumb-first operation.
- Product/content/media admin is more desktop/admin-console than field-operator.

## 7. Duplications Or Conflicts If A Separate SNX Operator Dashboard Is Built

Likely duplicated:
- Auth/session/admin role checks.
- Host event list and assignment filtering.
- Event instance operations.
- Guest list and attendance updates.
- QR scanner/check-in.
- Expense logging.
- Host brief/logistics display.
- Product schedule/instance views.
- Revenue/expense/host fee calculations.
- Booking resolution and ticket lookup.

Likely conflicts:
- Two dashboards could write different values to `event_dates.operation_verdict`, logistics fields, `host_fee_final`, and `host_payment_status`.
- Separate attendance surfaces could disagree on booking-level vs guest-level semantics.
- Separate host assignment logic could drift from current free-text `host_assigned` behavior.
- Separate product/event controls could conflict with `visible_bcc`/`visible_bnt`, schedule generation, and open/close state.
- Separate expense categories or closeout concepts could fragment financial reporting.
- Separate QR/check-in mechanisms could produce incompatible ticket flows.
- Separate auth/RLS assumptions could mask the existing public-read RLS caveat.

## 8. Parts That Could Safely Become Modules Inside Wider SNX Operator OS

Good candidates:
- Check-in scanner module.
- Tokenized booking resolver module.
- Attendance update module, with future per-guest extension if needed.
- Host event list/detail module, after host assignment becomes user-id based.
- Event instance operations module.
- Expense logging module.
- Product schedule/instance module.
- Product content/media module.
- Dynamic pricing resolver.
- Storefront/brand helper layer, generalized beyond BCC/BNT.
- Transactional email templates, parameterized by brand/product.

Needs refactor before becoming SNX module:
- Owner dashboard day panel.
- Host fee calculation.
- Event closeout.
- Host assignment.
- RLS/security model.
- Product visibility model.
- BCC/BNT-specific copy, contact, color, and route naming.
- Guest model if SNX requires individual attendee-level operations.

Should remain product/site-specific:
- BCC/BNT marketing pages.
- BNT private experience/contact forms.
- Legacy static night pages.
- Current BCC visual brand styling.
- Hardcoded BCC/BNT domains and support copy.

## 9. Local Files Or Local-Only Runtime Behavior

Local/static assets:
- Public BCC images under `public/images/*`.
- Public BNT assets under `public/bnt/*`.
- BNT copied CSS/JS under `public/bnt/css/luxury-landing.css` and `public/bnt/js/luxury-landing.js`.

Local repo schema/deployment documentation:
- `supabase-schema.sql`
- `supabase/migrations/*`
- `PHASE4_CHECKPOINT.md`
- `README.md`

Local/runtime caveats:
- Several comments in `PHASE4_CHECKPOINT.md` note local sandbox runs often lack `.env.local`, preventing real Supabase/Resend local verification.
- `next dev` requires environment variables for real Supabase, Stripe, and Resend behavior.
- Camera scanning requires browser camera permissions and a secure context in real browser usage.
- Clipboard and text-file host-brief download are browser-local behaviors in `app/dashboard/page.tsx`.
- Product media public URLs are derived from Supabase Storage paths, not stored as local files.
- Stripe webhook behavior depends on a valid `STRIPE_WEBHOOK_SECRET` for the deployed endpoint; local webhook testing would need a local Stripe CLI/session secret.

## Capability Table

| Capability | Exists now | Source of truth | Reusable | Needs refactor | Mobile gap | SNX relevance |
|---|---:|---|---:|---:|---|---|
| Product catalog | Yes | `products` | Yes | Medium | Product admin tables/tabs are desktop-biased | High |
| Product storefront visibility | Yes | `products.visible_bcc`, `products.visible_bnt` | Partial | High | Low | Medium; model is BCC/BNT-specific |
| Product content | Yes | `product_content` | Yes | Medium | Editor is admin-console style | Medium |
| Product media | Yes | `product_media`, Supabase `product-media` bucket | Yes | Low | Editor not field-oriented | Medium |
| Schedule generation | Yes | `product_schedules` generating `event_dates` | Yes | Medium | Instance table scrolls horizontally | High |
| Event instances | Yes | `event_dates` | Yes | Medium | Owner tools not mobile-first | High |
| Calendar | Yes | `event_dates`, `/api/events`, owner dashboard | Partial | Medium | Owner calendar dense on mobile | High |
| Open/close date | Yes | `event_dates.is_open` | Yes | Low | Owner action is panel-based | High |
| Host assignment | Yes | `event_dates.host_assigned` | Partial | High | UI is simple, but model is fragile | High |
| Host operations view | Yes | Host API routes over canonical tables | Yes | Medium | Mostly mobile-ready | High |
| Booking checkout | Yes | Stripe Checkout + `bookings` | Partial | Medium | Public booking flow separate from operator UX | High |
| Dynamic pricing | Yes | `lib/pricing.ts`, product/event pricing fields | Yes | Low | None | Medium |
| Legacy Stripe price fallback | Yes | `lib/stripe.ts`, Stripe env price IDs | No | High | None | Low |
| Website bookings | Yes | `bookings` | Yes | Medium | Operator view okay; guest model coarse | High |
| OTA bookings | Yes | `ota_bookings` | Partial | Medium | Owner-only add flow in side panel | Medium |
| Guest records | Inline only | `bookings`, `ota_bookings` | Partial | High | Booking-level quantity only | High |
| Attendance | Yes | `attendance_status` on `bookings`/`ota_bookings` | Yes | Medium | Check-in is mobile-ready | High |
| QR scanner | Yes | `/dashboard/checkin`, `html5-qrcode` | Yes | Low | Designed for mobile | High |
| Ticket lookup | Yes | `bookings.ticket_token`, `lib/bookingResolution.ts` | Yes | Low | Mobile-ready | High |
| Expenses | Yes | `expenses` | Yes | Medium | Host add flow mobile-ready; owner flow denser | High |
| Revenue/profit summary | Yes | Owner dashboard calculations, `daily_summary` view | Partial | Medium | Owner view desktop-biased | Medium |
| Host fee | Yes | `event_dates.host_fee_final`, `host_payment_status` | Partial | High | Owner-only panel, not mobile-first | Medium |
| Event closeout | Partial | `operation_verdict`, attendance, expenses, host fee | Partial | High | No dedicated mobile closeout flow | High |
| Confirmed meetup email | Yes | `event_dates` logistics + bookings/OTA guests + Resend | Partial | Medium | Owner-only flow | Medium |
| Host brief | Yes | Generated client-side from event/bookings/expenses state | Partial | High | Copy/download works; not a structured module | High |
| Admin auth | Yes | Supabase Auth + `admin_users` | Yes | Medium | Login path is generic enough | High |
| Staff RBAC | Partial | `admin_users.role`, `display_name`, route filtering | Partial | High | Host UX works; security model needs hardening | High |
| RLS security | Partial/problematic | Supabase policies in `supabase-schema.sql` | No | High | Not a UI gap | Critical |
| BNT private inquiry/contact | Yes | `bnt_experience_inquiries`, `bnt_contact_messages` | No | Low | Public BNT forms only | Low |
| Storefront branding | Yes | `lib/storefrontBrand.ts`, `lib/appUrl.ts` | Partial | Medium | Mostly presentation-level | Medium |
| Local static marketing pages | Yes | `app/*`, `components/*`, `public/*` | No | Low | Varies by page | Low |
