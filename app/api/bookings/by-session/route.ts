import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Polled by the client-side /booking-success page immediately after Stripe
// redirects back. The webhook (async, server-to-server from Stripe) may not
// have finished writing the booking yet at that point, so this returns
// `pending: true` — never a 404 — until the row (and its ticket_token) shows
// up; the page retries on a short interval rather than treating "not found
// yet" as an error.
//
// Looked up by Stripe's own checkout session id, which is unpredictable and
// known only to the customer who just completed checkout — the same trust
// model the pre-Stage-9 success page already used for this exact value.
// Returns ONLY the ticket_token (the stable handle for /ticket/[token]) —
// never guest PII or internal booking/event/product ids.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('bookings')
    .select('ticket_token, total_paid, quantity, price_tier, night_slug, night_name')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()

  if (error) {
    console.error('bookings/by-session: query error:', error)
    return NextResponse.json({ pending: true })
  }

  // No row yet (webhook hasn't run) or a token-less row (pre-Stage-9b
  // booking, which cannot happen for a fresh session but is handled the same
  // way defensively) — both look identical to the poller: keep waiting.
  if (!data || !data.ticket_token) {
    return NextResponse.json({ pending: true })
  }

  // Return additional booking fields needed for client-side pixel tracking.
  // These are non-PII operational values — no guest name, email, phone, or
  // internal IDs are returned, matching the trust model described above.
  return NextResponse.json({
    pending: false,
    ticketToken: data.ticket_token,
    totalPaid: (data.total_paid ?? null) as number | null,
    quantity: (data.quantity ?? null) as number | null,
    priceTier: (data.price_tier ?? null) as string | null,
    nightSlug: (data.night_slug ?? null) as string | null,
    nightName: (data.night_name ?? null) as string | null,
  })
}
