import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, requireRole } from '@/lib/admin-auth'
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

// Edit an existing expense from the Day Panel. Owner/admin only.
export async function PATCH(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, category, description, amount } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const patch: Record<string, any> = {}
  if (category !== undefined) {
    if (!category) return NextResponse.json({ error: 'category cannot be empty' }, { status: 400 })
    patch.category = category
  }
  if (description !== undefined) patch.description = description || null
  if (amount !== undefined) patch.amount = Number.isFinite(Number(amount)) ? Number(amount) : 0
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = getServiceSupabase()
  const { data, error } = await supabase.from('expenses').update(patch).eq('id', id).select('id').maybeSingle()
  if (error) {
    console.error('admin/dashboard/expenses: update error:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

// Delete an expense from the Day Panel. Owner/admin only, matching
// /api/delete-ota-booking.
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body?.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = getServiceSupabase()
  const { error } = await supabase.from('expenses').delete().eq('id', body.id)
  if (error) {
    console.error('admin/dashboard/expenses: delete error:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
