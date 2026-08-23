// Display-only booking reference, e.g. "NIB-4A78E2". Derived deterministically
// from the product slug + booking id — NOT a stored column and NEVER used
// for lookup (resolution is always by ticket_token or Stripe session id).
// Purely a short, human-readable label for the ticket/email UI.
export function formatBookingReference(productSlug: string | null, bookingId: string): string {
  const prefix = (productSlug || 'BK').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'BK'
  const fragment = bookingId.replace(/-/g, '').slice(-6).toUpperCase()
  return `${prefix}-${fragment}`
}
