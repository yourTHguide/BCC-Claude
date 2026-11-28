import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { SESSION_COOKIE, sessionGuest } from '@/lib/guestAuth'
import { guestMoveOptions, requestChange } from '@/lib/selfService'

export const dynamic = 'force-dynamic'

// The signed-in guest changes one of their bookings (lib/selfService.ts).
// GET  → whether it's instant (7+ days) or a request, credit value, nights to move to
// POST { kind: 'move' | 'credit', targetEventId?, note? }
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServiceSupabase()
  const guest = await sessionGuest(db, req.cookies?.get(SESSION_COOKIE)?.value)
  if (!guest) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const r = await guestMoveOptions(db, guest, params.id)
  return NextResponse.json(r.body, { status: r.status })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServiceSupabase()
  const guest = await sessionGuest(db, req.cookies?.get(SESSION_COOKIE)?.value)
  if (!guest) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const r = await requestChange(db, guest, { bookingId: params.id, kind: body.kind, targetEventId: body.targetEventId ?? null, note: body.note ?? null })
  return NextResponse.json(r.body, { status: r.status })
}
