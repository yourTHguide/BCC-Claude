# SMC Phase 1b — payment test plan (Stripe Sandbox + staging only)

Nothing in this plan runs until the owner approves the checkpoint. All payments use the Stripe
**Sandbox**, the preview `feature/single-meet-club`, and the staging database. No live payments,
no production data.

## Activation prerequisites (owner, one step at a time)

1. Vercel Preview (branch `feature/single-meet-club`):
   `STRIPE_SMC_WEBHOOK_SECRET`, `SMC_EMAIL_RETRY_SECRET`, `SMC_TEST_EMAIL_ALLOWLIST`,
   `RESEND_API_KEY` (staging key), `ADMIN_NOTIFY_EMAIL` (test inbox),
   and `STRIPE_WEBHOOK_SECRET` (Sandbox secret, for the BCC/NIB regression).
2. Vercel "Protection Bypass for Automation" secret (header only, never in a URL).
3. Stripe CLI forwarding Sandbox events to the preview (one Terminal window per listener):
   ```
   VERCEL_BYPASS=$(pbpaste)   # bypass secret on the clipboard; never typed or shown
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired \
     --forward-to "<preview>/api/smc/webhook" -H "x-vercel-protection-bypass:$VERCEL_BYPASS"
   ```
   and a second listener to `/api/webhook` for the regression tests. Current Stripe CLI requires
   `--events`. Copy the signing secret for Vercel without its trailing newline:
   `stripe listen --print-secret | tr -d '\n' | pbcopy` (a newline makes every signature fail).
   Smoke test: `stripe trigger checkout.session.completed --add checkout_session:metadata.flow=smc`
   → both listeners `[200]`; SMC logs `smc_registration_not_found` (no booking), shared replies
   `ignored: smc`.
4. Staging Vault secrets + `supabase/staging/cron_email_retry.sql` for scheduled email retries.
5. Staging catalogue rows for the regression: a BCC product/event and a New in Bangkok
   product/event (test data, no personal data).

## A. SMC — card

| # | Scenario | Expected |
|---|---|---|
| A1 | 1 ticket, card 4242 4242 4242 4242 | Confirmation page → "You're in" with QR. One booking (`payment_method=card`, `is_test=true`), 1 attendee row, 2 outbox rows sent (guest + admin). |
| A2 | 4 tickets, 4 names | Booking quantity 4, total ฿1,600, attendee rows 1–4 in order, `notes` lists all names. |
| A3 | Declined card 4000 0000 0000 0002 | Stays on Stripe; no booking; registration stays pending until session expiry, then `expired`, seats released. |
| A4 | 3-D Secure 4000 0027 6000 3184 | Completes after challenge; same as A1. |
| A5 | Cancel on Stripe page | Back to `/book?cancelled=1` notice; no booking; hold released at expiry. |

## B. SMC — PromptPay (Sandbox simulation)

| # | Scenario | Expected |
|---|---|---|
| B1 | Authorize test payment | Confirmation page shows "Waiting for your PromptPay payment" if not instant, then "You're in". No QR/booking before `paid`. |
| B2 | Fail test payment | "Payment not completed"; registration `failed`; seats released; no booking. |
| B3 | Let QR expire | "Checkout expired"; registration `expired`; seats released. |
| B4 | `checkout.session.completed` with `unpaid` | Registration `awaiting_payment`; seats held past the 45-min timer; no booking until `async_payment_succeeded`. |

## C. Idempotency and failure handling

| # | Scenario | Expected |
|---|---|---|
| C1 | `stripe events resend <evt>` 3× for a paid session | Still exactly one booking and one ticket; outbox not duplicated; webhook replies `duplicate: true`. |
| C2 | Two deliveries of the same event at once | One booking (registration row lock). |
| C3 | Email failure (unset `RESEND_API_KEY` temporarily, or non-allowlisted recipient) | Booking still created; outbox row `pending` with backoff; after fix, retry job sends it; still one booking. |
| C4 | Amount tampering (manual event with wrong `amount_total`) | No booking; logged `smc_amount_mismatch`; acknowledged (no retry storm). |
| C5 | Capacity: set event capacity to current confirmed + 1, open two checkouts for 1 seat | Second gets "not enough spots"; only one hold. |
| C6 | Late PromptPay success after hold released, event full | `paid_over_capacity`, no ticket, admin "ACTION NEEDED" email. |

## D. Isolation

| # | Scenario | Expected |
|---|---|---|
| D1 | SMC session event delivered to the shared `/api/webhook` | Replies `ignored: smc`; no booking from the shared webhook. |
| D2 | BCC/NIB session delivered to `/api/smc/webhook` | Replies `ignored: not_smc`. |
| D3 | Production | `/single-meet-club/*` 404; `/api/smc/checkout` 503; production DB has no SMC rows. |

## E. BCC and New in Bangkok regression (PromptPay is enabled for all products)

Run on the same preview against staging, with the Stripe Sandbox and a forwarder to `/api/webhook`.

| # | Scenario | Expected |
|---|---|---|
| E1 | BCC `/book` → card 4242 | Unchanged behaviour: one booking, existing BCC confirmation email, QR ticket works, check-in works. |
| E2 | BCC `/book` → Stripe page lists PromptPay | Record whether PromptPay appears (Default configuration has it enabled). |
| E3 | BCC `/book` → PromptPay authorize | Record whether `checkout.session.completed` arrives with `payment_status=paid`. If it can arrive `unpaid`, the shared webhook would confirm an unpaid booking → raise the reviewed shared-webhook fix before launch. |
| E4 | BCC `/book` → PromptPay fail / expire | Confirm no booking is created by the shared webhook. |
| E5–E8 | Repeat E1–E4 on bestnightlifethailand-style BNT `/book` (New in Bangkok) | Same expectations; BNT-branded email. |
| E9 | Cancel/refund an E1 booking from the dashboard | Existing refund path unchanged. |

## F. Clean-up

All test rows are on staging and marked `is_test=true` (SMC). Staging can be reset by
truncation or by rebuilding from `supabase/staging/` (no production impact).

## G. Server-side payment verification (fallback to the webhook)

The confirmation page's status check asks Stripe directly while a registration is unconfirmed and,
only if Stripe reports this exact registration complete + paid in THB for the exact amount, calls the
same idempotent booking function as the webhook (`lib/smc/fulfilment.ts`). The webhook stays primary.

| # | Scenario | Expected |
|---|---|---|
| G1 | Card payment with webhook forwarding **stopped** | Confirmation page still reaches "You're in" via the fallback; one booking; emails sent. Starting forwarding afterwards: webhook replies `already_fulfilled`, no second booking. |
| G2 | Webhook and page confirm at the same moment | One booking (registration row lock). |
| G3 | Tampered `session_id` of another registration / BCC session | 404 `not_found`; nothing created; mismatch logged server-side. |
| G4 | Database briefly unavailable | Webhook returns 500 (Stripe retries); status route returns `confirming` (page keeps polling). |
