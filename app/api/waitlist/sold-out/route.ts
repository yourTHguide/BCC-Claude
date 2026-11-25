import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { resolveStorefront } from '@/lib/storefront'
import { BCC_PRODUCT_SLUG, bangkokNow } from '@/lib/bookingAvailability'
import { EMAIL_RE } from '@/lib/bnt/leads'
import { STATE_MESSAGE, bccUpdatesOptInEnabled, loadBccInstance, loadBccInstancesOn, soldOutWaitlistEnabled } from '@/lib/waitlist/bccInstances'
import {
  BCC_UPDATES_CONSENT_TEXT,
  BCC_UPDATES_SCOPE,
  MAX_ACTIVE_SIGNUPS_PER_EMAIL,
  MAX_PARTY_SIZE,
  MIN_FILL_MS,
  SOLD_OUT_SCOPE,
  SOLD_OUT_SOURCE,
  soldOutConsentText,
} from '@/lib/waitlist/soldOut'

export const dynamic = 'force-dynamic'

// Bangkok Club Crawl sold-out waitlist (Phase 3B).
//
// GET  ?date=YYYY-MM-DD → the state of each Club Crawl night on that date
//      (bookable / sold_out / cancelled / closed / cutoff / past ...), so a
//      deep link to a date that can't be booked says why. Public facts only.
// POST {eventId, name, email, partySize, consent: true} → one sign-up for
//      that one event instance. Accepted only while the night is a genuinely
//      full Club Crawl night, any day (re-checked here from the database,
//      never from the page). Stores the dated consent wording the guest saw.
//      Nothing is reserved; no email is sent by this route.
//
// Response: { success, duplicate }. duplicate=true: already on this date's list.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function bccOnly(req: NextRequest) {
  return resolveStorefront(req.headers.get('host')) === 'bcc'
}

export async function GET(req: NextRequest) {
  if (!bccOnly(req)) return NextResponse.json({ error: 'Not available' }, { status: 404 })
  const date = req.nextUrl.searchParams.get('date') || ''
  if (!DATE_RE.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  try {
    const list = await loadBccInstancesOn(getServiceSupabase(), date)
    return NextResponse.json({
      date,
      nights: list.map((i) => ({
        eventId: i.id,
        nightName: i.nightName,
        nightSlug: i.nightSlug,
        state: i.state,
        message: STATE_MESSAGE[i.state],
        waitlist: i.waitlistEligible && soldOutWaitlistEnabled(),
      })),
    })
  } catch (err) {
    console.error('sold-out status error:', err)
    return NextResponse.json({ error: 'Dates temporarily unavailable. Please try again.' }, { status: 503 })
  }
}

// Optional "keep me updated" opt-in: its own row, consent text and token.
// Best effort: the date waitlist sign-up never fails because of it.
async function saveUpdatesOptIn(supabase: ReturnType<typeof getServiceSupabase>, email: string, name: string) {
  try {
    const now = new Date().toISOString()
    const { data: existing } = await supabase
      .from('bnt_waitlist')
      .select('id, unsubscribed_at')
      .eq('product_slug', BCC_PRODUCT_SLUG)
      .eq('consent_scope', BCC_UPDATES_SCOPE)
      .eq('email', email)
      .maybeSingle()
    if (existing && !existing.unsubscribed_at) return
    if (existing) {
      await supabase
        .from('bnt_waitlist')
        .update({ unsubscribed_at: null, name, consent_text: BCC_UPDATES_CONSENT_TEXT, consented_at: now, source: SOLD_OUT_SOURCE })
        .eq('id', existing.id)
      return
    }
    const { error } = await supabase.from('bnt_waitlist').insert({
      product_slug: BCC_PRODUCT_SLUG,
      email,
      name,
      source: SOLD_OUT_SOURCE,
      consent_scope: BCC_UPDATES_SCOPE,
      consent_text: BCC_UPDATES_CONSENT_TEXT,
      consented_at: now,
    })
    if (error && error.code !== '23505') console.error('updates opt-in insert error:', error)
  } catch (err) {
    console.error('updates opt-in error:', err)
  }
}

export async function POST(req: NextRequest) {
  if (!bccOnly(req) || !soldOutWaitlistEnabled()) return NextResponse.json({ error: 'The waitlist is not available.' }, { status: 404 })
  try {
    const body = await req.json().catch(() => ({}))

    // Spam controls: hidden honeypot field and a minimum fill time. Bots get a
    // normal-looking answer and nothing is stored.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ success: true, duplicate: true })
    }
    if (typeof body.elapsedMs === 'number' && body.elapsedMs < MIN_FILL_MS) {
      return NextResponse.json({ success: true, duplicate: true })
    }

    const eventId = typeof body.eventId === 'string' ? body.eventId : ''
    if (!UUID_RE.test(eventId)) return NextResponse.json({ error: 'This date is not available.' }, { status: 400 })
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ').slice(0, 80) : ''
    if (!name) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
    const partySize = Number(body.partySize)
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE) {
      return NextResponse.json({ error: `Party size must be between 1 and ${MAX_PARTY_SIZE}.` }, { status: 400 })
    }
    if (body.consent !== true) {
      return NextResponse.json({ error: 'Please tick the box to confirm you want this email.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    // Only when the guest ticked the separate, optional box AND it is shown.
    const wantsUpdates = body.updates === true && bccUpdatesOptInEnabled()

    // Eligibility from the database, right now.
    let instance
    try {
      instance = await loadBccInstance(supabase, eventId)
    } catch (err) {
      console.error('sold-out signup lookup error:', err)
      return NextResponse.json({ error: 'We couldn’t check this date. Please try again.' }, { status: 503 })
    }
    if (!instance) return NextResponse.json({ error: 'This date is not available.', state: 'not_found' }, { status: 404 })
    if (!instance.waitlistEligible) {
      const msg =
        instance.state === 'bookable'
          ? 'Good news — seats are available for this night. You can book it now.'
          : STATE_MESSAGE[instance.state]
      return NextResponse.json({ error: msg, state: instance.state }, { status: 409 })
    }

    // Spam control: a cap on upcoming sold-out sign-ups per address.
    const today = bangkokNow().date
    const { data: mine, error: mineError } = await supabase
      .from('bnt_waitlist')
      .select('id, event_date_id, unsubscribed_at')
      .eq('email', email)
      .eq('consent_scope', SOLD_OUT_SCOPE)
      .gte('event_date', today)
    if (mineError) {
      console.error('sold-out signup lookup error:', mineError)
      return NextResponse.json({ error: 'We couldn’t save your details. Please try again.' }, { status: 500 })
    }
    const existing = (mine || []).find((r) => r.event_date_id === eventId)
    const consentText = soldOutConsentText(instance.nightName, instance.eventDate)
    const now = new Date().toISOString()

    if (existing && !existing.unsubscribed_at) {
      // Already on this date's list: keep one row, update the party size only.
      await supabase.from('bnt_waitlist').update({ party_size: partySize }).eq('id', existing.id)
      if (wantsUpdates) await saveUpdatesOptIn(supabase, email, name)
      return NextResponse.json({ success: true, duplicate: true })
    }
    const activeOthers = (mine || []).filter((r) => !r.unsubscribed_at && r.event_date_id !== eventId).length
    if (activeOthers >= MAX_ACTIVE_SIGNUPS_PER_EMAIL) {
      return NextResponse.json(
        { error: `You’re already on the waitlist for ${MAX_ACTIVE_SIGNUPS_PER_EMAIL} upcoming nights. Message us on WhatsApp and we’ll help.` },
        { status: 429 }
      )
    }

    if (existing) {
      // Unsubscribed earlier and asking again: a fresh, explicit opt-in.
      const { error } = await supabase
        .from('bnt_waitlist')
        .update({ unsubscribed_at: null, name, party_size: partySize, consent_text: consentText, consented_at: now, source: SOLD_OUT_SOURCE })
        .eq('id', existing.id)
      if (error) {
        console.error('sold-out resubscribe error:', error)
        return NextResponse.json({ error: 'We couldn’t save your details. Please try again.' }, { status: 500 })
      }
      if (wantsUpdates) await saveUpdatesOptIn(supabase, email, name)
      return NextResponse.json({ success: true, duplicate: false })
    }

    const { error } = await supabase.from('bnt_waitlist').insert({
      product_slug: BCC_PRODUCT_SLUG,
      email,
      name,
      source: SOLD_OUT_SOURCE,
      consent_scope: SOLD_OUT_SCOPE,
      consent_text: consentText,
      consented_at: now,
      event_date_id: instance.id,
      event_date: instance.eventDate,
      night_slug: instance.nightSlug,
      party_size: partySize,
    })
    // Unique (event_date_id, email): a double click or parallel request.
    if (error?.code === '23505') {
      if (wantsUpdates) await saveUpdatesOptIn(supabase, email, name)
      return NextResponse.json({ success: true, duplicate: true })
    }
    if (error) {
      console.error('sold-out signup insert error:', error)
      return NextResponse.json({ error: 'We couldn’t save your details. Please try again.' }, { status: 500 })
    }
    if (wantsUpdates) await saveUpdatesOptIn(supabase, email, name)
    return NextResponse.json({ success: true, duplicate: false })
  } catch (err) {
    console.error('sold-out signup server error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
