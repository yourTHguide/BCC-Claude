import type { SupabaseClient } from '@supabase/supabase-js'
import { escapeHTML } from '@/lib/bnt/leads'
import { BEST_ORIGIN, WAITLIST_PRODUCTS, oneClickUnsubscribeUrl, unsubscribeUrl, type WaitlistProduct } from '@/lib/bnt/waitlist'
import { bangkokToday } from '@/lib/dates'
import { classifyInstance, seatKey, seatsTaken } from '@/lib/bookingAvailability'

// Waitlist announcements (Phase 3 finalization, Nov 2026).
//
// Workflow, all from /dashboard/leads, owner/admin only:
//   1. Draft: pick dates that ALREADY exist and are open in event_dates for
//      this product. Nothing is invented; price/time come from the database.
//   2. Preview + "send test to me" (goes only to the logged-in admin).
//   3. Approve & send: an explicit confirmation that dates, price and booking
//      are correct. Only then do subscribers receive it.
// Creating or opening an event date never sends anything by itself.

export interface AnnouncementDate {
  id: string
  date: string // YYYY-MM-DD
  startTime: string | null // HH:MM
  priceThb: number | null
  remaining?: number | null
}

export interface AnnouncementRecord {
  id: string
  product_slug: string
  event_date_ids: string[]
  dates_summary: string
  subject: string
  intro: string | null
  status: 'draft' | 'sending' | 'sent' | 'cancelled'
}

// Genuinely bookable, future dates for a waitlist product, straight from the
// database. Phase 3B: "open" now means exactly what checkout accepts on the
// BEST storefront — product active AND visible on bestnightlifethailand.com,
// date open, not cancelled, not past its cutoff, priced, and not full. So New
// in Bangkok stays paused (nothing can be announced) until it has real,
// published, bookable dates; a Draft product or a full date never qualifies.
export async function loadOpenDates(supabase: SupabaseClient, productSlug: string): Promise<AnnouncementDate[]> {
  const { data: product } = await supabase
    .from('products')
    .select('id, slug, default_price, default_start_time, status, visible_bnt')
    .eq('slug', productSlug)
    .maybeSingle()
  if (!product) return []
  const { data } = await supabase
    .from('event_dates')
    .select('id, event_date, night_slug, is_open, price_override, start_time_override, capacity, operation_verdict')
    .eq('product_id', product.id)
    .eq('is_open', true)
    .gte('event_date', bangkokToday())
    .order('event_date', { ascending: true })
    .limit(30)
  const rows = (data || []) as any[]
  const capped = rows.filter((r) => r.capacity != null)
  const taken = capped.length ? await seatsTaken(supabase, capped) : new Map<string, number>()
  return rows.flatMap((e) => {
    const startTime = e.start_time_override || product.default_start_time || null
    const price = e.price_override ?? product.default_price ?? null
    const { state, remaining } = classifyInstance({
      eventDate: e.event_date,
      isOpen: e.is_open,
      operationVerdict: e.operation_verdict,
      capacity: e.capacity,
      taken: taken.get(seatKey(e)) ?? 0,
      productSlug: product.slug,
      productStatus: product.status,
      visible: product.visible_bnt,
      startTime,
      price,
    })
    if (state !== 'bookable') return []
    return [{
      id: e.id,
      date: e.event_date,
      startTime: startTime ? String(startTime).slice(0, 5) : null,
      priceThb: price,
      remaining,
    }]
  })
}

export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function timeLabel(hhmm: string | null): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

export function dateLine(d: AnnouncementDate): string {
  return [longDate(d.date), timeLabel(d.startTime), d.priceThb != null ? `฿${Number(d.priceThb).toLocaleString('en-US')}` : '']
    .filter(Boolean)
    .join(' · ')
}

export function summarizeDates(dates: AnnouncementDate[]): string {
  return dates.map(dateLine).join('\n')
}

// Re-checks a draft's dates at send time. Returns the current dates, or an
// error if any chosen date is no longer open, has passed, or its time/price
// changed since the draft was written (the summary would then be wrong).
export async function verifyAnnouncementDates(
  supabase: SupabaseClient,
  a: AnnouncementRecord
): Promise<{ ok: true; dates: AnnouncementDate[] } | { ok: false; error: string }> {
  const open = await loadOpenDates(supabase, a.product_slug)
  const byId = new Map(open.map((d) => [d.id, d]))
  const dates: AnnouncementDate[] = []
  for (const id of a.event_date_ids) {
    const d = byId.get(id)
    if (!d) return { ok: false, error: 'One of the dates in this announcement is no longer open (or has passed). Cancel it and create a new draft.' }
    dates.push(d)
  }
  if (dates.length === 0) return { ok: false, error: 'This announcement has no dates.' }
  if (summarizeDates(dates) !== a.dates_summary) {
    return { ok: false, error: 'A date, time or price changed since this draft was written. Cancel it and create a new draft so the email is correct.' }
  }
  return { ok: true, dates }
}

export function productFor(slug: string): WaitlistProduct | null {
  return WAITLIST_PRODUCTS[slug] ?? null
}

export interface BuiltAnnouncement {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

export function buildAnnouncementEmail(
  a: Pick<AnnouncementRecord, 'subject' | 'intro' | 'product_slug'>,
  dates: AnnouncementDate[],
  recipient: { name?: string | null; unsubscribeToken: string }
): BuiltAnnouncement {
  const product = productFor(a.product_slug)
  const productName = product?.name ?? a.product_slug
  const pageUrl = `${BEST_ORIGIN}${product?.path ?? '/'}`
  const unsub = unsubscribeUrl(recipient.unsubscribeToken)
  const hello = recipient.name ? `Hi ${escapeHTML(recipient.name)},` : 'Hi,'
  const intro = a.intro?.trim() || `New ${productName} dates are open.`

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${escapeHTML(a.subject)}</title></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:Inter,Arial,sans-serif;color:#FFFFFF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0D;"><tr><td align="center" style="padding:36px 18px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding-bottom:20px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#EA003A;">BEST Nightlife Thailand · ${escapeHTML(productName)}</td></tr>
  <tr><td style="background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;">
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${hello}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHTML(intro)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${dates.map((d) => `<tr><td style="padding:10px 14px;border-left:3px solid #EA003A;background:rgba(255,255,255,0.04);font-size:14px;line-height:1.5;">${escapeHTML(dateLine(d))}</td></tr><tr><td style="height:8px;"></td></tr>`).join('')}
    </table>
    <a href="${pageUrl}" style="display:inline-block;background:#EA003A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:9999px;">See dates &amp; book</a>
    <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;">Places are limited and confirmed when you book on our website.</p>
  </td></tr>
  <tr><td style="padding-top:20px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.6;">
    You&rsquo;re getting this because you asked to hear about new ${escapeHTML(productName)} dates on bestnightlifethailand.com. We don&rsquo;t use this list for anything else.<br>
    <a href="${unsub}" style="color:rgba(255,255,255,0.7);">Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>`

  const text = [
    recipient.name ? `Hi ${recipient.name},` : 'Hi,',
    '',
    intro,
    '',
    ...dates.map((d) => `• ${dateLine(d)}`),
    '',
    `See dates & book: ${pageUrl}`,
    'Places are limited and confirmed when you book on our website.',
    '',
    `You're getting this because you asked to hear about new ${productName} dates on bestnightlifethailand.com. We don't use this list for anything else.`,
    `Unsubscribe: ${unsub}`,
  ].join('\n')

  return {
    subject: a.subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl(recipient.unsubscribeToken)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
