import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { recordAlert, sendLeadAlert, type LeadTable } from '@/lib/bnt/leads'
import { buildContactAlert, buildInquiryAlert, buildWaitlistAlert } from '@/lib/bnt/leadEmails'
import { WAITLIST_PRODUCTS } from '@/lib/bnt/waitlist'
import { loadOpenDates } from '@/lib/bnt/announcements'
import { BCC_PRODUCT_SLUG, bangkokNow } from '@/lib/bookingAvailability'
import { loadBccInstancesByIds } from '@/lib/waitlist/bccInstances'
import { previewInbox } from '@/lib/emailRecipients'

export const dynamic = 'force-dynamic'

// /dashboard/leads backend (Phase 3 finalization). Owner/admin only: these
// rows are customer personal data. Staff (host) accounts get 403.

const TABLES: LeadTable[] = ['bnt_experience_inquiries', 'bnt_contact_messages', 'bnt_waitlist']
const STATUSES = ['new', 'contacted', 'closed', 'spam']

export async function GET() {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const supabase = getServiceSupabase()

  const [inquiries, contacts, waitlist, announcements, deliveries] = await Promise.all([
    supabase.from('bnt_experience_inquiries').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('bnt_contact_messages').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('bnt_waitlist').select('id, product_slug, email, name, source, consent_scope, consent_text, consented_at, created_at, notified_at, unsubscribed_at, alert_status, alert_error, event_date_id, event_date, night_slug, party_size').order('created_at', { ascending: false }),
    supabase.from('bnt_waitlist_announcements').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('bnt_waitlist_deliveries').select('id, announcement_id, waitlist_id, status, attempted_at, attempts, error, resolved_by, resolved_at'),
  ])
  const firstError = [inquiries, contacts, waitlist, announcements, deliveries].find((r) => r.error)?.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  // pending + attempted_at = outcome unknown ("uncertain"); listed so an
  // admin can resolve it once the attempt is old enough to have ended.
  type Counts = { sent: number; failed: number; queued: number; uncertain: number; unconfirmed: number; skipped: number }
  const counts: Record<string, Counts> = {}
  const uncertain: Record<string, { id: string; waitlist_id: string; attempted_at: string; error: string | null; resolvable: boolean }[]> = {}
  // Per-person outcome of each notice, for the dashboard card (Phase 3B).
  const results: Record<string, { waitlist_id: string; status: string; error: string | null }[]> = {}
  const cutoff = Date.now() - 2 * 60 * 1000
  for (const d of deliveries.data || []) {
    ;(results[d.announcement_id] ||= []).push({ waitlist_id: d.waitlist_id, status: d.status === 'pending' && d.attempted_at ? 'uncertain' : d.status, error: d.error })
    const c = (counts[d.announcement_id] ||= { sent: 0, failed: 0, queued: 0, uncertain: 0, unconfirmed: 0, skipped: 0 })
    if (d.status === 'pending' && d.attempted_at) {
      c.uncertain++
      ;(uncertain[d.announcement_id] ||= []).push({
        id: d.id,
        waitlist_id: d.waitlist_id,
        attempted_at: d.attempted_at,
        error: d.error,
        resolvable: new Date(d.attempted_at).getTime() < cutoff,
      })
    } else if (d.status === 'pending') c.queued++
    else c[d.status as 'sent' | 'failed' | 'unconfirmed' | 'skipped']++
  }

  const products = await Promise.all(
    Object.values(WAITLIST_PRODUCTS).map(async (p) => ({
      slug: p.slug,
      name: p.name,
      openDates: await loadOpenDates(supabase, p.slug),
    }))
  )

  // Phase 3B: Bangkok Club Crawl sold-out waitlist, one entry per upcoming
  // date that has sign-ups, with the date's live state and seats left.
  const today = bangkokNow().date
  const soldOutRows = (waitlist.data || []).filter((r: any) => r.consent_scope === 'sold_out_date' && r.product_slug === BCC_PRODUCT_SLUG)
  const dateIds = Array.from(new Set(soldOutRows.filter((r: any) => r.event_date >= today).map((r: any) => r.event_date_id as string)))
  let instances: Awaited<ReturnType<typeof loadBccInstancesByIds>> = []
  try {
    instances = await loadBccInstancesByIds(supabase, dateIds)
  } catch (err) {
    console.error('leads: could not load sold-out dates', err)
  }
  const soldOutDates = instances
    .sort((x, y) => x.eventDate.localeCompare(y.eventDate))
    .map((i) => {
      const rows = soldOutRows.filter((r: any) => r.event_date_id === i.id)
      const active = rows.filter((r: any) => !r.unsubscribed_at)
      const waiting = active.filter((r: any) => !r.notified_at)
      const bySize = new Map<number, number>()
      for (const r of waiting) bySize.set(r.party_size, (bySize.get(r.party_size) ?? 0) + 1)
      return {
        eventId: i.id,
        eventDate: i.eventDate,
        nightName: i.nightName,
        state: i.state,
        capacity: i.capacity,
        taken: i.taken,
        remaining: i.remaining,
        signups: rows.length,
        active: active.length,
        waiting: waiting.length,
        seatsWanted: waiting.reduce((n: number, r: any) => n + (r.party_size ?? 0), 0),
        notified: active.length - waiting.length,
        unsubscribed: rows.length - active.length,
        bySize: Array.from(bySize.entries()).sort((x, y) => x[0] - y[0]).map(([size, count]) => ({ size, count })),
      }
    })

  // Whether this deployment can send email, for the dashboard status line.
  // Never includes the key itself.
  const email = {
    configured: !!process.env.RESEND_API_KEY,
    previewOnlyTo: process.env.VERCEL_ENV === 'preview' ? previewInbox : null,
  }

  return NextResponse.json({
    adminEmail: auth.admin.email,
    email,
    soldOutDates,
    inquiries: inquiries.data,
    contacts: contacts.data,
    waitlist: waitlist.data,
    announcements: (announcements.data || []).map((a) => ({
      ...a,
      deliveries: counts[a.id] || { sent: 0, failed: 0, queued: 0, uncertain: 0, unconfirmed: 0, skipped: 0 },
      uncertain: uncertain[a.id] || [],
      results: results[a.id] || [],
    })),
    products,
  })
}

// Update a lead's status / internal notes.
export async function PATCH(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const table = body.table as LeadTable
  if (!['bnt_experience_inquiries', 'bnt_contact_messages'].includes(table) || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'table and id are required' }, { status: 400 })
  }
  const patch: Record<string, unknown> = {}
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    patch.status = body.status
    patch.status_changed_at = new Date().toISOString()
  }
  if (typeof body.retentionHold === 'boolean') patch.retention_hold = body.retentionHold
  if (body.notes !== undefined && table === 'bnt_experience_inquiries') {
    patch.notes = typeof body.notes === 'string' ? body.notes.slice(0, 4000) || null : null
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  const { error } = await getServiceSupabase().from(table).update(patch).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// action 'retry-alert': re-send the team alert for a row whose alert failed.
// action 'unsubscribe': stop announcements for a waitlist address (keeps the row as a record).
// action 'erase': permanently delete a row (a person asked to be removed).
export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const { action, id } = body as { action?: string; id?: string }
  const table = body.table as LeadTable
  if (!TABLES.includes(table) || typeof id !== 'string') {
    return NextResponse.json({ error: 'table and id are required' }, { status: 400 })
  }
  const supabase = getServiceSupabase()

  if (action === 'retry-alert') {
    const { data: row, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
    if (error || !row) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })
    const msg =
      table === 'bnt_experience_inquiries'
        ? buildInquiryAlert(row, { retry: true })
        : table === 'bnt_contact_messages'
          ? buildContactAlert(row, { retry: true })
          : buildWaitlistAlert(row, { retry: true })
    const result = await sendLeadAlert(msg)
    await recordAlert(supabase, table, id, result)
    return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 502 })
  }

  if (action === 'unsubscribe' && table === 'bnt_waitlist') {
    const { error } = await supabase.from('bnt_waitlist').update({ unsubscribed_at: new Date().toISOString() }).eq('id', id).is('unsubscribed_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'erase') {
    // Waitlist deliveries cascade. Resend keeps its own sending log (see
    // docs/privacy/DATA_FLOW_AUDIT.md) — this removes our copy only.
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    console.log(`[leads] ${auth.admin.email ?? auth.admin.userId} erased a row from ${table}`)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
