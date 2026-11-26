# Phase 3C (host referrals) and 3D (vans): owner decisions

Recorded 25 Nov 2026. Planning only; nothing built yet. Order: 3B (waitlist) merges first, then 3C, then 3D.

## 3C: Host invite links and commission
- **Invite link per guest, made by the host.** In the host dashboard the host enters the **date**, the guest's **full name, email and phone**, then taps one button to create a link and sends it to the guest.
- **Link format:** `bkkclubcrawl.com/with/<hostname>/<random code>`. The root is the host's name; every invite has a new code.
- **The link opens the booking already set to that date.** The guest pays through the normal checkout (฿1,200 to the business). The booking appears in the system immediately, marked as a new guest from that host.
- **Proof of referral:** a booking is credited to a host only if it was paid through that host's link. Adding guest details afterwards earns nothing; bookings without the link earn nothing.
- **One booking per link.** Unused links **expire after 7 days**. A repeat guest gets a new link from the host they're going out with next time, so the commission follows the host the guest actually joins.
- **Commission:** ฿150 per paid ticket, earned after the night has happened, refunded tickets excluded. The amount is a setting the owner can change.
- **Host "My earnings":** past and upcoming nights, who they hosted, hosting pay, commission, expenses they track, and totals and paid status. **Their own only.** Hosts never see ticket prices or revenue.
- **Owner:** all-hosts view with "mark paid". No automatic transfers.
- **Privacy notice:** add a line about hosts entering guest contact details.
- **Confirmed later (26 Nov):** the **guest** sets the number of tickets; a host paying through their own link earns **no commission**; host payout comes after their after-event report (report = next phase).

## 3C: as built (27 Nov 2026)
- Migration `20261128000001_host_invites.sql` (new `host_invites` table; `bookings.host_invite_id`, `bookings.host_commission_paid_at`; unique one booking per invite). Rollback in `supabase/rollback/` (refuses while bookings are credited). Applied to staging 27 Nov.
- **Host view** (`/dashboard/host`): **+ Create booking** → night (on-sale nights with seats), guest full name, email, phone → link `/with/<host>/<code>` with **Copy link** and **Send on WhatsApp**. Same guest + night while still open gives the same link. Own email refused. Max 50 open links per host. **My invites & commission**: each invite's status and ฿, totals Upcoming / To be paid / Paid. No prices or revenue shown.
- **Guest**: the link opens `/book` on that night with "🎉 <Host> invited you!"; guest picks tickets; Stripe checkout at the normal price, email pre-filled. Used/expired/cancelled links explain and offer the normal calendar.
- **Credit**: checkout re-checks the link (open, unexpired, same night). The Stripe webhook claims it once (retries, second payments, and the host's own email are saved as normal bookings without credit; a failed save releases the link).
- **Commission**: `HOST_COMMISSION_THB` (default 150) per ticket, fixed on each link when made. Upcoming until the night, then earned; refunded/cancelled earns nothing.
- **Owner** (`/dashboard/commissions`, 💸 in the menu): per host earned-unpaid / upcoming / paid, invites list, **Mark ฿… paid** (records the date; no money moved).
- Privacy notice: rows for host invitations (purpose/basis) and retention (with booking records; unused links up to 12 months).
- Not in 3C: hosting pay and expenses in "My earnings" (with the after-event report).

## 3D: Vans (10 guests + 1 host each)
- **Paid upfront**, also for van 2. Van 2 needs **4** guests to run; van 1 needs **5**.
- **No cutoff:** van 2 stays on sale until the owner closes it manually.
- **Short van:** guests get an email to choose **refund or a new date**. The owner approves each with one click. Same rule for van 1 below 5.
- **Groups:** a party that doesn't fit van 1 goes to van 2. Seats aren't fixed; people can be swapped on the night. Details decided when built.
- **Wording:** fun and playful (e.g. "Unlock Van 2"), owner picks.
- **Capacity:** stays **12** until the van system is live, then 10 + 10.
