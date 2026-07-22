import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { generateConfirmedMeetupEmail } from '@/emails/confirmed-meetup'

// Lazily instantiated — see lib/supabase.ts for why: constructing this at
// module scope crashes the Next.js build-time "collecting page data" step
// when RESEND_API_KEY isn't available in that phase.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(req: NextRequest) {
  try {
    const { eventId } = await req.json()
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
    }

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

    const guests = [
      ...(bookings || []).map((b: any) => ({ name: b.guest_name, email: b.guest_email })),
      ...(otaBookings || []).map((o: any) => ({ name: o.guest_name, email: o.guest_email })),
    ]

    if (guests.length === 0) missing.push('there are no confirmed guests for this date')

    if (missing.length > 0) {
      return NextResponse.json({ error: 'Cannot send yet', missing }, { status: 400 })
    }

    const resend = getResend()
    let sent = 0
    let skippedNoEmail = 0

    for (const guest of guests) {
      if (!guest.email) { skippedNoEmail++; continue }
      const html = generateConfirmedMeetupEmail({
        guestName: guest.name || 'Guest',
        nightName: event.night_name,
        eventDate: event.event_date,
        meetUpLocation: event.meet_up_location,
        whatsappGroupLink: event.whatsapp_group_link,
      })
      const { error: emailError } = await resend.emails.send({
        from: `Bangkok Club Crawl <${process.env.RESEND_FROM}>`,
        to: guest.email,
        subject: `Tonight is confirmed — ${event.night_name}`,
        html,
      })
      if (emailError) {
        console.error('Confirmed-meetup email error for', guest.email, emailError)
      } else {
        sent++
      }
    }

    // Simple audit trail — appended to the existing notes field, matching the
    // pattern already used by cancel-booking/reschedule-booking, rather than
    // building a separate audit log system.
    await supabase
      .from('event_dates')
      .update({
        notes: `${event.notes ? event.notes + ' | ' : ''}Confirmed-meetup email sent to ${sent} guest(s) on ${new Date().toISOString()}`,
      })
      .eq('id', eventId)

    return NextResponse.json({ success: true, sent, skippedNoEmail, totalGuests: guests.length })
  } catch (err: any) {
    console.error('Send-confirmed-meetup route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
