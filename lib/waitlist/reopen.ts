import type { SupabaseClient } from '@supabase/supabase-js'
import { escapeHTML } from '@/lib/bnt/leads'
import { getAppUrl } from '@/lib/appUrl'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { loadBccInstance, type BccInstance } from '@/lib/waitlist/bccInstances'
import { longEventDate, seatCap, SOLD_OUT_SCOPE } from '@/lib/waitlist/soldOut'

export { seatCap }

// "Seats reopened" notice for one Bangkok Club Crawl date (Phase 3B).
// Drafted, previewed and approved by an owner/admin in /dashboard/leads;
// never sent automatically. Goes only to that date's sold-out sign-ups whose
// party fits the seats left, each at most once.

export interface ReopenAnnouncement {
  id: string
  kind: 'sold_out_reopen'
  product_slug: string
  event_date_id: string
  max_party_size: number
  dates_summary: string
  subject: string
  intro: string | null
  status: 'draft' | 'sending' | 'sent' | 'cancelled'
}

function time12(hhmmss: string | null): string {
  if (!hhmmss) return ''
  const [h, m] = hhmmss.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// One line that pins down what the email promises. Re-computed at send time;
// if night, date, time or price changed, the draft must be redone.
export function reopenSummary(i: Pick<BccInstance, 'nightName' | 'eventDate' | 'startTime' | 'priceThb'>): string {
  return [i.nightName, longEventDate(i.eventDate), time12(i.startTime), i.priceThb != null ? `฿${Number(i.priceThb).toLocaleString('en-US')} per person` : '']
    .filter(Boolean)
    .join(' · ')
}

export function defaultReopenSubject(i: Pick<BccInstance, 'nightName' | 'eventDate'>): string {
  return `Seats just opened: ${i.nightName}, ${longEventDate(i.eventDate)}`
}

export type ReopenCheck = { ok: true; instance: BccInstance; cap: number } | { ok: false; error: string }

// Re-checks the date immediately before any preview/test/send batch.
export async function verifyReopen(supabase: SupabaseClient, a: Pick<ReopenAnnouncement, 'event_date_id' | 'max_party_size' | 'dates_summary' | 'product_slug'>): Promise<ReopenCheck> {
  if (a.product_slug !== BCC_PRODUCT_SLUG) return { ok: false, error: 'Reopen notices are for Bangkok Club Crawl only.' }
  const instance = await loadBccInstance(supabase, a.event_date_id)
  if (!instance) return { ok: false, error: 'This date no longer exists.' }
  if (instance.state !== 'bookable') {
    return { ok: false, error: `This date can't be booked right now (${instance.state.replace('_', ' ')}). Nothing was sent.` }
  }
  if (reopenSummary(instance) !== a.dates_summary) {
    return { ok: false, error: 'The night, time or price changed since this draft was written. Cancel it and create a new one.' }
  }
  const cap = seatCap(a.max_party_size, instance.remaining)
  if (cap < 1) return { ok: false, error: 'No seats are left for this date any more. Nothing was sent.' }
  return { ok: true, instance, cap }
}

export interface ReopenAudience {
  total: number // active sold-out sign-ups for this date
  eligible: number // would be emailed at this cap
  bySize: { size: number; count: number }[]
  alreadyNotified: number
}

// Counts for the admin preview (who would get it at a given cap).
export async function reopenAudience(supabase: SupabaseClient, eventDateId: string, cap: number): Promise<ReopenAudience> {
  const { data, error } = await supabase
    .from('bnt_waitlist')
    .select('party_size, notified_at')
    .eq('consent_scope', SOLD_OUT_SCOPE)
    .eq('event_date_id', eventDateId)
    .is('unsubscribed_at', null)
  if (error) throw error
  const rows = data || []
  const sizes = new Map<number, number>()
  for (const r of rows) if (!r.notified_at) sizes.set(r.party_size, (sizes.get(r.party_size) ?? 0) + 1)
  return {
    total: rows.length,
    eligible: rows.filter((r) => !r.notified_at && r.party_size <= cap).length,
    bySize: Array.from(sizes.entries()).sort((x, y) => x[0] - y[0]).map(([size, count]) => ({ size, count })),
    alreadyNotified: rows.filter((r) => r.notified_at).length,
  }
}

export function reopenUnsubscribeUrl(token: string): string {
  return `${getAppUrl('bcc')}/waitlist/unsubscribe?token=${encodeURIComponent(token)}`
}
export function reopenOneClickUnsubscribeUrl(token: string): string {
  return `${getAppUrl('bcc')}/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`
}

export function buildReopenEmail(
  a: Pick<ReopenAnnouncement, 'subject' | 'intro'>,
  instance: Pick<BccInstance, 'nightName' | 'nightSlug' | 'eventDate' | 'startTime' | 'priceThb'>,
  recipient: { name?: string | null; partySize: number; unsubscribeToken: string }
) {
  const base = getAppUrl('bcc')
  const bookUrl = `${base}/book?date=${instance.eventDate}&night=${encodeURIComponent(instance.nightSlug)}&qty=${recipient.partySize}`
  const unsub = reopenUnsubscribeUrl(recipient.unsubscribeToken)
  const when = longEventDate(instance.eventDate)
  const hello = recipient.name ? `Hi ${escapeHTML(recipient.name)},` : 'Hi,'
  const intro = a.intro?.trim() || `Good news — seats have opened up for ${instance.nightName} on ${when}. You asked us to let you know.`
  const line = reopenSummary(instance)
  const fine = 'This is not a reservation. Seats go to whoever books first, at the normal price, through our website.'
  const why = `You're getting this one email because you joined the waitlist for ${instance.nightName} on ${when} on bkkclubcrawl.com. We don't use that list for anything else.`

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${escapeHTML(a.subject)}</title></head>
<body style="margin:0;padding:0;background:#1A0015;font-family:Inter,Arial,sans-serif;color:#FFFFFF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1A0015;"><tr><td align="center" style="padding:36px 18px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding-bottom:20px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#EA003A;">Bangkok Club Crawl · Waitlist</td></tr>
  <tr><td style="background:#2F002F;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${hello}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHTML(intro)}</p>
    <p style="margin:0 0 24px;padding:10px 14px;border-left:3px solid #EA003A;background:rgba(255,255,255,0.04);font-size:14px;line-height:1.5;">${escapeHTML(line)}</p>
    <a href="${bookUrl}" style="display:inline-block;background:#EA003A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:9999px;">Book for ${recipient.partySize}</a>
    <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;">${escapeHTML(fine)}</p>
  </td></tr>
  <tr><td style="padding-top:20px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;">
    ${escapeHTML(why)}<br>
    <a href="${unsub}" style="color:rgba(255,255,255,0.7);">Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>`

  const text = [recipient.name ? `Hi ${recipient.name},` : 'Hi,', '', intro, '', line, '', `Book for ${recipient.partySize}: ${bookUrl}`, fine, '', why, `Unsubscribe: ${unsub}`].join('\n')

  return {
    subject: a.subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${reopenOneClickUnsubscribeUrl(recipient.unsubscribeToken)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
