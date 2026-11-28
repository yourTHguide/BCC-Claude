import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { bangkokToday, ownerAction, ownerList } from '@/lib/nightJoin'

export const dynamic = 'force-dynamic'

// Owner: who left their WhatsApp on /night for a date, matched or waiting.
// GET ?date=YYYY-MM-DD. POST { id, action: 'match' | 'ignore' | 'sent', kind?, bookingId?, name? }
export async function GET(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const date = req.nextUrl.searchParams.get('date') ?? bangkokToday()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Bad date' }, { status: 400 })
  return NextResponse.json(await ownerList(getServiceSupabase(), date))
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  if (!['match', 'ignore', 'sent'].includes(body.action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  const r = await ownerAction(getServiceSupabase(), { id: String(body.id ?? ''), action: body.action, kind: body.kind, bookingId: body.bookingId, name: body.name })
  return NextResponse.json(r.status === 200 ? { ok: true } : { error: (r as any).error }, { status: r.status })
}
