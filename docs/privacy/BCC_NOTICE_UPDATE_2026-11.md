# Bangkok Club Crawl privacy notice: update for Phase 3B (Nov 2026)

**Status:** draft for the owner's approval. The text lives in `components/privacy/BccPrivacyNotice.tsx` and shows on the Preview at `/privacy` (marked DRAFT there).

## What changes (only things that already work on the site)

### Section 2: new rows in "What we collect"

| When you… | Personal data | Purpose | Legal basis |
|---|---|---|---|
| Join the waitlist for a sold-out night | Name, email, number of seats wanted, which night, when you joined and the exact wording you agreed to | To email you once if seats open up for that night, nothing else | Your consent (s.19), withdraw any time |
| Tick "Keep me updated" (optional, when joining a waitlist) | Name, email, when you agreed and the exact wording | To email you about new Bangkok Club Crawl nights and events | Your consent (s.19), withdraw any time |

### Section 2: "Book through a booking platform" row, updated
The platforms are now named (**Tripadvisor** added), and the row says:
- data reaches us **through our booking system Bókun**;
- it includes the **platform's booking reference**;
- some platforms give **their own forwarding email** instead of the guest's;
- one purpose is to keep guest numbers accurate when bookings change or cancel.

### Section 2: closing paragraph, replaced
**Old:** "Bangkok Club Crawl has no marketing mailing list."

**New:** "Our only mailing lists are the sold-out waitlist and the optional 'Keep me updated' list, and you are on them only if you chose to join. Forwarding addresses from booking platforms are never added to them. We do not sell personal data."

### Section 3: new paragraph
The waitlist email comes once, is not a reservation, and every list email has an unsubscribe link that stops that list only.

### Section 4: service providers
**Bókun** (booking system connecting the platforms) added. Resend now covers "booking and waitlist emails".

### Section 6: new retention rows
- **Sold-out waitlist:** until 30 days after the night.
- **"Keep me updated":** until unsubscribe or 24 months of inactivity, then a 24-month suppression record. Same as the existing BEST waitlist rule.

## Held back until those features exist (not in the notice yet)
- **Phase 3C, host invitations:**

  | When you… | Personal data | Purpose | Legal basis |
  |---|---|---|---|
  | Are invited by one of our hosts | Name, email, phone and the date, entered by the host; which host invited you | To send your booking link, link your booking to that host, and pay the host's commission | Steps at your request before a contract (s.24(3)); our legitimate interest in managing host referrals (s.24(5)) |
- **Host after-event report:** "Short notes your host makes about your night (for example if you left early, or where you're travelling next), to look after guests and improve our nights. Legitimate interest (s.24(5))."

## Owner steps
1. Read the changes above, or `/privacy` on the Preview. Reply "approved", or send edits.
2. I merge the PR.
3. **Notice already live:** set `PRIVACY_NOTICE_EFFECTIVE_DATE` in Vercel (Production) to the date this version goes live, then redeploy.
   **Not published yet:** follow `docs/PHASE3_FINALIZATION.md`.
4. Then turn on `BCC_SOLDOUT_WAITLIST=on` and `BCC_UPDATES_OPTIN=on` (Production).

## Ongoing operator task
Delete sold-out waitlist entries **30 days after their night** (Leads → Waitlists → Delete). Deletion is manual, as for all other records.
