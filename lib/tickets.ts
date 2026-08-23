import { randomBytes } from 'crypto'

// Opaque booking-level ticket token (Stage 9). 24 random bytes (192 bits) —
// collision probability is negligible, so callers insert once with no
// retry-on-conflict loop (bookings.ticket_token has a UNIQUE index; a
// collision would surface as a Postgres 23505 error, not a silent one).
// base64url avoids any escaping when the token ends up in a QR payload URL
// or a path segment (Stage 9c/9d).
//
// MVP semantics: one Booking = one token = one QR, representing the whole
// booking including its `quantity`. There is no per-guest token yet.
export function generateTicketToken(): string {
  return randomBytes(24).toString('base64url')
}
