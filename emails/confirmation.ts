export function generateConfirmationEmail({
  guestName,
  nightName,
  eventDate,
  quantity,
  totalPaid,
  promoCode,
}: {
  guestName: string
  nightName: string
  eventDate: string
  quantity: number
  totalPaid: number
  promoCode?: string
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
    <h1 style="margin:0;font-size:28px;font-weight:700;color:#fff;line-height:1.2">You're booked for tonight.</h1>
    <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.80);font-style:italic">${nightName}</p>
  </td></tr>

  <!-- BOOKING SUMMARY -->
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
  </td></tr>

  <!-- MEET-UP DETAILS -->
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

  <!-- CONFIRMATION PROCESS -->
  <tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">CONFIRMATION PROCESS</p>
    <p style="margin:0 0 10px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.7">
      We confirm the event once we reach a minimum of <strong style="color:#fff">5 participants.</strong> A WhatsApp group will be created and the meet-up location shared by 7 PM on the day.
    </p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7">
      If we don't reach the minimum, you'll receive an email with options to reschedule or receive a full refund.
    </p>
  </td></tr>

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
