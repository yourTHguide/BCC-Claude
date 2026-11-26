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
5. **Automatic opening (owner decision):** a night switches **ON automatically once its OTA guests reach 5**. Safety rules:
   - only future nights, before their start time;
   - a night the owner switched OFF by hand is never re-opened automatically;
   - no automatic closing when cancellations drop below 5;
   - capacity always respected (seats left = capacity − OTA guests − website guests);
   - every automatic opening is logged and shown to the owner.
6. **Alert to the owner:** a new OTA booking on a night, and every automatic opening. Where to send it is not decided yet (email, dashboard, or both).
7. **Shadow mode first.** For 1–2 weeks the sync records what it would do without changing live nights or seat counts. It is compared with Bókun's own daily totals. It goes live only when they match.
8. **Changeover:** existing spreadsheet-imported OTA rows are matched by booking code, so nothing is counted twice.

## Step status
- Step 1, read-only connection check (`/dashboard/bokun-check`): built, waiting for the owner's run on Preview.
- Step 2, sync in shadow mode: after step 1 confirms the keys can see all channels and the booking fields.
- Step 3, go live, including automatic night creation and opening.
