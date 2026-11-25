# Dashboard calendar: add any night, ON/OFF toggle, waitlist on every night (Nov 2026)

Bangkok Club Crawl only. Owner/admin only (hosts can't add nights).

## What changed
- **Tap any empty upcoming day** in the dashboard calendar to open **"Add a Club Crawl night"**. It asks for:
  - **Night type:**
    - **BKK Club Crawl** (no theme; the code OTA imports already use for weekday bookings, `club-crawl`);
    - **TGIF Bangkok**;
    - **Signature Night**;
    - **Special theme** (you type the name, e.g. "Songkran Crawl").
  - **Price** (default ฿1,200), **start time** (default 9:30 PM) and **seats** (default 12).
  - **On sale:** ON = guests can see and book it on the website. OFF = hidden; it exists for the team, e.g. to hold OTA bookings, and can be switched ON later.
- **One Club Crawl night per date.** If the date already has one, the form says so and you open that night instead.
- **"Open Date / Close Date" is now an ON/OFF switch** on each night (same meaning as before).
- **Waitlist on every night:** any genuinely full Club Crawl night offers the next bookable night and the waitlist, on any weekday, special or not. Before this it was Friday/Saturday only.

## What did not change
- Guests still only see nights that are ON. Checkout, price, capacity and OTA seat counting work the same for every night.
- No database change. Price and time are stored as per-night overrides only when they differ from the defaults, exactly like the NYE night.

## Code
- `app/api/admin/dashboard/events/route.ts` (POST)
- `lib/bccNights.ts`
- `app/dashboard/AddNightPanel.tsx`
- `app/dashboard/page.tsx`
- Waitlist rule: `isWaitlistEligible` in `lib/bookingAvailability.ts`, plus `/api/events` and `lib/waitlist/bccInstances.ts`

Tests: `tests/add-night.route.test.ts`. `npm test`: 39/39.

## Test on Preview (staging)
1. Dashboard → Calendar → tap an empty **weekday** → add "BKK Club Crawl", ON. Check it appears on `/book`.
2. Switch it OFF from the night's panel and check it disappears from `/book`.
3. Add a "Special theme" night and check the name shows on `/book` and in checkout.
4. Delete or switch OFF the test nights afterwards.
