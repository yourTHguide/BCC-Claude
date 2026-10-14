// Single Meet Club — guest confirmation email (SMC-branded).
// Table layout + inline styles for email-client compatibility. Every value
// that came from a guest is escaped.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface SmcConfirmationEmailInput {
  reference: string
  leadName: string
  attendeeNames: string[]
  quantity: number
  totalPaid: number // THB
  paymentMethod: 'card' | 'promptpay' | null
  dateLabel: string // "Thursday 29 October 2026"
  timeLabel: string // "7:30 PM"
  venueName: string
  venueAddress: string
  mapsUrl: string | null
  ticketUrl: string
  qrImageUrl: string
  calendarUrl: string
  supportWhatsappUrl: string
  supportWhatsappDisplay: string
  isTest: boolean
}

const C = {
  night: '#200E14',
  panel: '#371923',
  cream: '#F5EEE7',
  ink: '#21171B',
  inkSoft: '#4A3B40',
  coral: '#F0444B',
  coralDark: '#C2362A',
  muted: 'rgba(255,255,255,0.65)',
}

export function smcConfirmationSubject(input: Pick<SmcConfirmationEmailInput, 'dateLabel' | 'isTest'>): string {
  return `${input.isTest ? '[TEST] ' : ''}You're in — Single Meet Club, ${input.dateLabel}`
}

export function generateSmcConfirmationEmail(i: SmcConfirmationEmailInput): string {
  const firstName = esc(i.leadName.split(' ')[0] || i.leadName)
  const guests = i.attendeeNames.map((n) => `<li style="margin:0 0 4px">${esc(n)}</li>`).join('')
  const method = i.paymentMethod === 'promptpay' ? 'PromptPay' : i.paymentMethod === 'card' ? 'Card' : 'Paid'
  const testBanner = i.isTest
    ? `<tr><td style="background:#FFD54F;color:#21171B;padding:10px 24px;font:600 13px Arial,sans-serif;text-align:center">TEST BOOKING — Stripe Sandbox. No real payment was taken.</td></tr>`
    : ''

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Single Meet Club</title></head>
<body style="margin:0;padding:0;background:${C.night}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.night}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
${testBanner}
<tr><td style="padding:28px 24px 8px;font:700 24px/1 Impact,'Arial Narrow',Arial,sans-serif;letter-spacing:0.5px;text-transform:uppercase;color:#FFFFFF">
  Single <span style="color:${C.coral}">Meet Club</span>
</td></tr>
<tr><td style="padding:16px 24px 4px;font:700 34px/1.05 Impact,'Arial Narrow',Arial,sans-serif;text-transform:uppercase;color:#FFFFFF">You're in, ${firstName}.</td></tr>
<tr><td style="padding:8px 24px 20px;font:15px/1.5 Arial,sans-serif;color:${C.muted}">Your spot${i.quantity > 1 ? 's are' : ' is'} confirmed. Show the QR code below at check-in.</td></tr>

<tr><td style="padding:0 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-radius:16px">
<tr><td style="padding:22px 22px 6px;font:600 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${C.coralDark}">Booking ${esc(i.reference)}</td></tr>
<tr><td style="padding:0 22px 14px;font:700 26px/1.05 Impact,'Arial Narrow',Arial,sans-serif;text-transform:uppercase;color:${C.ink}">${esc(i.dateLabel)}</td></tr>
<tr><td style="padding:0 22px;font:15px/1.6 Arial,sans-serif;color:${C.ink}">
  <strong>${esc(i.timeLabel)} onwards</strong><br>
  ${esc(i.venueName)}<br>
  <span style="color:${C.inkSoft}">${esc(i.venueAddress)}</span>
  ${i.mapsUrl ? `<br><a href="${esc(i.mapsUrl)}" style="color:${C.coralDark};font-weight:600">View on map</a>` : ''}
</td></tr>
<tr><td style="padding:16px 22px 0;font:15px/1.5 Arial,sans-serif;color:${C.ink}">
  <strong>Guests (${i.quantity})</strong>
  <ul style="margin:6px 0 0;padding-left:18px;color:${C.inkSoft}">${guests}</ul>
</td></tr>
<tr><td style="padding:12px 22px 0;font:14px Arial,sans-serif;color:${C.inkSoft}">฿${i.totalPaid.toLocaleString('en-US')} · ${method} · includes one welcome drink per guest</td></tr>
<tr><td align="center" style="padding:20px 22px 8px">
  <img src="${esc(i.qrImageUrl)}" width="200" height="200" alt="Check-in QR code for booking ${esc(i.reference)}" style="display:block;border:0;border-radius:8px;background:#FFFFFF">
</td></tr>
<tr><td align="center" style="padding:4px 22px 6px;font:13px Arial,sans-serif;color:${C.inkSoft}">One QR code for your whole booking — your group checks in together.</td></tr>
<tr><td align="center" style="padding:14px 22px 8px">
  <a href="${esc(i.ticketUrl)}" style="display:inline-block;background:${C.coral};color:#FFFFFF;text-decoration:none;font:700 15px Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;padding:14px 26px;border-radius:999px">View your ticket</a>
</td></tr>
<tr><td align="center" style="padding:4px 22px 22px;font:14px Arial,sans-serif">
  <a href="${esc(i.calendarUrl)}" style="color:${C.coralDark};font-weight:600">Add to Google Calendar</a>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:22px 24px 6px;font:600 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:${C.coral}">Good to know</td></tr>
<tr><td style="padding:0 24px;font:14px/1.6 Arial,sans-serif;color:${C.muted}">
  <ul style="margin:0;padding-left:18px">
    <li>Every guest must be 20 or older. ID may be requested at the door.</li>
    <li>Tickets are non-refundable for guest cancellations, no-shows or late arrival.</li>
    <li>Need to transfer a ticket to another eligible guest? Message us at least 24 hours before the event; transfers are subject to organiser approval.</li>
  </ul>
</td></tr>
<tr><td style="padding:18px 24px;font:14px/1.6 Arial,sans-serif;color:${C.muted}">
  Questions? WhatsApp <a href="${esc(i.supportWhatsappUrl)}" style="color:#FFFFFF;font-weight:600">${esc(i.supportWhatsappDisplay)}</a>
</td></tr>
<tr><td style="padding:14px 24px 28px;border-top:1px solid rgba(255,255,255,0.12);font:12px/1.6 Arial,sans-serif;color:rgba(255,255,255,0.45)">
  Single Meet Club · Presented by BEST Nightlife Thailand · Venue partner: Tony's Restaurant &amp; Bar<br>
  You received this email because you booked Single Meet Club.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}
