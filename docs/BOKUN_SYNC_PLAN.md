# Bókun sync: plan and owner decisions (Nov 2026)

Goal: OTA bookings (Airbnb, GetYourGuide, Viator, Tripadvisor, all connected to Bókun) appear in our system automatically and accurately, replacing manual entry and the monthly spreadsheet import.

Bókun facts (from the Bókun connection, 26 Nov 2026):
- Vendor "Nightlife Thailand".
- Club Crawl = activity **1070079**, "BKK Club Crawl: Private Van · FREE VIP Entry · Upscale Clubs", start 21:30.

## How it works
1. **Bókun tells us about a change:** new booking, date change, cancellation or refund.
   - Webhook if available, otherwise a check every 10 minutes using the API keys.
   - Either way we **re-read the booking from Bókun**, so late, duplicate or out-of-order notices can't leave a wrong number.
2. **Stored once per Bókun booking.** Each booking keeps:
   - the Bókun code and the platform's own booking code, and the channel;
   - date and guest count;
   - status (cancelled is marked, never deleted);
   - contact details, by the rule below.
3. **Contact rule:**
   - real emails are kept;
   - platform forwarding emails (GetYourGuide, Tripadvisor, etc.) are stored as **masked**, never used as the guest's email, and never added to any list;
   - phones are kept when given.
4. **No night on that date:** a night is **created automatically, OFF** (Fri → TGIF, Sat → Signature Night, other days → BKK Club Crawl) and the OTA booking is placed on it.
5. **Automatic opening (owner decision, updated 26 Nov):** a night switches **ON automatically once its OTA guests reach 4**, so website bookings can help the night reach the minimum. Setting: `BOKUN_AUTO_OPEN_MIN_GUESTS` (default 4). Safety rules:
   - only future nights, before their start time;
   - a night the owner switched OFF by hand is never re-opened automatically;
   - no automatic closing when cancellations drop below 5;
   - capacity always respected (seats left = capacity − OTA guests − website guests);
   - every automatic opening is logged and shown to the owner.
6. **Alerts (owner decision, 26 Nov):** no alert for new OTA bookings (Bókun already emails them); they appear on the dashboard automatically. One email to the owner when a night opens automatically, plus a dashboard highlight.
7. **Shadow mode first.** For 1–2 weeks the sync records what it would do without changing live nights or seat counts. It is compared with Bókun's own daily totals. It goes live only when they match.
8. **Changeover:** existing spreadsheet-imported OTA rows are matched by booking code, so nothing is counted twice.

## Connection check result (26 Nov 2026)
- The key (booking channel "Bangkok Club Crawl Website") sees **all channels**: Airbnb, GetYourGuide, Viator.
- Bókun's platform code = our `ota_bookings.booking_ref` format (Airbnb `TA…`, `GYG…`, Viator number), so matching is exact.
- GetYourGuide and Viator give a masked email (`reply.getyourguide.com`, `expmessaging.tripadvisor.com`) plus a phone; Airbnb gives neither.
- Dates arrive as a timestamp at 00:00 UTC of the night; read 50 per page.

## Step 2: shadow mode (built 26 Nov 2026)
- New tables only (`bokun_bookings`, `bokun_sync_runs`, `bokun_sync_log`), migration `20261127000001_bokun_sync_shadow.sql`, rollback in `supabase/rollback/`. Applied to staging 26 Nov.
- `lib/bokun/normalize.ts` (Bókun → our row), `lib/bokun/plan.ts` (comparison and rules, pure), `lib/bokun/sync.ts` (read every page, save, log).
- Screen: `/dashboard/bokun` (Sync now, night-by-night comparison, "would have done" list). Endpoint for the schedule: `POST /api/cron/bokun-sync` with `Authorization: Bearer BOKUN_SYNC_SECRET`.
- Schedule: `supabase/production/cron_bokun_sync.sql` (pg_cron every 10 minutes, already in the project, no cost). Not applied.
- Shadow mode never writes to `ota_bookings` or `event_dates`. A Bókun error or a short read records a failed run and saves nothing partial; overlapping runs are skipped.
- Before live: a "switched OFF by hand" marker on nights, so the sync never re-opens those.

### To run shadow mode on production (needs owner go-ahead)
1. Apply the migration to production.
2. Vercel Production: `BOKUN_ACCESS_KEY`, `BOKUN_SECRET_KEY`, and a new `BOKUN_SYNC_SECRET` (24+ random characters).
3. Merge and deploy.
4. Add the Vault secret `bokun_sync_secret` (same value), then apply `cron_bokun_sync.sql`.
5. Compare `/dashboard/bokun` with Bókun for 1–2 weeks.

## Test period: review and Import (owner decision, 26 Nov 2026)
Instead of writing to the dashboard automatically, the sync feeds a review screen, `/dashboard/bokun` (🔄 Bókun on the dashboard):
- Opening the screen reads Bókun fresh (no schedule, no secret needed yet).
- One card per night: Bókun's OTA guests next to the dashboard's OTA + website guests.
- **Import** (owner/admin): the ticked new bookings become `ota_bookings` rows on that night (platform, booking code, guest name, guest count, real email only, note "Imported from Bókun …", `imported_at`). A missing future night is created **OFF**; past dates need the night added first. Re-checked at the press: cancelled or moved bookings are refused, codes already on the dashboard are skipped (unique source + booking_ref), so a double tap or stale screen can't duplicate.
- **Use Bókun's number** when the dashboard's guest count differs.
- **Open for website booking** button appears once a night has 4 OTA guests on the dashboard (owner's tap, confirm dialog; never a started or cancelled night). Importing never opens a night.
- Cancelled in Bókun: flagged only; the owner handles it on the night as today (no deletes from this screen).
- Staging copy caught up with production's `ota_bookings.booking_ref` / `booking_status` columns (26 Nov) so Import can be tested on Preview.

After the test period: automatic import + automatic opening at 4 with an email, and the 10-minute schedule (`cron_bokun_sync.sql`).

### Production rollout for the test period (needs owner go-ahead)
1. Apply `20261127000001_bokun_sync_shadow.sql` to production.
2. Vercel: `BOKUN_ACCESS_KEY` / `BOKUN_SECRET_KEY` ticked for Production.
3. Merge and deploy. No schedule, no `BOKUN_SYNC_SECRET` needed yet.

## Step status
- Step 1, read-only connection check: done 26 Nov (all channels visible).
- Step 2, sync in shadow mode: built and tested; on Preview/staging.
- Step 2b, review screen with Import / Use Bókun's number / Open for website: built 26 Nov; on Preview/staging.
- Step 3, go live, including automatic night creation and opening.
