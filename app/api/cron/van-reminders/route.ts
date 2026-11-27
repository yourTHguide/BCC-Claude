import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getServiceSupabase } from '@/lib/supabase'
import { BCC_PRODUCT_SLUG, isCancelledEvent } from '@/lib/bookingAvailability'
import { bangkokToday, formatEventDateLong } from '@/lib/dates'
import { sendEmail } from '@/lib/sendEmail'
import { loadVanNight } from '@/lib/vanData'
import { VAN_MIN } from '@/lib/vans'
import { escapeHtml } from '@/lib/hostReports'

export const dynamic = 'force-dynamic'

// Owner reminders for tonight's Club Crawl nights (Phase 3D), called by
// pg_cron (supabase/production/cron_van_reminders.sql):
//   ?kind=7pm → go / no-go summary for every night with guests
//   ?kind=8pm → only nights where van 2 has guests and is still open
// Each night is reminded once per kind. Nothing is changed automatically.
// Auth: "Authorization: Bearer <VAN_REMINDER_SECRET>" (24+ characters).

function authorized(req: NextRequest): boolean {
  const secret = process.env.VAN_REMINDER_SECRET
  if (!secret || secret.length < 24) return false
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const kind = new URL(req.url).searchParams.get('kind')
  if (kind !== '7pm' && kind !== '8pm') return NextResponse.json({ error: 'kind must be 7pm or 8pm' }, { status: 400 })
  const db = getServiceSupabase()
  const today = bangkokToday()
  const { data: product } = await db.from('products').select('id').eq('slug', BCC_PRODUCT_SLUG).maybeSingle()
  if (!product) return NextResponse.json({ sent: 0 })
  const { data: nights, error } = await db.from('event_dates').select('id, operation_verdict').eq('product_id', (product as any).id).eq('event_date', today)
  if (error) return NextResponse.json({ error: 'Could not load tonight.' }, { status: 500 })

  const lines: string[] = []
  const claimed: string[] = []
  for (const n of ((nights ?? []) as any[]).filter((x) => !isCancelledEvent(x))) {
    const d = await loadVanNight(db, n.id)
    if (!d || d.taken === 0) continue
    const s = d.status
    if (kind === '8pm' && !(s?.van2 && s.van2.guests > 0 && s.van2.state === 'open')) continue
    // Claim first so a retry never sends twice.
    const { error: cErr } = await db.from('van_reminders').insert({ event_id: n.id, kind })
    if (cErr) continue
    claimed.push(n.id)
    const ev = d.event
    const v1 = s ? s.van1 : { guests: d.taken, min: VAN_MIN[1], ok: d.taken >= VAN_MIN[1] }
    let line = `<p><strong>${escapeHtml(ev.night_name)}</strong>${ev.host_assigned ? ` · host ${escapeHtml(ev.host_assigned)}` : ''}<br>`
    line += `Van 1: ${v1.guests} guest(s) ${v1.ok ? '✓ runs' : `— needs ${v1.min} ⚠`}`
    if (s?.van2) line += `<br>Van 2: ${s.van2.guests} guest(s) ${s.van2.state === 'running' ? '✓ running' : s.van2.state === 'closed' ? '(closed)' : s.van2.ok ? '✓ enough — confirm it runs' : `— needs ${s.van2.min} ⚠`}`
    line += `<br><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard">Open the calendar →</a></p>`
    lines.push(line)
  }
  if (!lines.length) return NextResponse.json({ sent: 0 })
  const subject = kind === '7pm'
    ? `7 PM go / no-go: tonight's Club Crawl (${formatEventDateLong(today)})`
    : `8 PM reminder: decide Van 2 for tonight`
  const intro = kind === '7pm'
    ? '<p>Tonight’s numbers. Confirm the night is on, and decide Van 2 if it has guests (run it, or send the guests the refund / new-date options).</p>'
    : '<p>Van 2 still has guests and hasn’t been decided. Run it, or send its guests the refund / new-date options.</p>'
  const { error: mailErr } = await sendEmail({ from: `BCC Bookings <${process.env.RESEND_FROM}>`, to: process.env.ADMIN_NOTIFY_EMAIL!, subject, html: intro + lines.join('') })
  if (mailErr) {
    console.error('van reminder email failed', mailErr)
    for (const id of claimed) await db.from('van_reminders').delete().eq('event_id', id).eq('kind', kind)
    return NextResponse.json({ error: 'email failed' }, { status: 502 })
  }
  return NextResponse.json({ sent: lines.length })
}
