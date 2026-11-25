import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/sendEmail'
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
import { BCC_PRODUCT_SLUG } from '@/lib/bookingAvailability'
import { loadBccInstance } from '@/lib/waitlist/bccInstances'
import { checkReopenRecipient, MAX_PARTY_SIZE, SOLD_OUT_SCOPE } from '@/lib/waitlist/soldOut'
import {
  buildReopenEmail,
  defaultReopenSubject,
  reopenAudience,
  reopenSummary,
  seatCap,
  verifyReopen,
  type ReopenAnnouncement,
} from '@/lib/waitlist/reopen'

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
//
// Phase 3B adds a second kind, 'sold_out_reopen' (Bangkok Club Crawl only):
//   reopen-audience : counts by party size for a date at a seat limit (no write).
//   create-reopen   : draft a "seats reopened" notice for ONE date that is
//                     bookable again, with the largest party size to notify
//                     (never more than the seats left). One unfinished notice
//                     per date (unique index).
// Its recipients are that date's 'sold_out_date' sign-ups only. Every batch
// re-checks the date (still bookable, same night/time/price, seats left) and
// every recipient (consent, not unsubscribed, not already told, not already
// booked, party fits the seats left NOW); anyone failing is 'skipped' and
// nothing is sent to them. Each person gets at most one notice per date.

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
  // 2-click flow (Phase 3B): a create with sendNow + confirmChecked saves the
  // notice record and continues straight into the normal send below, so every
  // send-time check still runs. The record is kept for audit as before.
  let action: string = typeof body.action === 'string' ? body.action : ''
  let annId: string = typeof body.id === 'string' ? body.id : ''
  const sendNow = body.sendNow === true
  if (sendNow && body.confirmChecked !== true) {
    return NextResponse.json({ error: 'Tick the box to confirm before sending.' }, { status: 400 })
  }

  if (action === 'create') {
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
    if (!sendNow) return NextResponse.json({ ok: true, id: data.id })
    annId = data.id
    action = 'send'
  }

  if (action === 'reopen-audience' || action === 'create-reopen') {
    const eventDateId = typeof body.eventDateId === 'string' ? body.eventDateId : ''
    const instance = eventDateId ? await loadBccInstance(supabase, eventDateId) : null
    if (!instance) return NextResponse.json({ error: 'Date not found' }, { status: 404 })
    if (instance.state !== 'bookable') {
      return NextResponse.json({ error: `This date isn't bookable right now (${instance.state.replace('_', ' ')}). Reopen seats in the calendar first.`, state: instance.state }, { status: 409 })
    }
    const requested = Number(body.maxPartySize)
    const limit = seatCap(MAX_PARTY_SIZE, instance.remaining)
    if (limit < 1) return NextResponse.json({ error: 'No seats are left for this date.' }, { status: 409 })
    const maxPartySize = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, limit) : limit
    const audience = await reopenAudience(supabase, instance.id, maxPartySize)

    if (action === 'reopen-audience') {
      return NextResponse.json({ ok: true, remaining: instance.remaining, limit, maxPartySize, summary: reopenSummary(instance), audience })
    }

    const subject = (typeof body.subject === 'string' ? body.subject.trim().slice(0, 150) : '') || (sendNow ? defaultReopenSubject(instance) : '')
    const intro = typeof body.intro === 'string' ? body.intro.trim().slice(0, 1500) : ''
    if (!subject) return NextResponse.json({ error: 'Add a subject line.' }, { status: 400 })
    if (requested > limit) {
      return NextResponse.json({ error: `Only ${limit} seat(s) are left; the party size limit can't be higher.` }, { status: 400 })
    }
    // 2-click: if this date already has an unfinished notice (e.g. a draft
    // from the old screen), send that one instead of refusing.
    const { data: open } = sendNow
      ? await supabase
          .from('bnt_waitlist_announcements')
          .select('id')
          .eq('kind', 'sold_out_reopen')
          .eq('event_date_id', instance.id)
          .in('status', ['draft', 'sending'])
          .limit(1)
          .maybeSingle()
      : { data: null }
    const { data, error } = open
      ? { data: open, error: null }
      : await supabase
      .from('bnt_waitlist_announcements')
      .insert({
        kind: 'sold_out_reopen',
        product_slug: BCC_PRODUCT_SLUG,
        event_date_id: instance.id,
        event_date_ids: [instance.id],
        max_party_size: maxPartySize,
        seats_at_draft: instance.remaining,
        dates_summary: reopenSummary(instance),
        subject,
        intro: intro || null,
        status: 'draft',
        created_by: who,
      })
      .select('id')
      .single()
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'There is already an unfinished notice for this date. Finish or cancel it first.' }, { status: 409 })
    }
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Could not save the notice.' }, { status: 500 })
    if (!sendNow) return NextResponse.json({ ok: true, id: data.id, audience })
    annId = data.id
    action = 'send'
  }

  const id = annId
  const { data: a, error: loadError } = await supabase.from('bnt_waitlist_announcements').select('*').eq('id', id).maybeSingle()
  if (loadError || !a) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 })
  const ann = a as AnnouncementRecord
  const isReopen = (a as { kind?: string }).kind === 'sold_out_reopen'
  const reopen = a as ReopenAnnouncement

  if (action === 'cancel') {
    if (ann.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 })
    await supabase.from('bnt_waitlist_announcements').update({ status: 'cancelled' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'retry-failed') {
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

  if (action === 'resolve-uncertain') {
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

  // Date re-check before ANY email (test included).
  const productCheck = isReopen ? null : await verifyAnnouncementDates(supabase, ann)
  if (productCheck && !productCheck.ok) return NextResponse.json({ error: productCheck.error }, { status: 409 })
  const reopenCheck = isReopen ? await verifyReopen(supabase, reopen) : null
  if (reopenCheck && !reopenCheck.ok) return NextResponse.json({ error: reopenCheck.error }, { status: 409 })
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Email is not configured on this deployment (RESEND_API_KEY).' }, { status: 503 })
  const from = resendFromHeader(isReopen ? 'bcc' : 'bnt')
  const PLACEHOLDER_TOKEN = '00000000-0000-0000-0000-000000000000'

  if (action === 'test') {
    if (!auth.admin.email) return NextResponse.json({ error: 'Your admin account has no email address' }, { status: 400 })
    const email =
      reopenCheck?.ok
        ? buildReopenEmail(reopen, reopenCheck.instance, { name: null, partySize: Math.min(2, reopenCheck.cap), unsubscribeToken: PLACEHOLDER_TOKEN })
        : buildAnnouncementEmail(ann, productCheck!.ok ? productCheck!.dates : [], { name: null, unsubscribeToken: PLACEHOLDER_TOKEN })
    const { error } = await sendEmail({
      from,
      to: auth.admin.email,
      subject: `[TEST] ${email.subject}`,
      html: email.html,
      text: email.text,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 502 })
    return NextResponse.json({ ok: true, sentTo: auth.admin.email })
  }

  if (action !== 'send') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
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
  //    Product notice: this product, consent scope 'event_dates', not unsubscribed.
  //    Reopen notice: this date's 'sold_out_date' sign-ups, not unsubscribed,
  //    never notified, party fits the seat limit NOW, and not already sent /
  //    held for review in another notice for this date.
  //    The unique (announcement, subscriber) constraint makes this race-safe.
  const subsQuery = isReopen
    ? supabase
        .from('bnt_waitlist')
        .select('id')
        .eq('product_slug', BCC_PRODUCT_SLUG)
        .eq('consent_scope', SOLD_OUT_SCOPE)
        .eq('event_date_id', reopen.event_date_id)
        .is('unsubscribed_at', null)
        .is('notified_at', null)
        .lte('party_size', reopenCheck!.ok ? reopenCheck!.cap : 0)
    : supabase
        .from('bnt_waitlist')
        .select('id')
        .eq('product_slug', ann.product_slug)
        .eq('consent_scope', WAITLIST_CONSENT_SCOPE)
        .is('unsubscribed_at', null)
  const [{ data: subs, error: subsError }, { data: existing }] = await Promise.all([
    subsQuery,
    supabase.from('bnt_waitlist_deliveries').select('waitlist_id').eq('announcement_id', id),
  ])
  if (subsError) return NextResponse.json({ error: subsError.message }, { status: 500 })
  const have = new Set((existing || []).map((d) => d.waitlist_id))
  let candidates = (subs || []).filter((s) => !have.has(s.id))
  if (isReopen && candidates.length) {
    const blocked = await notifiedElsewhere(supabase, id, candidates.map((s) => s.id))
    candidates = candidates.filter((s) => !blocked.has(s.id))
  }
  for (const s of candidates) {
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
  let skipped = 0
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
    // happened after the row was claimed). A lookup ERROR is not "removed":
    // nothing has been sent, so release the claim and stop the batch; the
    // next call retries this row.
    const { data: s, error: lookupError } = await supabase
      .from('bnt_waitlist')
      .select('id, email, name, unsubscribe_token, unsubscribed_at, consent_scope, product_slug, consented_at, consent_text, event_date_id, party_size, notified_at')
      .eq('id', q.waitlist_id)
      .maybeSingle()
    if (lookupError) {
      await supabase.from('bnt_waitlist_deliveries').update({ attempted_at: null }).eq('id', q.id)
      console.error('waitlist recipient lookup failed:', lookupError)
      return NextResponse.json(
        { error: 'Could not load a recipient. Nothing was sent to them; try again.', sent, failed, uncertain, skipped },
        { status: 503 }
      )
    }

    // Eligibility is decided by exactly ONE rule set per announcement kind:
    // reopen notices -> checkReopenRecipient (sold_out_date scope, this date);
    // product notices -> the original Phase 3 rule (event_dates scope, this
    // product). The two audiences never cross.
    if (isReopen) {
      if (!reopenCheck?.ok) {
        // Unreachable (verified before the loop); never leave a claim dangling.
        await supabase.from('bnt_waitlist_deliveries').update({ attempted_at: null }).eq('id', q.id)
        continue
      }
      let elsewhere = new Set<string>()
      let booked = false
      try {
        if (s) {
          ;[elsewhere, booked] = await Promise.all([
            notifiedElsewhere(supabase, id, [s.id]),
            alreadyBooked(supabase, reopenCheck.instance.eventDate, reopenCheck.instance.nightSlug, s.email),
          ])
        }
      } catch (err) {
        // Couldn't verify: nothing was sent, so release the claim (not
        // "uncertain") and stop this batch. The next call retries it.
        await supabase.from('bnt_waitlist_deliveries').update({ attempted_at: null }).eq('id', q.id)
        console.error('reopen recipient check failed:', err)
        return NextResponse.json(
          { error: 'Could not verify a recipient. Nothing was sent to them; try again.', sent, failed, uncertain, skipped },
          { status: 503 }
        )
      }
      const verdict = checkReopenRecipient(
        s,
        { productSlug: BCC_PRODUCT_SLUG, eventDateId: reopen.event_date_id, seatCap: reopenCheck.cap },
        { alreadyNotified: !!s && elsewhere.has(s.id), alreadyBooked: booked, emailValid: !!s && EMAIL_RE.test(s.email) }
      )
      if (!verdict.ok || !s) {
        await supabase
          .from('bnt_waitlist_deliveries')
          .update({ status: 'skipped', error: verdict.ok ? 'removed from the list' : verdict.reason })
          .eq('id', q.id)
        skipped++
        continue
      }
    } else {
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
    }

    const email = reopenCheck?.ok
      ? buildReopenEmail(reopen, reopenCheck.instance, { name: s.name, partySize: s.party_size, unsubscribeToken: s.unsubscribe_token })
      : buildAnnouncementEmail(ann, productCheck!.ok ? productCheck!.dates : [], { name: s.name, unsubscribeToken: s.unsubscribe_token })
    const { data: res, error } = await sendEmail({
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
  return NextResponse.json({ ok: true, id, sent, failed, uncertain, skipped, remaining: state.queued, needsReview: state.uncertain })
}

// Sign-ups that already got (or may have got) a reopen notice for this date in
// ANOTHER notice: sent, unconfirmed, or attempted with no recorded outcome.
// They are never emailed again for the same date.
async function notifiedElsewhere(supabase: ReturnType<typeof getServiceSupabase>, announcementId: string, waitlistIds: string[]): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('bnt_waitlist_deliveries')
    .select('waitlist_id, status, attempted_at')
    .in('waitlist_id', waitlistIds)
    .neq('announcement_id', announcementId)
  if (error) throw error
  return new Set(
    (data || [])
      .filter((d) => d.status === 'sent' || d.status === 'unconfirmed' || (d.status === 'pending' && d.attempted_at))
      .map((d) => d.waitlist_id)
  )
}

// Has this address already got a confirmed booking for the night? Then the
// notice would only be noise.
async function alreadyBooked(supabase: ReturnType<typeof getServiceSupabase>, eventDate: string, nightSlug: string, email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('event_date', eventDate)
    .eq('night_slug', nightSlug)
    .eq('status', 'confirmed')
    .ilike('guest_email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(1)
  if (error) throw error
  return !!data && data.length > 0
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
