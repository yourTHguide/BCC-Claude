import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { endSession, SESSION_COOKIE } from '@/lib/guestAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  await endSession(getServiceSupabase(), req.cookies?.get(SESSION_COOKIE)?.value)
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: SESSION_COOKIE, value: '', path: '/', expires: new Date(0) })
  return res
}
