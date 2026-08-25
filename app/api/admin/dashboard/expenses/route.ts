import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Security migration (Phase 2A): the Day Panel's manual expense entry
// previously inserted directly with the anon key (permissive public INSERT
// policy — see PHASE4_CHECKPOINT.md's RLS audit). Same insert, now behind
// requireAdmin() + the service role.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { eventDate, nightSlug, category, description, amount } = body
  if (!eventDate || !nightSlug || !category) {
    return NextResponse.json({ error: 'eventDate, nightSlug, and category are required' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { error } = await supabase.from('expenses').insert({
    event_date: eventDate,
    night_slug: nightSlug,
    category,
    description: description || null,
    amount: Number.isFinite(Number(amount)) ? Number(amount) : 0,
  })

  if (error) {
    console.error('admin/dashboard/expenses: insert error:', error)
    return NextResponse.json({ error: 'Failed to add expense' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
