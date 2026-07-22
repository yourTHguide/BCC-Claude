function formatLocalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// The confirmed-meetup email. meetUpLocation and whatsappGroupLink are always
// passed in from the caller (read fresh from that event_date row at send time)
// — never hardcoded here, so this template always reflects the current saved
// details for that specific event/date.
export function generateConfirmedMeetupEmail({
  guestName,
  nightName,
  eventDate,
  meetUpLocation,
  whatsappGroupLink,
}: {
  guestName: string
  nightName: string
  eventDate: string
  meetUpLocation: string
  whatsappGroupLink: string
}) {
  const formattedDate = formatLocalDate(eventDate)
  const firstName = guestName?.split(' ')[0] || 'Guest'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Tonight is confirmed — Bangkok Club Crawl</title>
</head>
<body style="margin:0;padding:0;background:#0D000A;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D000A;padding:40px 20px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

<tr><td style="background:linear-gradient(135deg,#EA003A,#820065);border-radius:12px 12px 0 0;padding:36px 32px;text-align:center">
<p style="margin:0 0 8px;font-weight:700;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.70)">BANGKOK CLUB CRAWL</p>
<h1 style="margin:0;font-size:28px;font-weight:700;color:#fff;line-height:1.2">Tonight is confirmed.</h1>
<p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.80);font-style:italic">${nightName} · ${formattedDate}</p>
</td></tr>

<tr><td style="background:#1A0015;padding:28px 32px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
<p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.70)">Hey ${firstName},<br><br>
We've got enough of a crew tonight — it's happening. Here's where to be.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:20px">
<tr><td style="padding:20px 24px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
<span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">MEET-UP LOCATION</span>
</td>
<td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right">
<span style="font-size:14px;font-weight:600;color:#fff">${meetUpLocation}</span>
</td>
</tr>
<tr>
<td style="padding:8px 0">
<span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">MEET-UP TIME</span>
</td>
<td style="padding:8px 0;text-align:right">
<span style="font-size:16px;font-weight:700;color:#EA003A">9:30 PM</span>
</td>
</tr>
</table>
</td></tr>
</table>
</td></tr>

<tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(234,0,58,0.08);border:1px solid rgba(234,0,58,0.20);border-left:3px solid #EA003A;border-radius:10px">
<tr><td style="padding:20px 24px;text-align:center">
<p style="margin:0 0 12px;font-size:13px;color:rgba(255,255,255,0.80)">Please join the group chat — this is where tonight's updates go out.</p>
<a href="${whatsappGroupLink}" style="display:inline-block;background:#EA003A;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px">Join WhatsApp group</a>
</td></tr>
</table>
</td></tr>

<tr><td style="background:#1A0015;padding:0 32px 24px;border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06)">
<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.40)">QUICK DRESS CODE REMINDER</p>
<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.7">No shorts, tank tops, sportswear, sandals, or flip-flops for men. No sandals or flip-flops for women (ankle-strap sandals are fine). Bring ID.</p>
</td></tr>

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
</tr>
</table>
<p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.20)">© 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
