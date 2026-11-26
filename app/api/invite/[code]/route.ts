import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { INVITE_PROBLEM_TEXT, inviteProblem, loadInvite } from '@/lib/hostInvites'

export const dynamic = 'force-dynamic'

// Public: what the booking page needs to greet an invited guest. Only the
// host's first name, the night and whether the link still works — never the
// guest's details.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const db = getServiceSupabase()
  try {
    const inv = await loadInvite(db, params.code)
    const problem = inviteProblem(inv, null)
    if (!inv || problem) return NextResponse.json({ valid: false, message: INVITE_PROBLEM_TEXT[problem ?? 'not_found'] })
    const { data: ev } = await db.from('event_dates').select('id, event_date, night_name').eq('id', inv.event_id).maybeSingle()
    return NextResponse.json({ valid: true, hostName: inv.host_name, eventId: inv.event_id, eventDate: (ev as any)?.event_date ?? null, nightName: (ev as any)?.night_name ?? null })
  } catch {
    return NextResponse.json({ valid: false, message: 'Could not check this invite right now.' }, { status: 503 })
  }
}
