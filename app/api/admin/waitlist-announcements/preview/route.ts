import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { escapeHTML } from '@/lib/bnt/leads'
import { buildAnnouncementEmail, verifyAnnouncementDates, type AnnouncementRecord } from '@/lib/bnt/announcements'
import { buildReopenEmail, verifyReopen, type ReopenAnnouncement } from '@/lib/waitlist/reopen'

export const dynamic = 'force-dynamic'

const PLACEHOLDER_TOKEN = '00000000-0000-0000-0000-000000000000'

// HTML preview of an announcement exactly as a subscriber would get it
// (with a placeholder unsubscribe link). Shows a warning instead if the
// draft no longer matches the database (dates/price changed, date not
// bookable, no seats left).
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const id = req.nextUrl.searchParams.get('id') || ''
  const supabase = getServiceSupabase()
  const { data } = await supabase.from('bnt_waitlist_announcements').select('*').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const warn = (msg: string) =>
    new NextResponse(`<p style="font-family:sans-serif;color:#b00;padding:16px">${escapeHTML(msg)}</p>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })

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
