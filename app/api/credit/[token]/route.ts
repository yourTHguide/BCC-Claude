import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { available, creditRows } from '@/lib/credit'
import { guestForCredit, SESSION_COOKIE } from '@/lib/guestAuth'

export const dynamic = 'force-dynamic'

// Public, behind the guest's personal link: how much credit they can use.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const db = getServiceSupabase()
  const g = await guestForCredit(db, params.token, req.cookies?.get(SESSION_COOKIE)?.value)
  if (!g) return NextResponse.json({ available: 0 })
  const rows = await creditRows(db, g.id)
  const now = new Date()
  return NextResponse.json({
    available: available(rows, now),
    firstName: (g.name ?? '').split(' ')[0] || null,
    expires: rows.filter((c) => Date.parse(c.expires_at) > now.getTime()).map((c) => c.expires_at.slice(0, 10))[0] ?? null,
  })
}
