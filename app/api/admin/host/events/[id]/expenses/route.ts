import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['van', 'host_pay', 'drinks', 'cover_charge', 'extra']

// Stage 9j — lets a Host log an expense for an assigned event without going
// through the owner dashboard's anon-key client insert. event_date/
// night_slug are derived server-side from the resolved event row, never
// trusted from the client body — a Host can only ever log an expense
// against the specific event they're authorized for.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const { data: event, error: eventError } = await supabase
    .from('event_dates')
    .select('event_date, night_slug, host_assigned')
    .eq('id', params.id)
    .maybeSingle()

  if (eventError) {
    console.error('admin/host/events/[id]/expenses: event query error:', eventError)
    return NextResponse.json({ error: 'Failed to load event' }, { status: 500 })
  }
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  if (auth.admin.role === 'staff' && event.host_assigned !== auth.admin.displayName) {
    return NextResponse.json({ error: 'Not your assigned event' }, { status: 403 })
  }

  const { category, description, amount } = await req.json()
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  const parsedAmount = Number(amount)
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const { error: insertError } = await supabase.from('expenses').insert({
    event_date: event.event_date,
    night_slug: event.night_slug,
    category,
    description: description || null,
    amount: Math.round(parsedAmount),
  })

  if (insertError) {
    console.error('admin/host/events/[id]/expenses: insert error:', insertError)
    return NextResponse.json({ error: 'Failed to log expense' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
