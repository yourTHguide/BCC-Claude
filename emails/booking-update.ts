import type { Storefront } from '@/lib/storefront'
import { brandFor } from '@/lib/storefrontBrand'

// One template for every operator-initiated booking change (reschedule,
// cancel with/without refund). The operator writes the "why" in their own
// words (`message`); the template adds the booking facts so they are never
// retyped. Product-neutral copy: works for Club Crawl, SMC, NIB alike.

export type BookingUpdateKind = 'reschedule' | 'cancel'
export type RefundMode = 'stripe' | 'manual' | 'none'

export interface BookingUpdateEmailInput {
  kind: BookingUpdateKind
  guestName: string | null
  nightName: string
  oldDate: string
  newDate?: string | null
  quantity: number
  totalPaid: number
  refundMode?: RefundMode
  message?: string | null
  storefront?: Storefront | null
  // 'smc' renders in the Single Meet Club look (same as the SMC
  // confirmation email); everything else uses the BEST/BCC look.
  theme?: EmailTheme
}

export type EmailTheme = 'default' | 'smc'

// Pick the look from the booking/event's night slug.
export function themeForNight(nightSlug: string | null | undefined): EmailTheme {
  return nightSlug === 'smc' ? 'smc' : 'default'
}

interface Palette {
  page: string
  body: string
  bodyBorder: string
  text: string
  muted: string
  cardBg: string
  cardBorder: string
  cardLabel: string
  cardValue: string
  cardStrike: string
  accent: string
  rowBorder: string
}

const PALETTE: Record<EmailTheme, Palette> = {
  default: {
    page: '#0D000A', body: '#1A0015', bodyBorder: 'rgba(255,255,255,0.06)',
    text: 'rgba(255,255,255,0.78)', muted: 'rgba(255,255,255,0.65)',
    cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
    cardLabel: 'rgba(255,255,255,0.35)', cardValue: '#fff', cardStrike: 'rgba(255,255,255,0.45)',
    accent: '#EA003A', rowBorder: 'rgba(255,255,255,0.06)',
  },
  // Same colours as emails/smc-confirmation.ts and the SMC landing page.
  smc: {
    page: '#200E14', body: '#200E14', bodyBorder: '#200E14',
    text: 'rgba(255,255,255,0.82)', muted: 'rgba(255,255,255,0.65)',
    cardBg: '#F5EEE7', cardBorder: '#F5EEE7',
    cardLabel: '#4A3B40', cardValue: '#21171B', cardStrike: '#4A3B40',
    accent: '#F0444B', rowBorder: 'rgba(33,23,27,0.12)',
  },
}

function formatLocalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Operator text -> safe HTML paragraphs (blank line = new paragraph).
export function messageToHtml(message: string, color = 'rgba(255,255,255,0.78)'): string {
  return message
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;color:${color};line-height:1.7;font-family:Arial,sans-serif">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function bookingUpdateSubject(i: Pick<BookingUpdateEmailInput, 'kind' | 'nightName'>): string {
  return i.kind === 'reschedule' ? `Your booking date has changed — ${i.nightName}` : `Your booking has been cancelled — ${i.nightName}`
}

function row(P: Palette, label: string, value: string, opts: { last?: boolean; kind?: 'normal' | 'strike' | 'accent' } = {}) {
  const border = opts.last ? '' : `border-bottom:1px solid ${P.rowBorder};`
  const style =
    opts.kind === 'strike' ? `font-size:14px;font-weight:600;color:${P.cardStrike};text-decoration:line-through`
      : opts.kind === 'accent' ? `font-size:15px;font-weight:700;color:${P.accent}`
        : `font-size:14px;font-weight:600;color:${P.cardValue}`
  return `<tr>
    <td style="padding:8px 0;${border}font-family:Arial,sans-serif"><span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${P.cardLabel}">${label}</span></td>
    <td style="padding:8px 0;${border}text-align:right;font-family:Arial,sans-serif"><span style="${style}">${value}</span></td>
  </tr>`
}

export function generateBookingUpdateEmail(i: BookingUpdateEmailInput): string {
  const brand = brandFor(i.storefront)
  const theme: EmailTheme = i.theme ?? 'default'
  const P = PALETTE[theme]
  const isSmc = theme === 'smc'
  const firstName = escapeHtml(i.guestName?.split(' ')[0] || 'there')
  const night = escapeHtml(i.nightName)
  const amount = `฿${Number(i.totalPaid || 0).toLocaleString()}`
  const tickets = `${i.quantity} person${i.quantity > 1 ? 's' : ''}`
  const isReschedule = i.kind === 'reschedule'
  const refundMode: RefundMode = i.refundMode ?? 'none'
  const strong = (t: string) => `<strong style="color:#fff">${t}</strong>`

  const title = isReschedule ? 'Your booking date has changed' : 'Your booking has been cancelled'
  const para = (t: string) => `<p style="margin:0 0 14px;font-size:15px;color:${P.text};line-height:1.7;font-family:Arial,sans-serif">${t}</p>`
  const intro = i.message?.trim()
    ? messageToHtml(i.message, P.text)
    : para(isReschedule ? `We've moved your ${night} booking to a new date.` : `Your ${night} booking has been cancelled.`)

  const rows = isReschedule
    ? [
        row(P, 'Original date', formatLocalDate(i.oldDate), { kind: 'strike' }),
        row(P, 'New date', formatLocalDate(i.newDate ?? i.oldDate), { kind: 'accent' }),
        row(P, 'Tickets', tickets),
        row(P, 'Total paid', amount, { last: true }),
      ]
    : [
        row(P, 'Date', formatLocalDate(i.oldDate), { kind: 'strike' }),
        row(P, 'Tickets', tickets, { last: refundMode === 'none' }),
        ...(refundMode === 'none' ? [] : [row(P, 'Refund amount', amount, { last: true, kind: 'accent' })]),
      ]

  const closing = isReschedule
    ? 'Your spot is confirmed for the new date — nothing else to do. If it doesn\'t work for you, just reply to this email and we\'ll sort out another date or a refund.'
    : refundMode === 'stripe'
      ? `A full refund of ${strong(amount)} has been issued to your original payment method. Depending on your bank, it can take ${strong('5–10 business days')} to appear.`
      : refundMode === 'manual'
        ? `We're refunding ${strong(amount)} to you directly. If we need any details from you to send it, we'll be in touch — or just reply to this email.`
        : 'If you have any questions, just reply to this email.'

  const header = isSmc
    ? `<tr><td style="padding:28px 24px 8px;font:700 24px/1 Impact,'Arial Narrow',Arial,sans-serif;letter-spacing:0.5px;text-transform:uppercase;color:#FFFFFF">Single <span style="color:${P.accent}">Meet Club</span></td></tr>
  <tr><td style="padding:16px 24px 18px;font:700 30px/1.08 Impact,'Arial Narrow',Arial,sans-serif;text-transform:uppercase;color:#FFFFFF">${title}</td></tr>`
    : `<tr><td style="background:linear-gradient(135deg,#EA003A,#820065);border-radius:12px 12px 0 0;padding:36px 32px;text-align:center">
    <p style="margin:0 0 8px;font-weight:700;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.70)">${brand.shortName}</p>
    <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff;line-height:1.2">${title}</h1>
    <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.80);font-style:italic">${night}</p>
  </td></tr>`

  const bodyPad = isSmc ? '8px 24px 24px' : '28px 32px'
  const bodySides = isSmc ? '' : `border-left:1px solid ${P.bodyBorder};border-right:1px solid ${P.bodyBorder};`

  const footer = isSmc
    ? `<tr><td style="padding:4px 24px 18px;font:14px/1.6 Arial,sans-serif;color:${P.muted}">
    Questions? <a href="${brand.supportWhatsappUrl}" style="color:#FFFFFF;font-weight:600">WhatsApp ${brand.supportWhatsappDisplay}</a> or reply to this email.
  </td></tr>
  <tr><td style="padding:14px 24px 28px;border-top:1px solid rgba(255,255,255,0.12);font:12px/1.6 Arial,sans-serif;color:rgba(255,255,255,0.45)">
    Single Meet Club · Presented by BEST Nightlife Thailand<br>${brand.siteDomain}/single-meet-club
  </td></tr>`
    : `<tr><td style="background:${P.page};border:1px solid ${P.bodyBorder};border-radius:0 0 12px 12px;padding:28px 32px;text-align:center">
    <p style="margin:0 0 16px;font-size:13px;color:rgba(255,255,255,0.40)">Questions? Reach us anytime.</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
      <td style="padding:0 12px"><a href="${brand.supportWhatsappUrl}" style="font-size:13px;color:${P.accent};text-decoration:none">WhatsApp</a></td>
      <td style="color:rgba(255,255,255,0.20);font-size:13px">|</td>
      <td style="padding:0 12px"><a href="mailto:${brand.supportEmail}" style="font-size:13px;color:${P.accent};text-decoration:none">Email</a></td>
    </tr></table>
    <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.20)">© 2026 BEST Nightlife Thailand · Sanctuary Nexus Co., Ltd. · Bangkok</p>
    <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.15)">${brand.siteDomain}</p>
  </td></tr>`

  const docTitle = isSmc ? `${title} — Single Meet Club` : `${title} — ${brand.name}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${docTitle}</title>
</head>
<body style="margin:0;padding:0;background:${P.page};font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${P.page};padding:${isSmc ? '24px 12px' : '40px 20px'}">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  ${header}
  <tr><td style="background:${P.body};padding:${bodyPad};${bodySides}">
    ${para(`Hi ${firstName},`)}
    ${intro}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${P.cardBg};border:1px solid ${P.cardBorder};border-radius:${isSmc ? '14px' : '10px'};margin:10px 0 24px">
      <tr><td style="padding:20px 24px"><table width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table></td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:${P.muted};line-height:1.7;font-family:Arial,sans-serif">${closing}</p>
  </td></tr>
  ${footer}
</table>
</td></tr>
</table>
</body>
</html>`
}
