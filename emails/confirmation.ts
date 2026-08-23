import { formatStartTime } from '@/lib/dates'
import { revealMeetingPointForTicket } from '@/lib/meetingPointReveal'
import { getAppUrl } from '@/lib/appUrl'

// `whats_included` has been observed in production holding BOTH plain
// strings and `{icon, text}` objects (a separate, not-yet-merged branch's
// icon-system work already wrote the object shape into real rows; this
// branch's ProductPage.tsx still types the column as `string[]`). Extract
// display text defensively rather than assume either shape is the only one
// that will ever appear — never renders "[object Object]".
function itemText(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && 'text' in (item as Record<string, unknown>)) {
    return String((item as Record<string, unknown>).text ?? '')
  }
  return ''
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Product/Event-driven confirmation email (Stage 9 refactor). ONE shared
// template for every Product — Bangkok Club Crawl, New in Bangkok, The
// Builders Club, future BNT/one-time/recurring events — resolved from
// Booking → Event Date → Product → Product Content via the same
// resolveBookingByToken() the ticket page and check-in resolver already
// use (see the webhook, which passes this function's `startTime`/
// `meetingPointRaw`/`itinerary`/`whatsIncluded`/`whatsNotIncluded`/
// `importantInfo` straight from that resolver's output). There is
// deliberately no BCC-specific branch and no separate New-in-Bangkok
// template — a Product with no itinerary/inclusions renders without that
// section, never a default/hardcoded substitute for it.
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
  itinerary,
  whatsIncluded,
  whatsNotIncluded,
  importantInfo,
}: {
  guestName: string
  nightName: string
  eventDate: string
  quantity: number
  totalPaid: number
  promoCode?: string
  // Present only when the webhook's booking INSERT actually succeeded and a
  // ticket_token was persisted — an insert failure must never reference a
  // token that doesn't exist in `bookings`. When absent, the "View Ticket &
  // QR" CTA, QR image, and booking reference are all omitted — there is
  // nothing to link to yet.
  ticket?: { token: string; reference: string } | null
  // Everything below comes from the SAME canonical resolution as `ticket`
  // (event_id/product_id) — all optional/absent together when that
  // resolution wasn't possible (e.g. a legacy checkout path with no
  // event_id). Sanitized via the SAME revealMeetingPointForTicket the
  // ticket page uses, so the email and the ticket page can never disagree
  // about what's disclosable.
  startTime?: string | null
  meetingPointRaw?: unknown | null
  itinerary?: { title: string; description: string }[]
  whatsIncluded?: unknown[]
  whatsNotIncluded?: string[]
  importantInfo?: string[]
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
  const appUrl = getAppUrl()
  const timeLabel = formatStartTime(startTime ?? null)
  const meetingPoint = revealMeetingPointForTicket(meetingPointRaw ?? null)
  const includedItems = (whatsIncluded ?? []).map(itemText).filter(Boolean)
  const notIncludedItems = (whatsNotIncluded ?? []).filter(Boolean)
  const infoItems = (importantInfo ?? []).filter(Boolean)
  const itineraryItems = (itinerary ?? []).filter((i) => i.title || i.description)

  const eyebrow = 'font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.40);margin:0 0 10px'
  const sectionDivider = 'margin:0 0 22px;padding-bottom:22px;border-bottom:1px solid rgba(255,255,255,0.08)'

  const meetingPointHtml = `
    <div style="${sectionDivider}">
      <p style="${eyebrow}">Meeting Point</p>
      ${meetingPoint ? `
      ${meetingPoint.display_name ? `<p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#fff">${esc(meetingPoint.display_name)}</p>` : ''}
      ${meetingPoint.address ? `<p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.60)">${esc(meetingPoint.address)}</p>` : ''}
      ${meetingPoint.instructions ? `<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6">${esc(meetingPoint.instructions)}</p>` : ''}
      ` : `<p style="margin:0;font-size:13px;color:rgba(255,255,255,0.60);line-height:1.6">The exact meeting point will be shared closer to the event.</p>`}
    </div>`

  const itineraryHtml = itineraryItems.length ? `
    <div style="${sectionDivider}">
      <p style="${eyebrow}">How The Night Goes</p>
      ${itineraryItems.map((i) => `
      <p style="margin:0 0 10px;font-size:13px;line-height:1.6">
        ${i.title ? `<strong style="color:#fff">${esc(i.title)}</strong>` : ''}
        ${i.description ? `<br/><span style="color:rgba(255,255,255,0.60)">${esc(i.description)}</span>` : ''}
      </p>`).join('')}
    </div>` : ''

  const inclusionsHtml = (includedItems.length || notIncludedItems.length) ? `
    <div style="${sectionDivider}">
      ${includedItems.length ? `
      <p style="${eyebrow}">What's Included</p>
      <ul style="margin:0 0 ${notIncludedItems.length ? '16px' : '0'};padding:0 0 0 18px;color:rgba(255,255,255,0.65);font-size:13px;line-height:1.8">
        ${includedItems.map((t) => `<li>${esc(t)}</li>`).join('')}
      </ul>` : ''}
      ${notIncludedItems.length ? `
      <p style="${eyebrow}">What's Not Included</p>
      <ul style="margin:0;padding:0 0 0 18px;color:rgba(255,255,255,0.65);font-size:13px;line-height:1.8">
        ${notIncludedItems.map((t) => `<li>${esc(t)}</li>`).join('')}
      </ul>` : ''}
    </div>` : ''

  const importantInfoHtml = infoItems.length ? `
    <div style="${sectionDivider}">
      <p style="${eyebrow}">Good To Know</p>
      <ul style="margin:0;padding:0 0 0 18px;color:rgba(255,255,255,0.65);font-size:13px;line-height:1.8">
        ${infoItems.map((t) => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>` : ''

  // The durable source of truth is this CTA/link, not the inline image —
  // failure to render the QR (a plain <img>, inert on failure) never breaks
  // the email or hides the CTA. Both read from the SAME appUrl, so they can
  // never resolve to different hosts.
  const ticketCtaHtml = ticket ? `
    <div style="text-align:center">
      <img src="${appUrl}/api/tickets/${ticket.token}/qr" width="120" height="120" alt="Check-in QR code" style="display:block;margin:0 auto 14px;width:120px;height:120px;background:#fff;border-radius:8px;padding:6px;border:0" />
      <p style="margin:0 0 3px;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.35)">Booking Reference</p>
      <p style="margin:0 0 18px;font-size:17px;font-weight:700;color:#EA003A;letter-spacing:0.04em">${esc(ticket.reference)}</p>
      <a href="${appUrl}/ticket/${ticket.token}" style="display:inline-block;background:linear-gradient(135deg,#EA003A,#820065);color:#fff;font-weight:600;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none">View Ticket &amp; QR →</a>
      <p style="margin:14px 0 0;font-size:12px;color:rgba(255,255,255,0.40);line-height:1.6">Your full ticket — directions and Add to Calendar included — is always available at that link.</p>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Booking Confirmed — ${esc(nightName)}</title>
</head>
<body style="margin:0;padding:0;background:#0D000A;font-family:'Helvetica Neue',Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D000A;padding:32px 16px">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#EA003A,#820065);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
    <p style="margin:0 0 8px;font-weight:700;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.70)">BEST NIGHTLIFE THAILAND</p>
    <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.2">Booking Confirmed</h1>
    <p style="margin:10px 0 0;font-size:16px;color:rgba(255,255,255,0.80);font-style:italic">${esc(nightName)}</p>
  </td></tr>

  <!-- SINGLE CONTENT CANVAS — no nested cards; sections are separated by a
       thin divider, not a background box each, to stay compact on mobile. -->
  <tr><td style="background:#1A0015;padding:24px 24px 28px;border-radius:0 0 12px 12px">

    <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.70)">Hey ${esc(firstName)}, you're all set.</p>

    <div style="${sectionDivider}">
      <p style="margin:0 0 4px;font-size:19px;font-weight:700;color:#fff">${esc(nightName)}</p>
      <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,0.60)">
        ${formattedDate}${timeLabel ? ` · ${timeLabel}` : ''} · ${quantity} guest${quantity > 1 ? 's' : ''}
      </p>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45)">
        ฿${totalPaid.toLocaleString()} paid${promoCode ? ` · promo ${esc(promoCode)}` : ''}
      </p>
    </div>

    ${meetingPointHtml}
    ${itineraryHtml}
    ${inclusionsHtml}
    ${importantInfoHtml}
    ${ticketCtaHtml}

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#0D000A;padding:24px 24px 0;text-align:center">
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
    <p style="margin:6px 0 20px;font-size:11px;color:rgba(255,255,255,0.15)">www.bkkclubcrawl.com</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
