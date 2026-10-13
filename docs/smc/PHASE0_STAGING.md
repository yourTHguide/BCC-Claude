# SMC Phase 0 — Staging environment

Status: staging database created and schema-matched to production, 12 Oct 2026.
No production database, Stripe, Vercel or booking data was changed.

## Staging Supabase project

| | |
|---|---|
| Name | BCC - Claude Staging |
| Project ref | `jyhtznpethgzypblppnt` |
| URL | `https://jyhtznpethgzypblppnt.supabase.co` |
| Region | ap-southeast-1 (Singapore) — same as production |
| Plan | Free (org "Sanctuary Nexus's Org": 2 active free projects; the old "Nightlife" project is paused) |
| Data | Empty. Only row: the `bangkok-club-crawl` product seed from `supabase-schema.sql`. No guest, booking, auth or form data. |

Production is `oomhftxgvikzxlvqdcmr` ("BCC - Claude"). Never point a Preview deployment at it.

## Schema applied to staging

Built from the repo, in this order (staging migration names in brackets):

1. `supabase-schema.sql` — baseline through Stage 10 Phase 5, plus production's
   `phase1_rls_hardening` grant revoke on `daily_summary`
   (`baseline_01_core_tables`, `baseline_02a_products`, `baseline_02b_daily_summary_and_seed`,
   `baseline_02c_admin_users_updated_at`, `baseline_03_schedules_content_media`,
   `baseline_04_booking_identity_bnt_forms_pricing`)
2. `20260903000001_phase3c1_partner_proposal_schema.sql` +
   `20260903000002_phase3c1_proposal_pdfs_storage_bucket.sql` (`partner_proposal_tables`)
3. `20260903000003_phase3g_lifecycle_vocabulary_correction.sql` +
   `20260904000001_phase4_proposal_language.sql` (`proposal_lifecycle_and_language_final`)

`20260824000002_stage10_phase5_pricing_storefront.sql` is already contained in the baseline file.
Production's `phase2b_rls_lockdown` drops policies that the baseline never creates, so its end
state is already met.

Deviations (fresh database only; no behavioural effect):

- `DROP … IF EXISTS` lines omitted (no-ops on an empty database).
- Phase 3G's drop-and-re-add of three proposal/deal constraints was applied as a direct
  create of the final constraint definitions.
- `COMMENT ON` documentation strings and in-function `--` comments omitted.
- `_migration_p1_audit` (a one-off production data-migration log) not recreated.

## Parity check against production

Catalog fingerprint compared on both projects (columns, types, nullability, defaults,
constraints, indexes, RLS flags, policies, triggers, functions, views, storage buckets, grants):
**all identical**. The one textual difference — `enforce_proposal_freeze()` — is comment-only;
its logic hash (comments and whitespace removed) matches production.

Security advisor on staging: only the INFO-level "RLS enabled, no policy" notice on 16 tables,
the same intentional service-role-only posture as production.

Extensions available for the Phase 1b email retry job: `pg_cron` 1.6.4, `pg_net` 0.20.4
(available, not yet enabled).

## Vercel Preview environment variables (you configure these)

Set in Vercel → Project `bcc-claude` → Settings → Environment Variables, **Preview** environment
only. Never tick Production. Recommended: apply to all Preview branches, so that no preview can
reach the production database.

### Change for Preview now

| Variable | Preview value | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://jyhtznpethgzypblppnt.supabase.co` | above |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging **anon** key | Supabase → BCC - Claude Staging → Project Settings → API keys → Legacy → `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | staging **service_role** key (secret) | same page → `service_role` |
| `STRIPE_SECRET_KEY` | `sk_test_…` | Stripe → Developers → API keys, **Test mode** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | same page |
| `STRIPE_WEBHOOK_SECRET` | test-mode signing secret for the existing webhook's test endpoint | see "Webhook access" below |
| `STRIPE_PRICE_WEEKDAY`, `STRIPE_PRICE_WEEKEND` | test-mode Price IDs | only needed if `CHECKOUT_DYNAMIC_PRICING` is not `true` |
| `CHECKOUT_DYNAMIC_PRICING` | same value as Production | tell me the value; it decides which BCC path the regression test covers |
| `RESEND_API_KEY` | a separate Resend API key named for staging | Resend → API Keys (Resend has no test mode; emails really send) |
| `ADMIN_NOTIFY_EMAIL`, `ADMIN_EMAIL` | a test inbox, not your live bookings inbox | your choice |

Leave `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_BNT_APP_URL` as they are: Preview ignores them and uses
the preview's own URL.

### Add later, in Phase 1b (names reserved now)

| Variable | Purpose |
|---|---|
| `STRIPE_SMC_WEBHOOK_SECRET` | signing secret of the SMC-only webhook (test mode on Preview, live on Production at launch) |
| `SMC_EMAIL_RETRY_SECRET` | shared secret the retry job sends to the email-retry route |
| `RESEND_FROM_BNT` | verified `bestnightlifethailand.com` sender (once DNS verification is done) |

Code guard planned for Phase 1b: on any non-production deployment, SMC routes refuse to run if
the Supabase URL is production's or the Stripe key starts with `sk_live_`.

## Stripe checks (test mode, in your dashboard)

1. Settings → Business details: account country is **Thailand**, currency **THB**.
2. Settings → Payment methods (Test mode): is **PromptPay** listed? Note its status
   (on / off / requires activation). Do **not** switch it on in the default configuration.
3. Settings → Payment methods: does the page show more than one payment method configuration?
   (Determines whether SMC uses a dedicated configuration or explicit `payment_method_types`.)
4. Developers → Webhooks (Test mode): list every endpoint URL. If any **test** endpoint points at
   bkkclubcrawl.com or bestnightlifethailand.com, tell me: test events already reach the
   production database.

## Webhook access to Preview without a token in a URL

Preview deployments sit behind Vercel Authentication, and Stripe's dashboard webhooks cannot send
custom headers, so a dashboard webhook cannot reach a protected preview without putting the bypass
token in the URL, which we will not do.

Proposed for Phase 1b testing: Stripe CLI forwarding.
`stripe listen --forward-to <preview-branch-url>/api/smc/webhook -H "x-vercel-protection-bypass: <token>"`
The token travels only as a request header. The CLI prints its own test signing secret, which goes
into `STRIPE_SMC_WEBHOOK_SECRET` (Preview). It must run on a machine that holds the test credentials:
either yours, or this session's sandbox if you place the test key and token there through a
secure channel instead of chat.

## Environment isolation — verification log (13 Oct 2026)

Configured in Vercel by the owner (values never shared in chat):

| Variable | Production | Preview · `feature/single-meet-club` |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | production (unchanged) | staging `jyhtznpethgzypblppnt` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | production (unchanged) | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | production (unchanged; Preview target removed) | staging service_role key |
| `STRIPE_SECRET_KEY` | live (unchanged; Preview target removed) | Stripe Sandbox `sk_test_…` |
| `SMC_CHECKOUT_ENABLED` | not set (production checkout always refused in code) | `true` |

Checks completed:

1. **Preview → staging Supabase:** loading `/single-meet-club/book` on the preview produced
   `products`, `event_dates` and `rpc/smc_event_availability` requests on staging (all 200).
   The availability function is not executable by `anon`, so a 200 proves the staging
   service-role key is in use. Production logs showed no SMC requests in the same window.
2. **Stripe test/live separation:** Sandbox has no webhook endpoints. Live has one endpoint,
   "BCC Booking completed" → `https://www.bkkclubcrawl.com/api/…` (1 event). No test-mode
   endpoint can reach the production database.
3. **PromptPay eligibility:** account country Thailand; PromptPay **Enabled** in the account's
   Default payment method configuration in both Sandbox and Live (alongside Cards, Apple Pay,
   Google Pay, Link). Owner decision: keep PromptPay for all products; SMC checkout requests the
   guest's chosen method explicitly (`payment_method_types`).
4. **Staging reproducibility:** see `supabase/staging/README.md` (10/10 migrations match).

Open items found during checks (not changed):

- BCC/BNT checkouts already offer PromptPay (Default configuration). The shared webhook
  (`app/api/webhook/route.ts`) handles only `checkout.session.completed` and does not check
  `payment_status`; a reviewed fix is planned after SMC testing.
- A Preview (all branches) `SUPABASE_SERVICE_ROLE_KEY` entry exists alongside the branch entry;
  it does not affect `feature/single-meet-club`. Recommended for removal later.
- Live SMC launch requires: SMC skip guard in the shared webhook, an SMC live webhook endpoint,
  and the SMC_CHECKOUT production gate lifted in a separate approved change.
