import { formatStartTime } from '@/lib/dates'
import { revealMeetingPointForTicket } from '@/lib/meetingPointReveal'

export function generateConfirmationEmail({
  guestName,
  nightName,
  eventDate,
  quantity,
  totalPaid,
  promoCode,
  ticket,
  startTime,
  meetingPointRaw,
}: {
  guestName: string
  nightName: string
  eventDate: string
  quantity: number
  totalPaid: number
  promoCode?: string
  // Present only when the webhook's booking INSERT actually succeeded and a
  // ticket_token was persisted (Stage 9g) — a failed insert must never
  // reference a token that doesn't exist in `bookings`. When absent, the
  // email renders exactly as it did before Stage 9 (the "legacy BCC
  // confirmation flow" the ticket feature must not regress) — including the
  // hardcoded "9:30 PM" meet-up time below, which only ever applied to BCC.
  ticket?: { token: string; reference: string } | null
  // Stage 9 (mobile-QA pass): the event's real effective start time and raw
  // meeting_point — only meaningful alongside `ticket` (both come from the
  // same canonical event_id/product_id resolution). Sanitized here via the
  // SAME revealMeetingPointForTicket used by the ticket page, so the email
  // and the ticket page can never disagree about what's safe to disclose —
  // 'public'/'after_booking' reveal, 'private'/unset/invalid reveal nothing.
  startTime?: string | null
  meetingPointRaw?: unknown | null
}) {
  // Parse the YYYY-MM-DD string into LOCAL date components (not new Date(eventDate),
  // which parses as UTC midnight and can roll the date back a day depending on server TZ)
  const [dY, dM, dD] = eventDate.split('-').map(Number)
  const dateObj = new Date(dY, dM - 1, dD)
  const formattedDate = dateObj.toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const firstName = guestName?.split(' ')[0] || 'Guest'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bkkclubcrawl.com'
  const timeLabel = formatStartTime(startTime ?? null)
  const meetingPoint = revealMeetingPointForTicket(meetingPointRaw ?? null)

  // Canonical hierarchy for any booking with a resolvable ticket: Booking
  // Confirmed → product → date/time/guests → meeting point (per the
  // Product's existing visibility rules) → a strong "View Ticket & QR" CTA.
  // Deliberately does NOT reproduce the ticket page's Google Maps
  // link/Add-to-Calendar/WhatsApp-support — those live at the CTA's
  // destination, not duplicated here. Replaces the legacy BOOKING SUMMARY
  // table + old YOUR TICKET section entirely when `ticket` is present;
  // when absent, neither this nor the summary table below render — the
  // legacy summary table (with BCC's hardcoded "9:30 PM") is untouched.
  const canonicalSectionHtml = ticket ? `
  <!-- BOOKING CONFIRMED (canonical) -->
  <tr><td style="background:#1A0015;padding:28px 32px 0;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.70)">Hey ${firstName}, your booking is confirmed.</p>
  </td></tr>
  <tr><td style="background:#1A0015;padding:20px 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
      <tr><td style="padding:28px 24px;text-align:center">
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#fff">${nightName}</p>
        <p style="margin:0 0 22px;font-size:14px;color:rgba(255,255,255,0.60)">
          ${formattedDate}${timeLabel ? ` · ${timeLabel}` : ''} · ${quantity} guest${quantity > 1 ? 's' : ''}
        </p>
        ${meetingPoint ? `
        <div style="text-align:left;background:rgba(255,255,255,0.03);border-radius:8px;padding:14px 16px;margin-bottom:22px">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">Meeting Point</p>
          ${meetingPoint.display_name ? `<p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#fff">${meetingPoint.display_name}</p>` : ''}
          ${meetingPoint.address ? `<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.60)">${meetingPoint.address}</p>` : ''}
        </div>` : `
        <div style="text-align:left;background:rgba(255,255,255,0.03);border-radius:8px;padding:14px 16px;margin-bottom:22px">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.60);line-height:1.6">The exact meeting point will be shared closer to the event.</p>
        </div>`}
        <p style="margin:0 0 18px;font-size:13px;color:rgba(255,255,255,0.45)">฿${totalPaid.toLocaleString()} paid${promoCode ? ` · promo ${promoCode}` : ''}</p>
        <img src="${appUrl}/api/tickets/${ticket.token}/qr" width="140" height="140" alt="Check-in QR code" style="display:block;margin:0 auto 16px;width:140px;height:140px;background:#fff;border-radius:8px;padding:8px;border:0" />
        <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">Booking Reference</p>
        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#EA003A;letter-spacing:0.04em">${ticket.reference}</p>
        <a href="${appUrl}/ticket/${ticket.token}" style="display:inline-block;background:linear-gradient(135deg,#EA003A,#820065);color:#fff;font-weight:600;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none">View Ticket &amp; QR →</a>
        <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.40);line-height:1.6">Your full ticket — QR, directions, and Add to Calendar — is always available at that link.</p>
      </td></tr>
    </table>
  </td></tr>` : ''

  // Legacy BOOKING SUMMARY table — byte-identical to pre-Stage-9, including
  // the hardcoded "9:30 PM" (BCC's actual meet-up time; this table only
  // renders when there's no canonical `ticket`, so it never misrepresents a
  // different product's real time). Kept as its own block so the `ticket`
  // branch above can't accidentally regress this path.
  const legacySummaryHtml = `
  <!-- BOOKING SUMMARY (legacy) -->
  <tr><td style="background:#1A0015;padding:28px 32px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.70)">Hey ${firstName},<br><br>
    Your booking is confirmed. Here's everything you need for the night.</p>

    <!-- Summary box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">NIGHT</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right">
              <span style="font-size:14px;font-weight:600;color:#fff">${nightName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">DATE</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right">
              <span style="font-size:14px;font-weight:600;color:#fff">${formattedDate}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">TICKETS</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right">
              <span style="font-size:14px;font-weight:600;color:#fff">${quantity} person${quantity > 1 ? 's' : ''}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">MEET-UP TIME</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right">
              <span style="font-size:14px;font-weight:600;color:#fff">9:30 PM</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">TOTAL PAID</span>
            </td>
            <td style="padding:8px 0;text-align:right">
              <span style="font-size:16px;font-weight:700;color:#EA003A">฿${totalPaid.toLocaleString()}</span>
            </td>
          </tr>
          ${promoCode ? `
          <tr>
            <td colspan="2" style="padding:8px 0 0">
              <span style="font-size:11px;color:rgba(255,255,255,0.40)">Promo code applied: <strong style="color:rgba(255,255,255,0.60)">${promoCode}</strong></span>
            </td>
          </tr>` : ''}
        </table>
      </td></tr>
    </table>
  </td></tr>`

  // BCC-crawl-specific promises (a fixed "9:30 PM" first-bar time, and a
  // location "shared via WhatsApp by 7 PM") that directly contradict the
  // canonical section above once it has New in Bangkok's REAL time (20:30)
  // and its ALREADY-DISCLOSED meeting point — found by testing this
  // template with real New in Bangkok data during the Stage 9 mobile-QA
  // pass, not assumed. Gated to the legacy (no-ticket) path only, same as
  // legacySummaryHtml above. The remaining sections below this one (RUN OF
  // SHOW's 4-venue schedule, INCLUDED/NOT INCLUDED, DRESS CODE, TIPS) are
  // ALSO BCC-crawl-specific and will show the same wrong copy for New in
  // Bangkok — left untouched here as an explicitly reported follow-up
  // (would need per-product content, e.g. from Phase 4's `product_content`,
  // not a hardcoded template) rather than expanded into in this pass.
  const legacyMeetupProcessHtml = `
  <!-- MEET-UP DETAILS (legacy) -->
  <tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(234,0,58,0.08);border:1px solid rgba(234,0,58,0.20);border-left:3px solid #EA003A;border-radius:10px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#EA003A">MEET-UP DETAILS</p>
        <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.80);line-height:1.6">
          <strong style="color:#fff">Location:</strong> The exact meet-up spot will be shared in our WhatsApp group chat by <strong style="color:#fff">7 PM on the event day.</strong>
        </p>
        <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.80);line-height:1.6">
          <strong style="color:#fff">Time:</strong> Be at the first bar by <strong style="color:#fff">9:30 PM sharp.</strong>
        </p>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.50);line-height:1.6">
          If you don't make it to the first bar, you'll be marked as a no-show.
        </p>
      </td></tr>
    </table>
  </td></tr>

  <!-- CONFIRMATION PROCESS (legacy) -->
  <tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">CONFIRMATION PROCESS</p>
    <p style="margin:0 0 10px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.7">
      We confirm the event once we reach a minimum of <strong style="color:#fff">5 participants.</strong> A WhatsApp group will be created and the meet-up location shared by 7 PM on the day.
    </p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7">
      If we don't reach the minimum, you'll receive an email with options to reschedule or receive a full refund.
    </p>
  </td></tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>You're booked — Bangkok Club Crawl</title>
</head>
<body style="margin:0;padding:0;background:#0D000A;font-family:'Helvetica Neue',Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D000A;padding:40px 20px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#EA003A,#820065);border-radius:12px 12px 0 0;padding:36px 32px;text-align:center">
    <p style="margin:0 0 8px;font-weight:700;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.70)">BANGKOK CLUB CRAWL</p>
    <h1 style="margin:0;font-size:28px;font-weight:700;color:#fff;line-height:1.2">${ticket ? 'Booking Confirmed' : "You're booked for tonight."}</h1>
    <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.80);font-style:italic">${nightName}</p>
  </td></tr>
${ticket ? canonicalSectionHtml : legacySummaryHtml}
${ticket ? '' : legacyMeetupProcessHtml}
  <!-- RUN OF SHOW -->
  <tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">YOUR NIGHT</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px">
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
        <td style="padding:14px 20px;font-size:12px;font-weight:700;color:#EA003A;white-space:nowrap;width:140px">9:30 – 10:30 PM</td>
        <td style="padding:14px 20px;font-size:13px;color:rgba(255,255,255,0.70);line-height:1.5">Meet & greet at the first bar with a welcome shot to kick off the night.</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
        <td style="padding:14px 20px;font-size:12px;font-weight:700;color:#EA003A;white-space:nowrap">10:45 – 11:45 PM</td>
        <td style="padding:14px 20px;font-size:13px;color:rgba(255,255,255,0.70);line-height:1.5">Move to the second venue — unique décor and great atmosphere.</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06)">
        <td style="padding:14px 20px;font-size:12px;font-weight:700;color:#EA003A;white-space:nowrap">12:00 – 1:00 AM</td>
        <td style="padding:14px 20px;font-size:13px;color:rgba(255,255,255,0.70);line-height:1.5">Hit an upbeat venue to dance and soak in the Bangkok nightlife energy.</td>
      </tr>
      <tr>
        <td style="padding:14px 20px;font-size:12px;font-weight:700;color:#EA003A;white-space:nowrap">1:30 – 2:30 AM</td>
        <td style="padding:14px 20px;font-size:13px;color:rgba(255,255,255,0.70);line-height:1.5">Wrap up at a high-energy spot to end the night on a memorable note.</td>
      </tr>
    </table>
  </td></tr>

  <!-- WHAT'S INCLUDED / NOT INCLUDED -->
  <tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;padding-right:12px;width:50%">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">INCLUDED</p>
          <ul style="margin:0;padding:0 0 0 16px;color:rgba(255,255,255,0.65);font-size:13px;line-height:1.9">
            <li>Free transport between venues</li>
            <li>2–4 complimentary shots</li>
            <li>Exclusive drink deals</li>
            <li>VIP entry at all stops</li>
            <li>Dedicated host all night</li>
          </ul>
        </td>
        <td style="vertical-align:top;padding-left:12px;width:50%">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">NOT INCLUDED</p>
          <ul style="margin:0;padding:0 0 0 16px;color:rgba(255,255,255,0.65);font-size:13px;line-height:1.9">
            <li>Extra drinks</li>
            <li>Cover charge <span style="display:inline-block;background:rgba(234,0,58,0.15);color:#EA003A;font-size:9px;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:4px;vertical-align:middle">DJ NIGHTS ONLY</span><br/><span style="font-size:11px;color:rgba(255,255,255,0.40)">Entry is covered for you on all regular nights</span></li>
            <li>Ride home</li>
            <li>1 drink min. at free-entry venues</li>
          </ul>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- DRESS CODE -->
  <tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">DRESS CODE</p>
        <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7"><strong style="color:#fff">Men:</strong> No shorts, tank tops, sportswear, sandals, or flip-flops.</p>
        <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7"><strong style="color:#fff">Women:</strong> No sandals or flip-flops (ankle-strap sandals are fine).</p>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7"><strong style="color:#fff">ID:</strong> Physical passport required for under 25. Digital ID may work if 25+.</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- TIPS -->
  <tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">TIPS & REMINDERS</p>
    <ul style="margin:0;padding:0 0 0 16px;color:rgba(255,255,255,0.65);font-size:13px;line-height:1.9">
      <li><strong style="color:#fff">Eat before you go</strong> — grab a meal before the crawl for energy</li>
      <li><strong style="color:#fff">Bring cash:</strong> 2,000–3,000 THB for drinks, cover charges, and tips</li>
      <li><strong style="color:#fff">Charge your phone</strong> — WhatsApp is your lifeline for the night</li>
      <li>Your host is there to help — ask anything during the night</li>
    </ul>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0D000A;border:1px solid rgba(255,255,255,0.06);border-radius:0 0 12px 12px;padding:28px 32px;text-align:center">
    <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.40)">Questions? Reach us anytime.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto">
      <tr>
        <td style="padding:0 12px">
          <a href="https://wa.me/66660399569" style="font-size:13px;color:#EA003A;text-decoration:none">WhatsApp</a>
        </td>
        <td style="color:rgba(255,255,255,0.20);font-size:13px">|</td>
        <td style="padding:0 12px">
          <a href="mailto:bangkokclubcrawl@gmail.com" style="font-size:13px;color:#EA003A;text-decoration:none">Email</a>
        </td>
        <td style="color:rgba(255,255,255,0.20);font-size:13px">|</td>
        <td style="padding:0 12px">
          <a href="https://www.instagram.com/nightlife.thailand" style="font-size:13px;color:#EA003A;text-decoration:none">@Nightlife.Thailand</a>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.20)">© 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok</p>
    <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.15)">www.bkkclubcrawl.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
