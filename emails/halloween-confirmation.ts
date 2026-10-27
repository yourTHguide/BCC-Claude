import { getAppUrl } from '@/lib/appUrl'
import { brandFor } from '@/lib/storefrontBrand'

// Event facts for the Bangkok Halloween Crawl 2026 confirmation. Kept here
// (not in product_content) because this email is hand-written copy for a
// one-off night, not the generic product-driven template in confirmation.ts.
export const HALLOWEEN_EVENT = {
  nightSlug: 'halloween-crawl-2026',
  name: 'Bangkok Halloween Crawl 2026',
  dateLabel: 'Saturday, October 31',
  meetVenue: 'Lamaya Bangkok',
  checkInLabel: 'Check-in from 9:00 PM · Arrive by 9:30 PM',
  mapsUrl: 'https://maps.app.goo.gl/fiZtpbXXh6ufTSov7',
  whatsappGroupUrl: 'https://chat.whatsapp.com/CoP8TaF6p3s3fibLw1shfq',
  stops: [
    { name: 'Lamaya', time: '9:30 PM', note: 'Welcome shots + Halloween games' },
    { name: 'Aces Club', time: '~11:15 PM', note: 'Retro ’70s–’80s vibes' },
    { name: 'APT101', time: '~1:00 AM', note: 'Final party, penthouse edition' },
  ],
} as const

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function halloweenEmailSubject() {
  return `You’re in 🎃 Bangkok Halloween Crawl: everything for Oct 31`
}

export function generateHalloweenConfirmationEmail({
  guestName,
  quantity,
  ticket,
}: {
  guestName: string
  quantity: number
  ticket: { token: string; reference: string }
}) {
  const firstName = guestName?.split(' ')[0] || 'there'
  const brand = brandFor('bnt')
  const appUrl = getAppUrl('bnt')
  const qrUrl = `${appUrl}/api/tickets/${ticket.token}/qr`
  const ticketUrl = `${appUrl}/ticket/${ticket.token}`
  const guestLabel = `${quantity} guest${quantity > 1 ? 's' : ''}`

  const eyebrow = 'font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.40);margin:0 0 10px'
  const sectionDivider = 'margin:0 0 22px;padding-bottom:22px;border-bottom:1px solid rgba(255,255,255,0.08)'

  const stopsHtml = HALLOWEEN_EVENT.stops
    .map(
      (s, i) => `
      <tr>
        <td style="vertical-align:top;padding:0 12px 14px 0;width:26px">
          <div style="width:24px;height:24px;border-radius:12px;background:#EA003A;color:#fff;font-size:12px;font-weight:700;line-height:24px;text-align:center">${i + 1}</div>
        </td>
        <td style="vertical-align:top;padding:0 0 14px">
          <p style="margin:0;font-size:14px;font-weight:700;color:#fff">${esc(s.name)} <span style="font-weight:500;color:rgba(255,255,255,0.55)">· ${esc(s.time)}</span></p>
          <p style="margin:2px 0 0;font-size:13px;color:rgba(255,255,255,0.65)">${esc(s.note)}</p>
        </td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>You’re in: ${esc(HALLOWEEN_EVENT.name)}</title>
</head>
<body style="margin:0;padding:0;background:#0D000A;font-family:'Helvetica Neue',Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D000A;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#EA003A,#820065);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
    <p style="margin:0 0 8px;font-weight:700;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.70)">${brand.shortName}</p>
    <h1 style="margin:0;font-size:28px;font-weight:700;color:#fff;line-height:1.2">You’re In 🎃</h1>
    <p style="margin:10px 0 0;font-size:16px;color:rgba(255,255,255,0.85);font-style:italic">${esc(HALLOWEEN_EVENT.name)}</p>
  </td></tr>

  <tr><td style="background:#1A0015;padding:24px 24px 28px;border-radius:0 0 12px 12px">

    <p style="margin:0 0 6px;font-size:16px;color:#fff;font-weight:600">Hey ${esc(firstName)}!</p>
    <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.70);line-height:1.6">You’re confirmed. Here’s everything you need for the night.</p>

    <!-- MEETING POINT -->
    <div style="${sectionDivider}">
      <p style="${eyebrow}">📍 Meet us here</p>
      <p style="margin:0 0 4px;font-size:19px;font-weight:700;color:#fff">${esc(HALLOWEEN_EVENT.meetVenue)}</p>
      <p style="margin:0 0 4px;font-size:14px;color:rgba(255,255,255,0.85)">${esc(HALLOWEEN_EVENT.dateLabel)}</p>
      <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.60)">${esc(HALLOWEEN_EVENT.checkInLabel)}</p>
      <a href="${HALLOWEEN_EVENT.mapsUrl}" style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#fff;font-weight:600;font-size:13px;padding:10px 20px;border-radius:8px;text-decoration:none">Open in Google Maps →</a>
      <p style="margin:14px 0 0;font-size:13px;color:rgba(255,255,255,0.60);line-height:1.6">Look for your hosts at the check-in area. We move as a group, so please don’t be late.</p>
    </div>

    <!-- QR -->
    <div style="${sectionDivider};text-align:center">
      <p style="${eyebrow}">🎟 Your check-in QR code</p>
      <div style="display:inline-block;background:#FFFFFF;border-radius:12px;padding:12px">
        <img src="${qrUrl}" width="200" height="200" alt="Check-in QR code" style="display:block;width:200px;height:200px;border:0"/>
      </div>
      <p style="margin:14px 0 2px;font-size:14px;font-weight:600;color:#fff">${esc(guestName || 'Guest')}</p>
      <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.60)">Ref <span style="color:#EA003A;font-weight:700;letter-spacing:0.04em">${esc(ticket.reference)}</span> · ${guestLabel}</p>
      <p style="margin:0 0 14px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6">Show this at check-in.${quantity > 1 ? ' One QR covers your whole group, so the person who booked can check everyone in.' : ''}</p>
      <a href="${ticketUrl}" style="font-size:13px;color:#EA003A;text-decoration:none;font-weight:600">QR not showing? Open your ticket →</a>
    </div>

    <!-- NIGHT -->
    <div style="${sectionDivider}">
      <p style="${eyebrow}">👻 Your night</p>
      <table cellpadding="0" cellspacing="0" width="100%">${stopsHtml}</table>
      <p style="margin:2px 0 0;font-size:13px;color:rgba(255,255,255,0.60)">Group transport between venues. All entries included.</p>
    </div>

    <!-- GROUP CHAT -->
    <div style="${sectionDivider}">
      <p style="${eyebrow}">💬 Join the group chat</p>
      <p style="margin:0 0 14px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.6">Last-minute updates and host contact on the night.</p>
      <a href="${HALLOWEEN_EVENT.whatsappGroupUrl}" style="display:inline-block;background:linear-gradient(135deg,#EA003A,#820065);color:#fff;font-weight:600;font-size:14px;padding:13px 28px;border-radius:8px;text-decoration:none">Join the Halloween WhatsApp group →</a>
    </div>

    <!-- DRESS CODE / LATE -->
    <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6"><strong>Dress code:</strong> costumes highly encouraged. ID required. No flip-flops.</p>
    <p style="margin:0 0 22px;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6"><strong>Running late?</strong> WhatsApp us on <a href="${brand.supportWhatsappUrl}" style="color:#EA003A;text-decoration:none">${brand.supportWhatsappDisplay}</a>.</p>

    <p style="margin:0;font-size:15px;color:#fff;font-weight:600">See you Saturday. Come in costume. 🎃</p>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0D000A;padding:24px 24px 0;text-align:center">
    <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.40)">Questions? Reach us anytime.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto">
      <tr>
        <td style="padding:0 12px"><a href="${brand.supportWhatsappUrl}" style="font-size:13px;color:#EA003A;text-decoration:none">WhatsApp</a></td>
        <td style="color:rgba(255,255,255,0.20);font-size:13px">|</td>
        <td style="padding:0 12px"><a href="mailto:${brand.supportEmail}" style="font-size:13px;color:#EA003A;text-decoration:none">Email</a></td>
        <td style="color:rgba(255,255,255,0.20);font-size:13px">|</td>
        <td style="padding:0 12px"><a href="https://www.instagram.com/nightlife.thailand" style="font-size:13px;color:#EA003A;text-decoration:none">@Nightlife.Thailand</a></td>
      </tr>
    </table>
    <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.20)">© 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok</p>
    <p style="margin:6px 0 20px;font-size:11px;color:rgba(255,255,255,0.15)">${brand.siteDomain}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
