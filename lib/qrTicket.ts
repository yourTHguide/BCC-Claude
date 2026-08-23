import QRCode from 'qrcode'

// Renders a booking's check-in QR as a PNG data URI, ready for <img src>.
// Server-side only (the `qrcode` npm package, fully local) — never call a
// third-party QR-generation API, which would leak the check-in URL/token to
// an outside service. Callers pass a fully-formed check-in URL that already
// carries only the app origin + the opaque ticket_token — never PII, the
// booking's UUID, or a Stripe identifier (see lib/tickets.ts).
export async function generateTicketQrDataUrl(checkinUrl: string): Promise<string> {
  return QRCode.toDataURL(checkinUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: { dark: '#1A0015', light: '#FFFFFF' },
  })
}
