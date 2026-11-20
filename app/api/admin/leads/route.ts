import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { recordAlert, sendLeadAlert, type LeadTable } from '@/lib/bnt/leads'
import { buildContactAlert, buildInquiryAlert, buildWaitlistAlert } from '@/lib/bnt/leadEmails'
import { WAITLIST_PRODUCTS } from '@/lib/bnt/waitlist'
import { loadOpenDates } from '@/lib/bnt/announcements'

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
    supabase.from('bnt_waitlist').select('id, product_slug, email, name, source, consent_scope, consent_text, consented_at, created_at, notified_at, unsubscribed_at, alert_status, alert_error').order('created_at', { ascending: false }),
    supabase.from('bnt_waitlist_announcements').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('bnt_waitlist_deliveries').select('announcement_id, status'),
  ])
  const firstError = [inquiries, contacts, waitlist, announcements, deliveries].find((r) => r.error)?.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const counts: Record<string, { sent: number; failed: number; pending: number }> = {}
  for (const d of deliveries.data || []) {
    const c = (counts[d.announcement_id] ||= { sent: 0, failed: 0, pending: 0 })
    c[d.status as 'sent' | 'failed' | 'pending']++
  }

  const products = await Promise.all(
    Object.values(WAITLIST_PRODUCTS).map(async (p) => ({
      slug: p.slug,
      name: p.name,
      openDates: await loadOpenDates(supabase, p.slug),
    }))
  )

  return NextResponse.json({
    adminEmail: auth.admin.email,
    inquiries: inquiries.data,
    contacts: contacts.data,
    waitlist: waitlist.data,
    announcements: (announcements.data || []).map((a) => ({ ...a, deliveries: counts[a.id] || { sent: 0, failed: 0, pending: 0 } })),
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
  }
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
