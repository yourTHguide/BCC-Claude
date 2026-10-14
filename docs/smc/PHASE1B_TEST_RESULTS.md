# SMC Phase 1b — test results (14 Oct 2026)

Environment: Vercel Preview `feature/single-meet-club`, staging Supabase `jyhtznpethgzypblppnt`,
Stripe Sandbox `acct_1P4SN0CJiIAY18yY`, Stripe CLI forwarding with the Vercel bypass header.
Production (deployment `7d3a70d`, Supabase `oomhftxgvikzxlvqdcmr`, live Stripe) was not changed.

## Results

| Section | Tests | Result |
|---|---|---|
| A — card | A1 1 guest, A2 4 guests (฿1,600, 4 attendees), A3 declined, A4 3-D Secure, A5 cancel | Pass |
| B — PromptPay | B1 authorize, B2 expire (Stripe's test page offers Authorize/Expire only), B3 unpaid QR | Pass. Sandbox PromptPay arrives as one `checkout.session.completed` already `paid`. |
| C — idempotency & failures | C1 event resent 3×: one booking, no duplicate email. C3 email failure: back-off (1 min), `failed` after 6 attempts, booking unaffected. C4 wrong amount: `smc_amount_mismatch`, no booking. C5 capacity: request beyond capacity refused (`smc_sold_out`). C6 late success after release with event full: `paid_over_capacity`, no booking, one admin alert, repeat idempotent. | Pass (C3–C6 run in a rolled-back transaction on staging) |
| D — isolation | D1 SMC event to shared webhook ignored. D2 non-SMC event to SMC webhook ignored. D3 production has no SMC tables/product and runs `7d3a70d`. | Pass |
| E — BCC / New in Bangkok regression | E1–E4 BCC card, PromptPay authorize, PromptPay expire. E5–E7 NIB (฿390 Early Bird) same. E9 refund: only non-SMC code changed vs `main` is the 8-line SMC skip in `app/api/webhook/route.ts`. | Pass. No booking from expired PromptPay. |
| G — server-side verification | G1 webhook stopped: page confirms via Stripe, late webhook resend → `already_fulfilled`. | Pass after fix (below) |
| Expiry | A3, B2, B3 released by `checkout.session.expired`. A5's event was missed while the CLI was stopped; the 45-min hold released the seat. | Pass |
| Email retry job | pg_cron every 5 min via Vault secrets; first run sent the one waiting email; skips the call when nothing is due. | Pass |

## Bug found and fixed

G1: when the confirmation page confirmed a booking, emails were dispatched after the response
was sent; Vercel froze the function, leaving emails in `sending`. Fixed in `2592660` (await the
dispatch). Verified on `734bf1c`: 5 claimed, 5 sent. Stuck emails were recovered by lease expiry.
Testing note: an old per-deployment preview URL keeps serving old code; always test on the
branch alias.

## Open items before launch

1. Shared webhook (`app/api/webhook/route.ts`): add a `payment_status === 'paid'` check (and async
   PromptPay events) for BCC/NIB. Not observed failing in testing; Stripe does not guarantee it.
2. Live launch change (separate approval): lift the production gate in `lib/smc/env.ts`, create a
   live SMC webhook endpoint (`STRIPE_SMC_WEBHOOK_SECRET`), apply the SMC migration to production,
   production retry schedule, `SMC_PAGE_PUBLISHED`.
3. Sender domain: verify `bestnightlifethailand.com` in Resend and set `RESEND_FROM_BNT`.
4. Draft FAQ answers (age, what's included, after booking) need approval.
5. Optional: allow card as a fallback on the PromptPay checkout (guest currently returns to our
   form to switch).
6. Optional: email dispatch in the status route could send only that booking's emails (faster page).
7. Housekeeping: Preview (all branches) `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_SECRET_KEY` entries;
   remove the diagnostic dispatch logs if not wanted; ticket page uses generic BNT branding.
8. Vercel Hobby plan is for non-commercial use; review before commercial launch.
9. The Stripe CLI webhook signing secret appeared in a screenshot; it only signs Sandbox events.
   The exposed Vercel bypass secret was deleted and replaced.

Staging test data: 13 test bookings (SMC marked `is_test`), test BCC dates 6–7 Nov, a
catalogue-only `new-in-bkk` copy (visible on the BCC storefront in staging only) dated 4 Nov.
