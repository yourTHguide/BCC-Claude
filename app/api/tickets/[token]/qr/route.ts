import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { generateTicketQrPngBuffer } from '@/lib/qrTicket'
import { getAppUrl } from '@/lib/appUrl'

export const dynamic = 'force-dynamic'

// Remote QR image for the confirmation email (Stage 9g) — public,
// unauthenticated, same trust model as /ticket/[token]: the opaque token
// IS the credential, and the only thing encoded is the app origin + that
// same token (never PII, a booking UUID, or a Stripe identifier). A light
// existence check keeps this from rendering a scannable image for a token
// that was never actually issued, matching the uniform-404 convention used
// everywhere else a token is resolved.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const supabase = getServiceSupabase()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('ticket_token', params.token)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // See lib/appUrl.ts — resolves to THIS deployment's own host on Preview
  // (so the encoded URL is actually reachable pre-merge) and to
  // bkkclubcrawl.com on production, matching /ticket/[token]'s own QR
  // exactly (same function, same inputs, so they can never diverge).
  const appUrl = getAppUrl()
  const checkinUrl = `${appUrl}/dashboard/checkin/${params.token}`
  const png = await generateTicketQrPngBuffer(checkinUrl)

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      // Immutable — a given token always encodes the same URL, so this can
      // be cached hard by mail clients/proxies without ever going stale.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
