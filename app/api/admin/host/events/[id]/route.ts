import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Stage 9j — the restricted Host operational view for one Event Instance.
// This is the ONE place that decides what a Host may see: the query below
// never selects host_fee_final/host_payment_status (owner-only host pay)
// or bookings.total_paid/price_per_person/expenses-vs-revenue math (would
// reveal profit) — those fields are structurally absent from this response,
// not merely hidden by the UI. Reuses the exact same canonical
// event_dates/bookings/ota_bookings/expenses tables the owner's existing
// dashboard reads — no duplicate data model, just a narrower, server-
// authorized read of it.
//
// IMPORTANT — what this route does NOT fix: the OWNER's existing dashboard
// (app/dashboard/page.tsx) reads these same tables directly from the
// browser via the anon key, and event_dates/bookings/ota_bookings/expenses
// all currently carry a public `USING (true)` SELECT policy (see
// supabase-schema.sql). That means the revenue/host-fee data this route
// deliberately omits is STILL fully readable by anyone holding the anon
// key (bundled into the client-side JS of every page — not secret),
// regardless of admin_users membership or role, via a direct Supabase
// query that never touches this route at all. Gating this NEW route and a
// staff-role redirect on the OLD dashboard page (see middleware.ts /
// dashboard/layout.tsx) are real, additive protections for the intended
// Host workflow, but they are not equivalent to fixing that underlying
// RLS posture — doing so is a materially larger schema/RLS redesign
// (tightening 4 tables' public-read policies without breaking the owner
// dashboard's own direct reads) explicitly out of scope for this stage.
// See PHASE4_CHECKPOINT.md.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('response' in auth) return auth.response

  const supabase = getServiceSupabase()
  const { data: event, error: eventError }: { data: any; error: any } = await supabase
    .from('event_dates')
    .select(
      'id, event_date, night_name, night_slug, is_open, host_assigned, ' +
        'meet_up_location, whatsapp_group_link, venue_route, van_or_taxi_contact, ' +
        'special_notes, operation_verdict'
    )
    .eq('id', params.id)
    .maybeSingle()

  if (eventError) {
    console.error('admin/host/events/[id]: event query error:', eventError)
    return NextResponse.json({ error: 'Failed to load event' }, { status: 500 })
  }
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Assignment check — staff may only open an event assigned to them.
  // Owner/admin bypass this entirely (also how they preview the Host view).
  if (auth.admin.role === 'staff' && event.host_assigned !== auth.admin.displayName) {
    return NextResponse.json({ error: 'Not your assigned event' }, { status: 403 })
  }

  const [{ data: bookings, error: bookingsError }, { data: otaBookings, error: otaError }, { data: expenses, error: expensesError }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('id, guest_name, guest_email, quantity, attendance_status')
        .eq('event_date', event.event_date)
        .eq('night_slug', event.night_slug)
        .eq('status', 'confirmed'),
      supabase
        .from('ota_bookings')
        .select('id, guest_name, source, quantity, attendance_status')
        .eq('event_date', event.event_date)
        .eq('night_slug', event.night_slug),
      supabase
        .from('expenses')
        .select('id, category, description, amount')
        .eq('event_date', event.event_date)
        .eq('night_slug', event.night_slug),
    ])

  if (bookingsError || otaError || expensesError) {
    console.error('admin/host/events/[id]: sub-query error:', bookingsError || otaError || expensesError)
    return NextResponse.json({ error: 'Failed to load event details' }, { status: 500 })
  }

  const guests = [
    ...(bookings ?? []).map((b: any) => ({
      id: b.id, source: 'website', guestName: b.guest_name || b.guest_email || 'Guest',
      quantity: b.quantity, attendanceStatus: b.attendance_status, table: 'bookings' as const,
    })),
    ...(otaBookings ?? []).map((o: any) => ({
      id: o.id, source: o.source, guestName: o.guest_name || 'Guest',
      quantity: o.quantity, attendanceStatus: o.attendance_status, table: 'ota_bookings' as const,
    })),
  ]
  const totalGuests = guests.reduce((s, g) => s + g.quantity, 0)
  const checkedInGuests = guests.filter((g) => g.attendanceStatus === 'checked_in').reduce((s, g) => s + g.quantity, 0)

  return NextResponse.json({
    event: {
      id: event.id,
      eventDate: event.event_date,
      nightName: event.night_name,
      nightSlug: event.night_slug,
      isOpen: event.is_open,
      meetUpLocation: event.meet_up_location,
      whatsappGroupLink: event.whatsapp_group_link,
      venueRoute: event.venue_route,
      vanOrTaxiContact: event.van_or_taxi_contact,
      specialNotes: event.special_notes,
      operationVerdict: event.operation_verdict,
    },
    guests,
    headcount: { total: totalGuests, checkedIn: checkedInGuests },
    expenses: expenses ?? [],
  })
}
