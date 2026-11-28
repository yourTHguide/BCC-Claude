import { brandFor } from '@/lib/storefrontBrand'
import { escapeHtml } from '@/lib/hostReports'
import { bccEmailLogo, BCC_BUTTON_BG } from '@/emails/brandLogo'

// "Your night / van isn't running" emails (Phase 3D). One layout, three kinds:
//   options  — first email: choose a full refund, a move, or credit
//   reminder — 24 h later, no choice yet
//   credited — 48 h without a choice: the money is kept as credit
// Plain, warm, no pressure; credit is always refundable on request.

export type OptionsReason = 'night_short' | 'van2_short'
export type OptionsEmailKind = 'options' | 'reminder' | 'credited'

export interface OptionsEmailInput {
  kind: OptionsEmailKind
  reason: OptionsReason
  guestName: string | null
  nightName: string
  dateLabel: string
  quantity: number
  totalPaid: number
  link: string
  creditExpires?: string
}

const REASON: Record<OptionsReason, string> = {
  night_short: 'Not enough guests booked for this night to run it, so we can’t go ahead.',
  van2_short: 'Van 2 didn’t reach the 4 guests it needs, so it won’t run. Van 1 is going ahead, but it’s full.',
}

export function optionsEmailSubject(i: Pick<OptionsEmailInput, 'kind' | 'nightName' | 'dateLabel'>): string {
  if (i.kind === 'credited') return `Your credit for ${i.nightName} is ready`
  if (i.kind === 'reminder') return `Reminder: choose a refund or a new date — ${i.nightName}`
  return `Change to your booking: ${i.nightName}, ${i.dateLabel}`
}

export function generateOptionsEmail(i: OptionsEmailInput): string {
  const brand = brandFor('bcc')
  const first = (i.guestName ?? '').trim().split(/\s+/)[0] || 'there'
  const amount = `฿${Math.round(i.totalPaid).toLocaleString()}`
  const btn = (label: string, primary: boolean) =>
    `<a href="${i.link}" style="display:inline-block;margin:6px 6px 0 0;padding:13px 20px;border-radius:10px;font-weight:600;font-size:15px;text-decoration:none;${primary ? `${BCC_BUTTON_BG};color:#fff` : 'border:1px solid rgba(255,255,255,0.3);color:#fff'}">${label}</a>`

  let body: string
  if (i.kind === 'credited') {
    body = `<p>Hi ${escapeHtml(first)},</p>
      <p>We didn’t hear back about your booking for <strong>${escapeHtml(i.nightName)}</strong> on ${escapeHtml(i.dateLabel)}, so we’ve kept your <strong>${amount}</strong> as credit for your next night with us${i.creditExpires ? ` (valid until ${escapeHtml(i.creditExpires)})` : ''}.</p>
      <p>Prefer your money back? No problem — a full refund is still available until you use the credit.</p>
      ${btn('See my booking', true)}`
  } else {
    body = `<p>Hi ${escapeHtml(first)},</p>
      ${i.kind === 'reminder' ? '<p>Just a reminder — we still need your choice for this booking.</p>' : ''}
      <p>Your booking for <strong>${escapeHtml(i.nightName)}</strong> on ${escapeHtml(i.dateLabel)} (${i.quantity} ticket${i.quantity === 1 ? '' : 's'}, ${amount}): ${REASON[i.reason]}</p>
      <p>Sorry about that! Please choose what you’d like:</p>
      <ul style="padding-left:18px;margin:8px 0">
        <li><strong>Full refund</strong> of ${amount}</li>
        <li><strong>Move to another date</strong> — pick a night, or tell us what suits you</li>
        <li><strong>Keep it as credit</strong> for a future night</li>
      </ul>
      ${btn('Choose refund or new date', true)}
      <p style="font-size:13px;margin-top:16px">Or just reply to this email. If we don’t hear from you within 48 hours, we’ll keep your ${amount} as credit for your next night (still refundable any time before you use it).</p>`
  }
  return `<!doctype html><html><body style="margin:0;background:#0D000A;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="background:#1A0015;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px 24px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6">
      ${bccEmailLogo()}
      ${body}
      <p style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:22px">Questions? Reply here or message us on WhatsApp.</p>
    </div>
  </div></body></html>`
}
