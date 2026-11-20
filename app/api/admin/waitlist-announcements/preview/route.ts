import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { buildAnnouncementEmail, verifyAnnouncementDates, type AnnouncementRecord } from '@/lib/bnt/announcements'

export const dynamic = 'force-dynamic'

// HTML preview of an announcement exactly as a subscriber would get it
// (with a placeholder unsubscribe link). Shows a warning instead if the
// draft's dates no longer match the database.
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const id = req.nextUrl.searchParams.get('id') || ''
  const supabase = getServiceSupabase()
  const { data } = await supabase.from('bnt_waitlist_announcements').select('*').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ann = data as AnnouncementRecord
  const check = await verifyAnnouncementDates(supabase, ann)
  if (!check.ok && ann.status !== 'sent') {
    return new NextResponse(`<p style="font-family:sans-serif;color:#b00;padding:16px">${check.error}</p>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
  const dates = check.ok ? check.dates : []
  const email = buildAnnouncementEmail(ann, dates, { name: 'Alex', unsubscribeToken: '00000000-0000-0000-0000-000000000000' })
  return new NextResponse(email.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
