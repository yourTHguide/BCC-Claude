import { escapeHTML, type AlertMessage } from '@/lib/bnt/leads'
import { WAITLIST_PRODUCTS } from '@/lib/bnt/waitlist'

// Team alert emails for BEST leads, built from the stored database row so
// the same email can be re-sent later from /dashboard/leads if the first
// attempt failed. Layout/colours unchanged from the Phase 3 templates.

export interface InquiryRow {
  id: string
  created_at?: string | null
  name: string
  whatsapp: string
  email?: string | null
  experience?: string | null
  inquiry_type?: string | null
  occasion?: string | null
  event_date?: string | null
  is_flexible_date?: boolean | null
  group_size?: string | null
  budget_range?: string | null
  preferred_vibe?: string | null
  request_details?: string | null
  source?: string | null
}

export interface ContactRow {
  id: string
  created_at?: string | null
  name: string
  whatsapp: string
  message?: string | null
}

export interface WaitlistRow {
  id: string
  created_at?: string | null
  product_slug: string
  email: string
  name?: string | null
}

function waLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`
}

function row(label: string, value: string, opts: { gold?: boolean; pre?: boolean } = {}): string {
  return `<tr><td style="padding:8px 0;font-size:13px;color:#8E8E93;text-transform:uppercase;letter-spacing:0.08em;width:35%;vertical-align:top;">${label}</td>
<td style="padding:8px 0;font-size:${opts.gold ? 15 : 14}px;color:${opts.gold ? '#D4AF37' : '#FFFFFF'};font-weight:${opts.gold ? 700 : 600};line-height:1.5;${opts.pre ? 'white-space:pre-wrap;' : ''}">${value}</td></tr>
<tr><td colspan="2" style="border-bottom:1px solid rgba(255,255,255,0.06);"></td></tr>`
}

function shell(title: string, kicker: string, badge: string | null, heading: string, rows: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeHTML(title)}</title></head>
<body style="margin:0;padding:0;background-color:#08080A;font-family:'Inter',sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080A;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding-bottom:24px;">
          <h1 style="margin:0;font-family:'Montserrat',sans-serif;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:0.05em;text-transform:uppercase;">${kicker}</h1>
          <p style="margin:6px 0 0;font-size:11px;color:#FF2D95;letter-spacing:0.15em;text-transform:uppercase;">BEST Nightlife Thailand</p>
        </td></tr>
        <tr><td style="background-color:#121216;border-radius:16px;border:1px solid rgba(255,255,255,0.06);padding:32px;">
          ${badge ? `<div style="display:inline-block;margin-bottom:24px;background:linear-gradient(135deg,#FF2D95,#FF6B9D);color:#FFFFFF;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:6px 16px;border-radius:9999px;">${escapeHTML(badge)}</div>` : ''}
          <h2 style="margin:0 0 20px;font-size:20px;font-family:'Montserrat',sans-serif;color:#D4AF37;font-weight:600;">${heading}</h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1C1C22;border-radius:12px;padding:20px;border:1px solid rgba(255,255,255,0.04);">
            ${rows}
          </table>
        </td></tr>
        <tr><td align="center" style="padding-top:24px;">
          <p style="margin:0;font-size:11px;color:#55555C;letter-spacing:0.05em;">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function dateLabel(r: InquiryRow): string {
  if (r.event_date) return r.event_date
  return r.is_flexible_date ? 'Flexible' : 'TBD'
}

export function buildInquiryAlert(r: InquiryRow, opts: { retry?: boolean } = {}): AlertMessage {
  const experience = r.experience || 'Private Inquiry'
  const subject = `${opts.retry ? '[Re-sent] ' : ''}🚨 VIP LEAD: ${r.name} - ${experience}`
  const wa = `<a href="${waLink(r.whatsapp)}" style="color:#00E676;text-decoration:none;font-weight:700;">${escapeHTML(r.whatsapp)} 💬 (Click to Chat)</a>`
  const rows = [
    row('Guest Name', escapeHTML(r.name)),
    row('WhatsApp', wa),
    row('Email', escapeHTML(r.email || 'Not provided')),
    row('Experience', escapeHTML(experience)),
    row('Occasion', escapeHTML(r.occasion || 'N/A')),
    row('Event Date', escapeHTML(dateLabel(r))),
    row('Group Size', `${escapeHTML(r.group_size || 'TBD')} pax`),
    row('Preferred Vibe', escapeHTML(r.preferred_vibe || 'N/A'), { pre: true }),
    r.request_details ? row('Details', escapeHTML(r.request_details), { pre: true }) : '',
    row('Estimated Budget', escapeHTML(r.budget_range || 'TBD'), { gold: true }),
  ].join('')
  const footer = `Saved in bnt_experience_inquiries${r.id ? ` · ${escapeHTML(r.id.slice(0, 8))}` : ''}. Reply to the guest on WhatsApp within 24 hours.`
  const html = shell(subject, '🚨 NEW VIP LEAD', experience, 'Inquiry Details', rows, footer)
  const text = [
    'New VIP Lead',
    `Name: ${r.name}`,
    `WhatsApp: ${r.whatsapp}`,
    `Email: ${r.email || 'Not provided'}`,
    `Experience: ${experience}`,
    `Occasion: ${r.occasion || 'N/A'}`,
    `Date: ${dateLabel(r)}`,
    `Pax: ${r.group_size || 'TBD'}`,
    `Vibe: ${r.preferred_vibe || 'N/A'}`,
    r.request_details ? `Details: ${r.request_details}` : '',
    `Budget: ${r.budget_range || 'TBD'}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { subject, html, text }
}

export function buildContactAlert(r: ContactRow, opts: { retry?: boolean } = {}): AlertMessage {
  const subject = `${opts.retry ? '[Re-sent] ' : ''}✉️ NEW CONTACT LEAD: ${r.name}`
  const wa = `<a href="${waLink(r.whatsapp)}" style="color:#00E676;text-decoration:none;font-weight:700;">${escapeHTML(r.whatsapp)} 💬 (Click to Chat)</a>`
  const rows = [
    row('Name', escapeHTML(r.name)),
    row('WhatsApp', wa),
    row('Message', escapeHTML(r.message || 'No message provided'), { pre: true }),
  ].join('')
  const html = shell(subject, '✉️ NEW CONTACT FORM', null, 'Message Details', rows, 'Saved in bnt_contact_messages. Reply within 24 hours.')
  const text = `New Contact Message\nName: ${r.name}\nWhatsApp: ${r.whatsapp}\nMessage: ${r.message || 'No message provided'}`
  return { subject, html, text }
}

export function buildWaitlistAlert(r: WaitlistRow, opts: { retry?: boolean } = {}): AlertMessage {
  const productName = WAITLIST_PRODUCTS[r.product_slug]?.name || r.product_slug
  const subject = `${opts.retry ? '[Re-sent] ' : ''}Waitlist: ${productName} — ${r.email}`
  const html = `<p><strong>New waitlist sign-up</strong></p>
<p>Event: ${escapeHTML(productName)}<br>Name: ${escapeHTML(r.name || 'Not given')}<br>Email: ${escapeHTML(r.email)}</p>
<p style="color:#888">Saved in bnt_waitlist. They agreed to emails about new ${escapeHTML(productName)} dates only. No reply needed.</p>`
  const text = `New waitlist sign-up\nEvent: ${productName}\nName: ${r.name || 'Not given'}\nEmail: ${r.email}`
  return { subject, html, text }
}
