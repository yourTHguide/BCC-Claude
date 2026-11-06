import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { generateConfirmedMeetupEmail } from '@/emails/confirmed-meetup'
import type { Storefront } from '@/lib/storefront'
import { resendFromHeader } from '@/lib/storefrontBrand'
import { requireAdmin } from '@/lib/admin-auth'

// Lazily instantiated — see lib/supabase.ts for why: constructing this at
// module scope crashes the Next.js build-time "collecting page data" step
// when RESEND_API_KEY isn't available in that phase.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  try {
    // mode:
    //   'unsent' (default) — only guests with no meetup_sent_at yet, so a
    //            second press after late bookings never re-emails anyone.
    //   'all'    — everyone on the list (explicit resend to all).
    //   'guests' — exactly the guests listed in `guests` [{ table, id }],
    //            for the per-guest Send / Resend buttons.
    const { eventId, mode = 'unsent', guests: picked } = await req.json()
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }
    if (!['unsent', 'all', 'guests'].includes(mode)) {
      return NextResponse.json({ error: 'mode must be unsent, all or guests' }, { status: 400 })
    }
    if (mode === 'guests' && (!Array.isArray(picked) || picked.length === 0)) {
      return NextResponse.json({ error: 'guests is required for mode "guests"' }, { status: 400 })
    }
    const pickedKeys = new Set<string>(
      mode === 'guests' ? picked.map((g: any) => `${g.table}:${g.id}`) : []
    )

    const supabase = getServiceSupabase()

    const { data: event, error: eventError } = await supabase
      .from('event_dates')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event date not found' }, { status: 404 })
    }

    // ── Validation — same rules enforced again server-side, since the
    // client-side check can't be trusted as the only gate ──
    const missing: string[] = []
    if (event.operation_verdict !== 'Operation Confirmed') {
      missing.push('operation_verdict must be "Operation Confirmed"')
    }
    if (!event.meet_up_location) missing.push('meet_up_location is not set')
    if (!event.whatsapp_group_link) missing.push('whatsapp_group_link is not set')

    const [{ data: bookings }, { data: otaBookings }] = await Promise.all([
      supabase.from('bookings').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug).eq('status', 'confirmed').neq('attendance_status', 'no_show'),
      supabase.from('ota_bookings').select('*').eq('event_date', event.event_date).eq('night_slug', event.night_slug).neq('attendance_status', 'no_show'),
    ])

    // Per-guest storefront: `bookings.storefront` (Stage 10 Phase 5 column).
    // `ota_bookings` has no storefront column at all — that table is an
    // external-channel-only integration with no BNT concept, so those guests
    // default to 'bcc', matching every other storefront default in this
    // codebase (and this table's own real-world exclusivity to BCC today).
    const allGuests = [
      ...(bookings || []).map((b: any) => ({
        table: 'bookings' as const,
        id: b.id as string,
        name: b.guest_name,
        email: b.guest_email,
        sentAt: b.meetup_sent_at as string | null,
        storefront: (b.storefront === 'bnt' ? 'bnt' : 'bcc') as Storefront,
      })),
      ...(otaBookings || []).map((o: any) => ({
        table: 'ota_bookings' as const,
        id: o.id as string,
        name: o.guest_name,
        email: o.guest_email,
        sentAt: o.meetup_sent_at as string | null,
        storefront: 'bcc' as Storefront,
      })),
    ]

    if (allGuests.length === 0) missing.push('there are no confirmed guests for this date')

    const guests = mode === 'all'
      ? allGuests
      : mode === 'guests'
        ? allGuests.filter((g) => pickedKeys.has(`${g.table}:${g.id}`))
        : allGuests.filter((g) => !g.sentAt)

    if (allGuests.length > 0 && guests.length === 0) {
      missing.push(mode === 'guests'
        ? 'the selected guest is not on this date’s list (or is marked no-show)'
        : 'every guest on this date has already been sent the meetup email')
    }

    if (missing.length > 0) {
      return NextResponse.json({ error: 'Cannot send yet', missing }, { status: 400 })
    }

    const resend = getResend()
    let sent = 0
    let skippedNoEmail = 0
    const sentAt = new Date().toISOString()
    const sentIds: Record<'bookings' | 'ota_bookings', string[]> = { bookings: [], ota_bookings: [] }

    for (const guest of guests) {
      if (!guest.email) { skippedNoEmail++; continue }
      const html = generateConfirmedMeetupEmail({
        guestName: guest.name || 'Guest',
        nightName: event.night_name,
        eventDate: event.event_date,
        meetUpLocation: event.meet_up_location,
        whatsappGroupLink: event.whatsapp_group_link,
        storefront: guest.storefront,
      })
      const { error: emailError } = await resend.emails.send({
        from: resendFromHeader(guest.storefront),
        to: guest.email,
        subject: `Tonight is confirmed — ${event.night_name}`,
        html,
      })
      if (emailError) {
        console.error('Confirmed-meetup email error for', guest.email, emailError)
      } else {
        sent++
        sentIds[guest.table].push(guest.id)
      }
    }

    // Per-guest record — this is what lets the next send target only
    // guests who haven't had it yet.
    await Promise.all(
      (Object.keys(sentIds) as (keyof typeof sentIds)[])
        .filter((t) => sentIds[t].length > 0)
        .map((t) => supabase.from(t).update({ meetup_sent_at: sentAt }).in('id', sentIds[t]))
    )

    // Simple audit trail — appended to the existing notes field, matching the
    // pattern already used by cancel-booking/reschedule-booking, rather than
    // building a separate audit log system.
    await supabase
      .from('event_dates')
      .update({
        notes: `${event.notes ? event.notes + ' | ' : ''}Confirmed-meetup email (${mode}) sent to ${sent} guest(s) on ${sentAt}`,
      })
      .eq('id', eventId)

    return NextResponse.json({ success: true, sent, skippedNoEmail, targeted: guests.length, totalGuests: allGuests.length, sentAt })
  } catch (err: any) {
    console.error('Send-confirmed-meetup route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
