// Single Meet Club — internal alerts to the operator inbox (not guest-facing).

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const row = (k: string, v: string) =>
  `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${v}</td></tr>`

export interface SmcBookingAlertInput {
  reference: string
  dateLabel: string
  quantity: number
  attendeeNames: string[]
  leadEmail: string
  leadWhatsapp: string
  totalPaid: number
  paymentMethod: string | null
  isTest: boolean
  dashboardUrl: string
}

export function smcBookingAlert(i: SmcBookingAlertInput): { subject: string; html: string } {
  const subject = `${i.isTest ? '[TEST] ' : ''}[SMC] New booking ${i.reference}: ${i.dateLabel} (${i.quantity} guest${i.quantity > 1 ? 's' : ''})`
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#222">
<p><strong>New Single Meet Club booking</strong>${i.isTest ? ' — <strong>TEST (Stripe Sandbox)</strong>' : ''}</p>
<table cellpadding="0" cellspacing="0">
${row('Reference', esc(i.reference))}
${row('Event', esc(i.dateLabel))}
${row('Guests', `${i.quantity}: ${esc(i.attendeeNames.join(', '))}`)}
${row('Lead email', esc(i.leadEmail))}
${row('WhatsApp', esc(i.leadWhatsapp))}
${row('Paid', `฿${i.totalPaid.toLocaleString('en-US')} (${esc(i.paymentMethod ?? 'unknown')})`)}
</table>
<p><a href="${esc(i.dashboardUrl)}">Open the dashboard</a></p>
</div>`
  return { subject, html }
}

export interface SmcOverCapacityAlertInput {
  registrationId: string
  dateLabel: string
  quantity: number
  attendeeNames: string[]
  leadEmail: string
  leadWhatsapp: string
  totalAmount: number
  stripePaymentIntent: string | null
  isTest: boolean
}

export function smcOverCapacityAlert(i: SmcOverCapacityAlertInput): { subject: string; html: string } {
  const subject = `${i.isTest ? '[TEST] ' : ''}[SMC] ACTION NEEDED: paid after event filled — ${i.dateLabel}`
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#222">
<p><strong>A PromptPay or card payment succeeded after its seat hold had lapsed, and the event is now full.</strong>
No ticket has been issued. Please decide: admit above capacity, offer a transfer to another edition, or refund
(an organiser-side exception under the SMC policy).</p>
<table cellpadding="0" cellspacing="0">
${row('Registration', esc(i.registrationId))}
${row('Event', esc(i.dateLabel))}
${row('Guests', `${i.quantity}: ${esc(i.attendeeNames.join(', '))}`)}
${row('Lead email', esc(i.leadEmail))}
${row('WhatsApp', esc(i.leadWhatsapp))}
${row('Paid', `฿${i.totalAmount.toLocaleString('en-US')}`)}
${row('Stripe payment', esc(i.stripePaymentIntent ?? 'unknown'))}
</table>
</div>`
  return { subject, html }
}
