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
  // Product-driven optional content (Stage 9, confirmation-email refactor) —
  // empty arrays, never a default/placeholder value, when the Product has no
  // canonical content for that section (or no event_id/product_id at all).
  // Consumers must render nothing for an empty array, never fall back to
  // hardcoded per-product copy.
  itinerary: { title: string; description: string }[]
  // `unknown[]` deliberately, not `string[]` — real production data for
  // New in Bangkok stores `{icon, text}` objects here (from a separate,
  // not-yet-merged branch's icon-system work), while this branch's
  // ProductPage.tsx still types this column as `string[]`. Rather than
  // assume either shape is the only one that will ever exist, consumers
  // must extract display text defensively (see whatsIncludedText() in
  // emails/confirmation.ts) instead of rendering the raw value.
  whatsIncluded: unknown[]
  whatsNotIncluded: string[]
  importantInfo: string[]
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
  let itinerary: { title: string; description: string }[] = []
  let whatsIncluded: unknown[] = []
  let whatsNotIncluded: string[] = []
  let importantInfo: string[] = []

  if (booking.event_id && booking.product_id) {
    const [{ data: event }, { data: product }, { data: content }] = await Promise.all([
      supabase.from('event_dates').select('start_time_override').eq('id', booking.event_id).maybeSingle(),
      supabase.from('products').select('slug, name, default_start_time').eq('id', booking.product_id).maybeSingle(),
      supabase
        .from('product_content')
        .select('meeting_point, duration_minutes, itinerary, whats_included, whats_not_included, important_info')
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
      itinerary = content.itinerary ?? []
      whatsIncluded = content.whats_included ?? []
      whatsNotIncluded = content.whats_not_included ?? []
      importantInfo = content.important_info ?? []
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
    itinerary,
    whatsIncluded,
    whatsNotIncluded,
    importantInfo,
  }
}
