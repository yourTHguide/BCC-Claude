import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import { generateRescheduleEmail } from '@/emails/reschedule'
import type { Storefront } from '@/lib/storefront'
import { resendFromHeader } from '@/lib/storefrontBrand'
import { requireRole } from '@/lib/admin-auth'

// Lazily instantiated so importing this route doesn't run the Resend
// constructor during Next.js's build-time "collecting page data" step,
// which crashed the build when RESEND_API_KEY wasn't available there.
function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['owner', 'admin'])
  if ('response' in auth) return auth.response

  try {
    const { bookingId, newDate, newEventId } = await req.json()

    if (!bookingId || (!newDate && !newEventId)) {
      return NextResponse.json({ error: 'Missing bookingId or newDate/newEventId' }, { status: 400 })
    }
    if (newDate && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return NextResponse.json({ error: 'newDate must be in YYYY-MM-DD format' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // Resolve the event the guest is moving TO. Moving only event_date left
    // the booking on its old night (e.g. a TGIF booking "moved" to a
    // Saturday kept night_slug='tgif'), so the calendar's day panel — which
    // matches on event_date AND night_slug — never listed the guest there.
    let target: any = null
    if (newEventId) {
      const { data } = await supabase
        .from('event_dates')
        .select('id, event_date, night_slug, night_name, product_id, is_open')
        .eq('id', newEventId)
        .maybeSingle()
      target = data
      if (!target) return NextResponse.json({ error: 'Target event not found' }, { status: 404 })
      if (newDate && target.event_date !== newDate) {
        return NextResponse.json({ error: 'newEventId is not on newDate' }, { status: 400 })
      }
    } else {
      const { data: options } = await supabase
        .from('event_dates')
        .select('id, event_date, night_slug, night_name, product_id, is_open')
        .eq('event_date', newDate)
      const all = options ?? []
      const open = all.filter((e: any) => e.is_open)
      target = open.length === 1 ? open[0] : all.length === 1 ? all[0] : null
      if (!target) {
        return NextResponse.json({
          error: all.length === 0
            ? `No event is scheduled on ${newDate}. Create the date in the calendar first.`
            : `More than one event on ${newDate} — choose which one.`,
          options: all.map((e: any) => ({ id: e.id, nightName: e.night_name, isOpen: e.is_open })),
        }, { status: 409 })
      }
    }

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: `Booking is ${booking.status}, not confirmed` }, { status: 400 })
    }

    const oldDate = booking.event_date
    const oldNight = booking.night_name
    const targetDate: string = target.event_date
    const nightChanged = booking.night_slug !== target.night_slug
    const fromLabel = nightChanged ? `${oldDate} (${oldNight})` : oldDate
    const toLabel = nightChanged ? `${targetDate} (${target.night_name})` : targetDate

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        event_date: targetDate,
        event_id: target.id,
        night_slug: target.night_slug,
        night_name: target.night_name,
        ...(target.product_id ? { product_id: target.product_id } : {}),
        notes: `${booking.notes ? booking.notes + ' | ' : ''}Rescheduled from ${fromLabel} to ${toLabel} on ${new Date().toISOString()}`,
      })
      .eq('id', bookingId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    if (booking.guest_email) {
      const storefront: Storefront = booking.storefront === 'bnt' ? 'bnt' : 'bcc'
      const emailHtml = generateRescheduleEmail({
        guestName: booking.guest_name,
        nightName: target.night_name,
        oldDate,
        newDate: targetDate,
        quantity: booking.quantity,
        totalPaid: booking.total_paid,
        storefront,
      })

      const { error: emailError } = await getResend().emails.send({
        from: resendFromHeader(storefront),
        to: booking.guest_email,
        subject: `Your booking date has changed — ${target.night_name}`,
        html: emailHtml,
      })

      if (emailError) console.error('Resend reschedule email error:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Reschedule-booking route error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
