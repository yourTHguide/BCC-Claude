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
//   create            : save a draft from dates that already exist and are open.
//   test              : send the draft to the logged-in admin only.
//   send              : requires confirmChecked=true. Claims one delivery row per
//                       eligible subscriber (this product, consent scope
//                       'event_dates', not unsubscribed), then attempts queued
//                       rows in batches; the dashboard calls it until done.
//   retry-failed      : re-queue rows Resend definitely rejected.
//   resolve-uncertain : decide rows whose outcome is unknown (see below).
//   cancel            : stop a draft or an unfinished send.
//
// Delivery states: pending (queued) -> attempted_at set atomically -> sent |
// failed (definite rejection, safe to retry) | still pending with
// attempted_at = uncertain (timeout, interrupted request: Resend may have
// accepted it). Uncertain rows are never re-sent automatically. An admin
// either leaves them ('unconfirmed', never re-sent) or, after checking
// Resend's log (each message is tagged delivery_id), explicitly re-queues.
// The unique (announcement, subscriber) constraint plus the atomic attempt
// claim mean double clicks or parallel tabs cannot send twice.

const BATCH = 20
const PAUSE_MS = 550 // stay under Resend's default 2 requests/second
// A delivery attempted longer ago than this with no recorded outcome is
// treated as uncertain (the request that made it has certainly ended).
const UNCERTAIN_AFTER_MS = 2 * 60 * 1000

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
    // 'failed' rows were definitely rejected by Resend (never accepted), so
    // re-queueing them cannot duplicate. Uncertain rows are NOT touched here.
    const { data: requeued, error } = await supabase
      .from('bnt_waitlist_deliveries')
      .update({ status: 'pending', attempted_at: null, error: null })
      .eq('announcement_id', id)
      .eq('status', 'failed')
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (requeued?.length) await supabase.from('bnt_waitlist_announcements').update({ status: 'sending', completed_at: null }).eq('id', id)
    return NextResponse.json({ ok: true, requeued: requeued?.length ?? 0 })
  }

  if (body.action === 'resolve-uncertain') {
    // For deliveries whose outcome is unknown (attempted, no answer recorded).
    //   'leave'  -> mark 'unconfirmed'; never sent again. Safe default.
    //   'resend' -> re-queue. May produce a duplicate if Resend did accept the
    //               first attempt; the admin must check Resend's log first.
    const resolution = body.resolution === 'resend' ? 'resend' : body.resolution === 'leave' ? 'leave' : null
    const ids: string[] = Array.isArray(body.deliveryIds) ? body.deliveryIds.filter((x: unknown) => typeof x === 'string') : []
    if (!resolution || !ids.length) return NextResponse.json({ error: 'resolution and deliveryIds are required' }, { status: 400 })
    if (resolution === 'resend' && body.confirmChecked !== true) {
      return NextResponse.json({ error: 'Confirm you checked the Resend log before re-sending.' }, { status: 400 })
    }
    const cutoff = new Date(Date.now() - UNCERTAIN_AFTER_MS).toISOString()
    const { data: rows, error } = await supabase
      .from('bnt_waitlist_deliveries')
      .update(
        resolution === 'leave'
          ? { status: 'unconfirmed', resolved_by: who, resolved_at: new Date().toISOString() }
          : { status: 'pending', attempted_at: null, resolved_by: who, resolved_at: new Date().toISOString() }
      )
      .eq('announcement_id', id)
      .eq('status', 'pending')
      .not('attempted_at', 'is', null)
      .lt('attempted_at', cutoff)
      .in('id', ids)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await finishIfDone(supabase, id)
    return NextResponse.json({ ok: true, resolved: rows?.length ?? 0 })
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

  // 1. Claim a delivery row for every eligible subscriber who has none yet.
  //    Eligible = this product, consent scope 'event_dates', not unsubscribed.
  //    The unique (announcement, subscriber) constraint makes this race-safe.
  const [{ data: subs, error: subsError }, { data: existing }] = await Promise.all([
    supabase
      .from('bnt_waitlist')
      .select('id')
      .eq('product_slug', ann.product_slug)
      .eq('consent_scope', WAITLIST_CONSENT_SCOPE)
      .is('unsubscribed_at', null),
    supabase.from('bnt_waitlist_deliveries').select('waitlist_id').eq('announcement_id', id),
  ])
  if (subsError) return NextResponse.json({ error: subsError.message }, { status: 500 })
  const have = new Set((existing || []).map((d) => d.waitlist_id))
  for (const s of (subs || []).filter((s) => !have.has(s.id))) {
    await supabase.from('bnt_waitlist_deliveries').insert({ announcement_id: id, waitlist_id: s.id, status: 'pending' })
  }

  // 2. Attempt queued rows (pending, never attempted), one batch per call.
  const { data: queued } = await supabase
    .from('bnt_waitlist_deliveries')
    .select('id, waitlist_id')
    .eq('announcement_id', id)
    .eq('status', 'pending')
    .is('attempted_at', null)
    .order('created_at', { ascending: true })
    .limit(BATCH)

  let sent = 0
  let failed = 0
  let uncertain = 0
  for (const q of queued || []) {
    // Atomically mark the attempt. If another request got here first, the
    // conditional update matches nothing and we skip: no double send.
    const { data: claimed } = await supabase
      .from('bnt_waitlist_deliveries')
      .update({ attempted_at: new Date().toISOString() })
      .eq('id', q.id)
      .eq('status', 'pending')
      .is('attempted_at', null)
      .select('id, attempts')
      .maybeSingle()
    if (!claimed) continue
    await supabase.from('bnt_waitlist_deliveries').update({ attempts: (claimed.attempts ?? 0) + 1 }).eq('id', q.id)

    // Re-check eligibility at the moment of sending (unsubscribe may have
    // happened after the row was claimed).
    const { data: s } = await supabase
      .from('bnt_waitlist')
      .select('id, email, name, unsubscribe_token, unsubscribed_at, consent_scope, product_slug')
      .eq('id', q.waitlist_id)
      .maybeSingle()
    if (!s || s.unsubscribed_at || s.consent_scope !== WAITLIST_CONSENT_SCOPE || s.product_slug !== ann.product_slug) {
      await supabase.from('bnt_waitlist_deliveries').update({ status: 'failed', error: 'no longer eligible (unsubscribed or removed)' }).eq('id', q.id)
      failed++
      continue
    }
    if (!EMAIL_RE.test(s.email)) {
      await supabase.from('bnt_waitlist_deliveries').update({ status: 'failed', error: 'invalid email' }).eq('id', q.id)
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
      // Lets an admin find this exact message in Resend's log when resolving
      // an uncertain delivery.
      tags: [{ name: 'delivery_id', value: q.id.replace(/-/g, '_') }],
    })
    const now = new Date().toISOString()
    if (!error) {
      await supabase.from('bnt_waitlist_deliveries').update({ status: 'sent', sent_at: now, resend_id: res?.id ?? null, error: null }).eq('id', q.id)
      await supabase.from('bnt_waitlist').update({ notified_at: now }).eq('id', s.id)
      sent++
    } else if (isDefiniteRejection(error)) {
      await supabase.from('bnt_waitlist_deliveries').update({ status: 'failed', error: String(error.message).slice(0, 300) }).eq('id', q.id)
      failed++
    } else {
      // Network error / timeout / unreadable reply: Resend may or may not
      // have accepted it. Leave pending + attempted; an admin decides.
      await supabase.from('bnt_waitlist_deliveries').update({ error: `uncertain: ${String(error.message).slice(0, 280)}` }).eq('id', q.id)
      uncertain++
    }
    await sleep(PAUSE_MS)
  }

  const state = await finishIfDone(supabase, id)
  return NextResponse.json({ ok: true, sent, failed, uncertain, remaining: state.queued, needsReview: state.uncertain })
}

// Resend's SDK returns name 'application_error' (or a 5xx) when the request
// failed in transit or the reply couldn't be read: the email may have been
// accepted. Anything else is a definite rejection (validation, rate limit,
// auth) — nothing was sent, so it can be retried safely.
function isDefiniteRejection(error: { name?: string; statusCode?: number } | null): boolean {
  if (!error) return false
  if (error.name === 'application_error' || error.name === 'internal_server_error') return false
  if (typeof error.statusCode === 'number' && error.statusCode >= 500) return false
  return true
}

// Counts what is left and marks the announcement sent only when nothing is
// queued and nothing is awaiting a decision.
async function finishIfDone(supabase: ReturnType<typeof getServiceSupabase>, id: string) {
  const { data: rows } = await supabase.from('bnt_waitlist_deliveries').select('status, attempted_at').eq('announcement_id', id).eq('status', 'pending')
  const queued = (rows || []).filter((r) => !r.attempted_at).length
  const uncertain = (rows || []).filter((r) => r.attempted_at).length
  if (queued === 0 && uncertain === 0) {
    await supabase.from('bnt_waitlist_announcements').update({ status: 'sent', completed_at: new Date().toISOString() }).eq('id', id).eq('status', 'sending')
  }
  return { queued, uncertain }
}
