import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getServiceSupabase } from '@/lib/supabase'
import { buildMissionControl } from '@/lib/missionControl'
import { sendEmail } from '@/lib/sendEmail'
import { escapeHtml } from '@/lib/hostReports'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// 9 AM Bangkok (pg_cron): the Mission Control to-do list by email, only on
// days when something is waiting. Auth: Bearer OPS_CRON_SECRET.
function authorized(req: NextRequest): boolean {
  const secret = process.env.OPS_CRON_SECRET
  if (!secret || secret.length < 24) return false
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

const DOT: Record<string, string> = { red: '🔴', orange: '🟠', yellow: '🟡', blue: '🔵' }

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const mc = await buildMissionControl(getServiceSupabase())
  if (!mc.todo.length) return NextResponse.json({ sent: false, items: 0 })
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6">
    <p><strong>Good morning! ${mc.todo.length} thing${mc.todo.length === 1 ? '' : 's'} waiting for you:</strong></p>
    ${mc.todo.map((t) => `<p style="margin:6px 0">${DOT[t.level]} <a href="${base}${t.href}">${escapeHtml(t.title)}</a>${t.detail ? `<br><span style="color:#666">${escapeHtml(t.detail)}</span>` : ''}</p>`).join('')}
    <p><a href="${base}/dashboard">Open Mission Control →</a></p></div>`
  const { error } = await sendEmail({ from: `BCC Bookings <${process.env.RESEND_FROM}>`, to: process.env.ADMIN_NOTIFY_EMAIL!, subject: `☀️ ${mc.todo.length} to do today — BCC Mission Control`, html })
  if (error) return NextResponse.json({ error: 'email failed' }, { status: 502 })
  return NextResponse.json({ sent: true, items: mc.todo.length })
}
