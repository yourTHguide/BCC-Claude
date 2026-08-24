import type { Storefront } from '@/lib/storefront'
import { brandFor } from '@/lib/storefrontBrand'

// Format a YYYY-MM-DD string using LOCAL date components (not new Date(str),
// which parses as UTC midnight and can roll the date back a day depending on server TZ)
function formatLocalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function generateCancellationEmail({
  guestName,
  nightName,
  eventDate,
  quantity,
  totalPaid,
  storefront,
}: {
  guestName: string
  nightName: string
  eventDate: string
  quantity: number
  totalPaid: number
  // Stage 10 Phase 6 — defaults to 'bcc', so every pre-Phase-6 call site
  // (this template's original signature) gets EXACTLY today's "BANGKOK CLUB
  // CRAWL" header/footer, byte-identical. This is the fix for the real
  // regression Guide observed after cancelling the Stage 9 test booking: a
  // BNT/New-in-Bangkok cancellation email showed "Bangkok Club Crawl"
  // instead of "BEST Nightlife Thailand".
  storefront?: Storefront | null
}) {
  const formattedDate = formatLocalDate(eventDate)
  const firstName = guestName?.split(' ')[0] || 'Guest'
  const brand = brandFor(storefront)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Your booking has been cancelled — ${brand.name}</title>
</head>
<body style="margin:0;padding:0;background:#0D000A;font-family:'Helvetica Neue',Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D000A;padding:40px 20px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#EA003A,#820065);border-radius:12px 12px 0 0;padding:36px 32px;text-align:center">
    <p style="margin:0 0 8px;font-weight:700;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.70)">${brand.shortName}</p>
    <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.2">Your booking has been cancelled</h1>
    <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.80);font-style:italic">${nightName}</p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#1A0015;padding:28px 32px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.70)">Hey ${firstName},<br><br>
    We're sorry — we weren't able to run ${nightName} on <strong style="color:#fff">${formattedDate}</strong>, so your booking has been cancelled.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">DATE</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right">
              <span style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.45);text-decoration:line-through">${formattedDate}</span>
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
            <td style="padding:8px 0">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">REFUND AMOUNT</span>
            </td>
            <td style="padding:8px 0;text-align:right">
              <span style="font-size:16px;font-weight:700;color:#EA003A">฿${totalPaid.toLocaleString()}</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.7">
      A full refund of <strong style="color:#fff">฿${totalPaid.toLocaleString()}</strong> has been issued to your original payment method. Depending on your bank, it can take <strong style="color:#fff">5–10 business days</strong> to appear on your statement.
    </p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7">
      We'd love to have you out on another night — reply to this email or message us on WhatsApp anytime.
    </p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0D000A;border:1px solid rgba(255,255,255,0.06);border-radius:0 0 12px 12px;padding:28px 32px;text-align:center">
    <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.40)">Questions? Reach us anytime.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto">
      <tr>
        <td style="padding:0 12px">
          <a href="${brand.supportWhatsappUrl}" style="font-size:13px;color:#EA003A;text-decoration:none">WhatsApp</a>
        </td>
        <td style="color:rgba(255,255,255,0.20);font-size:13px">|</td>
        <td style="padding:0 12px">
          <a href="mailto:${brand.supportEmail}" style="font-size:13px;color:#EA003A;text-decoration:none">Email</a>
        </td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.20)">© 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok</p>
    <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.15)">${brand.siteDomain}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
