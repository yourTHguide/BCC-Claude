import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { SESSION_COOKIE, sessionGuest } from '@/lib/guestAuth'
import { accountData } from '@/lib/account'

export const dynamic = 'force-dynamic'

// The signed-in guest's account. GET → bookings, credit, details.
// PATCH { name, phone } → update their details (email stays the sign-in key).
export async function GET(req: NextRequest) {
  const db = getServiceSupabase()
  const guest = await sessionGuest(db, req.cookies?.get(SESSION_COOKIE)?.value)
  if (!guest) return NextResponse.json({ signedIn: false }, { status: 401 })
  return NextResponse.json({ signedIn: true, ...(await accountData(db, guest)) })
}

export async function PATCH(req: NextRequest) {
  const db = getServiceSupabase()
  const guest = await sessionGuest(db, req.cookies?.get(SESSION_COOKIE)?.value)
  if (!guest) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 80)
  const phone = String(body.phone ?? '').trim().slice(0, 30)
  if (!name) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
  if (phone && !/^\+?[\d\s()-]{6,30}$/.test(phone)) return NextResponse.json({ error: 'Please check your phone number.' }, { status: 400 })
  const { error } = await db.from('guests').update({ name, phone: phone || null, updated_at: new Date().toISOString() }).eq('id', guest.id)
  if (error) return NextResponse.json({ error: 'Couldn’t save — please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
