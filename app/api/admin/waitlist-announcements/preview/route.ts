import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { escapeHTML } from '@/lib/bnt/leads'
import { buildAnnouncementEmail, loadOpenDates, verifyAnnouncementDates, type AnnouncementRecord } from '@/lib/bnt/announcements'
import { buildReopenEmail, defaultReopenSubject, reopenSummary, seatCap, verifyReopen, type ReopenAnnouncement } from '@/lib/waitlist/reopen'
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { loadBccInstance } from '@/lib/waitlist/bccInstances'
import { MAX_PARTY_SIZE } from '@/lib/waitlist/soldOut'

export const dynamic = 'force-dynamic'

const PLACEHOLDER_TOKEN = '00000000-0000-0000-0000-000000000000'

// HTML preview of an announcement exactly as a subscriber would get it
// (with a placeholder unsubscribe link). Shows a warning instead if the
// draft no longer matches the database (dates/price changed, date not
// bookable, no seats left).
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const q = req.nextUrl.searchParams
  const id = q.get('id') || ''
  const supabase = getServiceSupabase()
  const warn = (msg: string) =>
    new NextResponse(`<p style="font-family:sans-serif;color:#b00;padding:16px">${escapeHTML(msg)}</p>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  const html = (body: string) => new NextResponse(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

  // Phase 3B: preview straight from the dashboard card's settings, before
  // any record exists (nothing is saved or sent here).
  if (!id && q.get('eventDateId')) {
    const instance = await loadBccInstance(supabase, q.get('eventDateId') || '')
    if (!instance) return warn('Date not found.')
    if (instance.state !== 'bookable') return warn(`This date isn't bookable right now (${instance.state.replace('_', ' ')}).`)
    const cap = seatCap(Math.max(1, Number(q.get('maxPartySize')) || MAX_PARTY_SIZE), instance.remaining)
    const subject = (q.get('subject') || '').trim().slice(0, 150) || defaultReopenSubject(instance)
    const ann = { subject, intro: (q.get('intro') || '').trim().slice(0, 1500) || null, product_slug: BCC_PRODUCT_SLUG, dates_summary: reopenSummary(instance) }
    return html(buildReopenEmail(ann, instance, { name: 'Alex', partySize: Math.max(1, Math.min(2, cap)), unsubscribeToken: PLACEHOLDER_TOKEN }).html)
  }
  if (!id && q.get('productSlug')) {
    const ids = (q.get('eventDateIds') || '').split(',').filter(Boolean)
    const open = await loadOpenDates(supabase, q.get('productSlug') || '')
    const dates = open.filter((d) => ids.includes(d.id))
    if (!dates.length) return warn('Choose at least one open, bookable date.')
    const ann = { subject: (q.get('subject') || '').trim().slice(0, 150) || 'New dates', intro: (q.get('intro') || '').trim() || null, product_slug: q.get('productSlug') || '' }
    return html(buildAnnouncementEmail(ann, dates, { name: 'Alex', unsubscribeToken: PLACEHOLDER_TOKEN }).html)
  }

  const { data } = await supabase.from('bnt_waitlist_announcements').select('*').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (data.kind === 'sold_out_reopen') {
    const ann = data as ReopenAnnouncement
    const check = await verifyReopen(supabase, ann)
    if (!check.ok) return warn(ann.status === 'sent' ? `Sent. Current state: ${check.error}` : check.error)
    const email = buildReopenEmail(ann, check.instance, { name: 'Alex', partySize: Math.min(2, check.cap), unsubscribeToken: PLACEHOLDER_TOKEN })
    return new NextResponse(email.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const ann = data as AnnouncementRecord
  const check = await verifyAnnouncementDates(supabase, ann)
  if (!check.ok && ann.status !== 'sent') return warn(check.error)
  const dates = check.ok ? check.dates : []
  const email = buildAnnouncementEmail(ann, dates, { name: 'Alex', unsubscribeToken: PLACEHOLDER_TOKEN })
  return new NextResponse(email.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
