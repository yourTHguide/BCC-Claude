// Canonical Booking → Event Instance → Product resolution, keyed by the
// opaque ticket_token. This is the shared foundation both the customer-facing
// ticket page (app/ticket/[token]) and the admin check-in resolver
// (app/api/admin/checkin/[token]) build on — the intent is that ANY future
// consumer (a future SNX Mobile Operations UI included) resolves a booking
// through this one function rather than re-deriving the join logic, so the
// underlying booking/check-in contract stays stable even as the UI around it
// changes.
//
// event_id/product_id are only present for bookings made through the dynamic
// checkout path (Stage 6+; every New in Bangkok booking has them). A
// pre-Stage-9b or legacy-path booking still resolves — just with
// productName falling back to the booking's own stored night_name, no
// startTime/meetingPointRaw/durationMinutes.
export interface ResolvedBooking {
  id: string
  guestName: string | null
  guestEmail: string | null
  quantity: number
  totalPaid: number
  status: string // confirmed | cancelled | refunded | no_show
  attendanceStatus: string // expected | checked_in | no_show
  eventDate: string
  ticketToken: string | null
  productName: string
  productSlug: string | null
  startTime: string | null
  durationMinutes: number
  meetingPointRaw: unknown | null
}

// `supabase` is intentionally untyped (`any`) — getServiceSupabase() returns
// an ungenerated (no Database<> generic) client throughout this codebase, so
// every other server-side query file (webhook, create-checkout, the admin
// routes) already treats rows as `any` rather than fighting supabase-js's
// default generic inference; this matches that existing convention.
export async function resolveBookingByToken(
  supabase: any,
  token: string
): Promise<ResolvedBooking | null> {
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id, event_id, product_id, night_name, event_date, guest_name, guest_email, ' +
        'quantity, total_paid, status, attendance_status, ticket_token'
    )
    .eq('ticket_token', token)
    .maybeSingle()

  if (!booking) return null

  let productName = booking.night_name
  let productSlug: string | null = null
  let startTime: string | null = null
  let durationMinutes = 180
  let meetingPointRaw: unknown | null = null

  if (booking.event_id && booking.product_id) {
    const [{ data: event }, { data: product }, { data: content }] = await Promise.all([
      supabase.from('event_dates').select('start_time_override').eq('id', booking.event_id).maybeSingle(),
      supabase.from('products').select('slug, name, default_start_time').eq('id', booking.product_id).maybeSingle(),
      supabase
        .from('product_content')
        .select('meeting_point, duration_minutes')
        .eq('product_id', booking.product_id)
        .maybeSingle(),
    ])
    if (product) {
      productName = product.name
      productSlug = product.slug
      startTime = event?.start_time_override ?? product.default_start_time
    }
    if (content) {
      durationMinutes = content.duration_minutes || 180
      meetingPointRaw = content.meeting_point
    }
  }

  return {
    id: booking.id,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    quantity: booking.quantity,
    totalPaid: booking.total_paid,
    status: booking.status,
    attendanceStatus: booking.attendance_status,
    eventDate: booking.event_date,
    ticketToken: booking.ticket_token,
    productName,
    productSlug,
    startTime,
    durationMinutes,
    meetingPointRaw,
  }
}
