import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { normalizeEmail, sessionCookie, verifyCode } from '@/lib/guestAuth'

export const dynamic = 'force-dynamic'

// POST { email, code } → signs the guest in for 30 days (httpOnly cookie).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })
  const r = await verifyCode(getServiceSupabase(), email, String(body.code ?? ''))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookie(r.token, r.expires))
  return res
}
