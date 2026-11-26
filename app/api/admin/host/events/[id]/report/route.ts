import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { loadDoorGuests } from '@/lib/doorList'
import { bangkokToday, formatEventDateLong } from '@/lib/dates'
import { sendEmail } from '@/lib/sendEmail'
import { INCIDENT_TYPES, blankReport, canWorkNight, cleanReport, escapeHtml, routeVenues, submitProblems, type ReportBody } from '@/lib/hostReports'

export const dynamic = 'force-dynamic'

// The host's after-event report for one night (Nov 2026).
//   GET  → the saved report, or a blank one pre-filled with the guest list and route
//   PUT  → save a draft (allowed from the night itself onwards, until submitted)
//   POST → submit (locks it for the host; emails the owner if there are incidents)

async function context(id: string, admin: any) {
  const db = getServiceSupabase()
  const { data: event, error } = await db.from('event_dates').select('id, event_date, night_name, night_slug, host_assigned, venue_route').eq('id', id).maybeSingle()
  if (error) return { res: NextResponse.json({ error: 'Failed to load event' }, { status: 500 }) }
  if (!event) return { res: NextResponse.json({ error: 'Event not found' }, { status: 404 }) }
  const ev = event as any
  if (!canWorkNight(admin, ev.host_assigned)) return { res: NextResponse.json({ error: 'Not your assigned event' }, { status: 403 }) }
  const [{ guests, error: gErr }, { data: report, error: rErr }] = await Promise.all([
    loadDoorGuests(db, ev.event_date, ev.night_slug),
    db.from('host_reports').select('*').eq('event_id', ev.id).maybeSingle(),
  ])
  if (gErr || rErr) return { res: NextResponse.json({ error: 'Failed to load the report' }, { status: 500 }) }
  return { db, ev, guests, report: report as any, venues: routeVenues(ev.venue_route) }
}

const allVenues = (route: string[], report: any) => Array.from(new Set([...route, ...((report?.venues ?? []) as any[]).map((v) => String(v.venue))]))

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const c = await context(params.id, auth.admin)
  if ('res' in c) return c.res
  const body: ReportBody = c.report ? cleanReport(c.report, c.guests, allVenues(c.venues, c.report)) : blankReport(c.guests, c.venues)
  return NextResponse.json({
    status: c.report?.status ?? 'none',
    submittedAt: c.report?.submitted_at ?? null,
    hostName: c.report?.host_name ?? null,
    canEdit: c.ev.event_date <= bangkokToday() && c.report?.status !== 'submitted',
    report: body,
  })
}

async function save(req: NextRequest, params: { id: string }, submit: boolean) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response
  const c = await context(params.id, auth.admin)
  if ('res' in c) return c.res
  if (c.ev.event_date > bangkokToday()) return NextResponse.json({ error: 'The report opens on the night itself.' }, { status: 409 })
  if (c.report?.status === 'submitted') return NextResponse.json({ error: 'This report was already submitted.' }, { status: 409 })
  const input = await req.json().catch(() => ({}))
  const body = cleanReport(input, c.guests, allVenues(c.venues, c.report))
  if (submit) {
    const problems = submitProblems(body)
    if (problems.length) return NextResponse.json({ error: problems.join(' ') }, { status: 400 })
  }
  const now = new Date().toISOString()
  const row = {
    event_id: c.ev.id, host_user_id: auth.admin.userId, host_name: auth.admin.displayName ?? auth.admin.email ?? 'Host',
    vibe: body.vibe, guests: body.guests, venues: body.venues, incidents: body.incidents, updated_at: now,
    ...(submit ? { status: 'submitted', submitted_at: now } : {}),
  }
  const res = c.report
    ? await c.db.from('host_reports').update(row).eq('id', c.report.id).eq('status', 'draft').select('id')
    : await c.db.from('host_reports').insert(row).select('id')
  if (res.error?.code === '23505') return NextResponse.json({ error: 'Someone else just started this report. Reload the page.' }, { status: 409 })
  if (res.error) {
    console.error('host report save error:', res.error)
    return NextResponse.json({ error: 'Could not save the report. Try again.' }, { status: 500 })
  }
  if (!res.data || !res.data.length) return NextResponse.json({ error: 'This report was already submitted.' }, { status: 409 })
  const reportId = (res.data[0] as any).id

  if (submit && body.incidents.length) {
    const label = (k: string) => INCIDENT_TYPES.find((t) => t.key === k)?.label ?? k
    const br = (s: string) => escapeHtml(s).replace(/\n/g, '<br>')
    const html = `<p><strong>${escapeHtml(row.host_name)}</strong> reported ${body.incidents.length} incident(s) on <strong>${escapeHtml(c.ev.night_name)}</strong>, ${escapeHtml(formatEventDateLong(c.ev.event_date))}.</p>` +
      body.incidents.map((i) => `<p><strong>${escapeHtml(label(i.type))}</strong><br>What happened: ${br(i.what)}${i.action ? `<br>What was done: ${br(i.action)}` : ''}</p>`).join('') +
      `<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/reports/${c.ev.id}">Open the report →</a></p>`
    const { error: mailErr } = await sendEmail({
      from: `BCC Bookings <${process.env.RESEND_FROM}>`,
      to: process.env.ADMIN_NOTIFY_EMAIL!,
      subject: `⚠ Incident reported: ${c.ev.night_name} — ${formatEventDateLong(c.ev.event_date)}`,
      html,
    })
    if (mailErr) console.error('incident email failed', mailErr)
    else await c.db.from('host_reports').update({ incident_alert_sent_at: new Date().toISOString() }).eq('id', reportId)
  }
  return NextResponse.json({ ok: true, status: submit ? 'submitted' : 'draft' })
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  return save(req, ctx.params, false)
}
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  return save(req, ctx.params, true)
}
