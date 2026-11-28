import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { DEVICE_COOKIE, deviceHash, newDeviceToken, pageState, submitJoin } from '@/lib/nightJoin'

export const dynamic = 'force-dynamic'

// /night page data for this phone (lib/nightJoin.ts).
// GET  → { state: 'form' | 'saved' | 'checking' | 'join', … }
// POST { name, email, code, phone, date } → saves and matches, returns the new state.
export async function GET(req: NextRequest) {
  const s = await pageState(getServiceSupabase(), deviceHash(req.cookies?.get(DEVICE_COOKIE)?.value))
  return NextResponse.json(s, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  let token = req.cookies?.get(DEVICE_COOKIE)?.value ?? null
  if (!deviceHash(token)) token = newDeviceToken()
  const r = await submitJoin(getServiceSupabase(), body, deviceHash(token)!)
  const res = NextResponse.json(r.status === 200 ? r.body : { error: r.error }, { status: r.status })
  res.cookies.set({ name: DEVICE_COOKIE, value: token!, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 400 })
  return res
}
