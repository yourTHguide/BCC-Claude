import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireRole } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'
import { resendFromHeader } from '@/lib/storefrontBrand'
import { EMAIL_RE } from '@/lib/bnt/leads'
import { WAITLIST_CONSENT_SCOPE } from '@/lib/bnt/waitlist'
import {
  buildAnnouncementEmail,
  loadOpenDates,
  productFor,
  summarizeDates,
  verifyAnnouncementDates,
  type AnnouncementRecord,
} from '@/lib/bnt/announcements'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Waitlist announcements — human-approved only (Phase 3 finalization).
//   create : save a draft from dates that already exist and are open.
//   test   : send the draft to the logged-in admin only.
//   send   : requires confirmChecked=true. Sends to active subscribers of
//            that product (consent_scope 'event_dates', not unsubscribed)
//            who have no delivery row for this announcement yet. Works in
//            batches; the dashboard calls it until remaining = 0.
//   cancel : stop a draft or an unfinished send.
// One delivery row per (announcement, subscriber) — enforced by a unique
// constraint — so nobody gets the same announcement twice, even if "send"
// is clicked twice or two tabs are open.

const BATCH = 20
const PAUSE_MS = 550 // stay under Resend's default 2 requests/second

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response
  const who = auth.admin.email || auth.admin.userId
  const body = await req.json().catch(() => ({}))
  const supabase = getServiceSupabase()

  if (body.action === 'create') {
    const product = productFor(String(body.productSlug || ''))
    if (!product) return NextResponse.json({ error: 'Unknown waitlist' }, { status: 400 })
    const ids: string[] = Array.isArray(body.eventDateIds) ? body.eventDateIds.filter((x: unknown) => typeof x === 'string') : []
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 150) : ''
    const intro = typeof body.intro === 'string' ? body.intro.trim().slice(0, 1500) : ''
    if (!ids.length) return NextResponse.json({ error: 'Choose at least one open date.' }, { status: 400 })
    if (!subject) return NextResponse.json({ error: 'Add a subject line.' }, { status: 400 })
    const open = await loadOpenDates(supabase, product.slug)
    const chosen = open.filter((d) => ids.includes(d.id))
    if (chosen.length !== ids.length) {
      return NextResponse.json({ error: 'Only open, upcoming dates can be announced. Refresh and try again.' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('bnt_waitlist_announcements')
      .insert({
        product_slug: product.slug,
        event_date_ids: chosen.map((d) => d.id),
        dates_summary: summarizeDates(chosen),
        subject,
        intro: intro || null,
        status: 'draft',
        created_by: who,
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  const { data: a, error: loadError } = await supabase.from('bnt_waitlist_announcements').select('*').eq('id', id).maybeSingle()
  if (loadError || !a) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
  const ann = a as AnnouncementRecord

  if (body.action === 'cancel') {
    if (ann.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })
    await supabase.from('bnt_waitlist_announcements').update({ status: 'cancelled' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'retry-failed') {
    // Clears failed delivery rows so the next "send" retries only those
    // subscribers. Sent rows are untouched, so nobody gets a second copy.
    if (ann.status === 'cancelled') return NextResponse.json({ error: 'This announcement is cancelled.' }, { status: 400 })
    const { data: cleared, error } = await supabase
      .from('bnt_waitlist_deliveries')
      .delete()
      .eq('announcement_id', id)
      .eq('status', 'failed')
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (cleared?.length) await supabase.from('bnt_waitlist_announcements').update({ status: 'sending', completed_at: null }).eq('id', id)
    return NextResponse.json({ ok: true, cleared: cleared?.length ?? 0 })
  }

  if (ann.status === 'cancelled' || ann.status === 'sent') {
    return NextResponse.json({ error: `This announcement is ${ann.status}.` }, { status: 400 })
  }

  const check = await verifyAnnouncementDates(supabase, ann)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 409 })
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  if (!resend) return NextResponse.json({ error: 'Email is not configured on this deployment (RESEND_API_KEY).' }, { status: 503 })
  const from = resendFromHeader('bnt')

  if (body.action === 'test') {
    if (!auth.admin.email) return NextResponse.json({ error: 'Your admin account has no email address' }, { status: 400 })
    const email = buildAnnouncementEmail(ann, check.dates, { name: null, unsubscribeToken: '00000000-0000-0000-0000-000000000000' })
    const { error } = await resend.emails.send({
      from,
      to: auth.admin.email,
      subject: `[TEST] ${email.subject}`,
      html: email.html,
      text: email.text,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })
    return NextResponse.json({ ok: true, sentTo: auth.admin.email })
  }

  if (body.action !== 'send') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  if (body.confirmChecked !== true) {
    return NextResponse.json({ error: 'Confirm that dates, price and booking availability are correct before sending.' }, { status: 400 })
  }

  if (ann.status === 'draft') {
    // Approval is recorded once, on the first batch.
    const { error } = await supabase
      .from('bnt_waitlist_announcements')
      .update({ status: 'sending', approved_by: who, approved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'draft')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Everyone eligible who has no delivery row yet for this announcement.
  const [{ data: subs, error: subsError }, { data: done }] = await Promise.all([
    supabase
      .from('bnt_waitlist')
      .select('id, email, name, unsubscribe_token')
      .eq('product_slug', ann.product_slug)
      .eq('consent_scope', WAITLIST_CONSENT_SCOPE)
      .is('unsubscribed_at', null)
      .order('created_at', { ascending: true }),
    supabase.from('bnt_waitlist_deliveries').select('waitlist_id').eq('announcement_id', id),
  ])
  if (subsError) return NextResponse.json({ error: subsError.message }, { status: 500 })
  const already = new Set((done || []).map((d) => d.waitlist_id))
  const todo = (subs || []).filter((s) => !already.has(s.id))
  const batch = todo.slice(0, BATCH)

  let sent = 0
  let failed = 0
  for (const s of batch) {
    // Claim the (announcement, subscriber) pair first. If another request
    // already claimed it, the unique constraint rejects this insert: skip.
    const { data: claim, error: claimError } = await supabase
      .from('bnt_waitlist_deliveries')
      .insert({ announcement_id: id, waitlist_id: s.id, status: 'pending' })
      .select('id')
      .single()
    if (claimError || !claim) continue

    if (!EMAIL_RE.test(s.email)) {
      await supabase.from('bnt_waitlist_deliveries').update({ status: 'failed', error: 'invalid email' }).eq('id', claim.id)
      failed++
      continue
    }
    const email = buildAnnouncementEmail(ann, check.dates, { name: s.name, unsubscribeToken: s.unsubscribe_token })
    const { data: res, error } = await resend.emails.send({
      from,
      to: s.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
    })
    const now = new Date().toISOString()
    if (error) {
      await supabase.from('bnt_waitlist_deliveries').update({ status: 'failed', error: String(error.message).slice(0, 300) }).eq('id', claim.id)
      failed++
    } else {
      await supabase.from('bnt_waitlist_deliveries').update({ status: 'sent', sent_at: now, resend_id: res?.id ?? null }).eq('id', claim.id)
      await supabase.from('bnt_waitlist').update({ notified_at: now }).eq('id', s.id)
      sent++
    }
    await sleep(PAUSE_MS)
  }

  const remaining = Math.max(0, todo.length - batch.length)
  if (remaining === 0) {
    await supabase.from('bnt_waitlist_announcements').update({ status: 'sent', completed_at: new Date().toISOString() }).eq('id', id)
  }
  return NextResponse.json({ ok: true, sent, failed, remaining })
}
