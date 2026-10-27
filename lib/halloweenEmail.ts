import { formatBookingReference } from '@/lib/bookingReference'
import {
  HALLOWEEN_EVENT,
  generateHalloweenConfirmationEmail,
  halloweenEmailSubject,
} from '@/emails/halloween-confirmation'

// Stored in bookings.notes when the confirmation goes out, so the admin page
// can show who has been emailed (and avoid double-sending) without a new table.
export const SENT_MARKER = 'halloween-confirmation-sent'

export interface HalloweenRecipient {
  id: string
  name: string
  email: string
  quantity: number
  reference: string
  sentAt: string | null
}

// supabase is the untyped service client used across the codebase's server code.
export async function loadHalloweenBookings(supabase: any) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, guest_name, guest_email, quantity, ticket_token, notes, status')
    .eq('night_slug', HALLOWEEN_EVENT.nightSlug)
    .neq('status', 'cancelled')
    .not('ticket_token', 'is', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as any[]
}

export function sentAtFromNotes(notes: string | null): string | null {
  const m = notes?.match(new RegExp(`\\[${SENT_MARKER} ([^\\]]+)\\]`))
  return m ? m[1] : null
}

export function toRecipient(b: any): HalloweenRecipient {
  return {
    id: b.id,
    name: b.guest_name || 'Guest',
    email: b.guest_email,
    quantity: b.quantity,
    reference: formatBookingReference(HALLOWEEN_EVENT.nightSlug, b.id),
    sentAt: sentAtFromNotes(b.notes),
  }
}

export function buildHalloweenEmail(b: any) {
  return {
    subject: halloweenEmailSubject(b.guest_name),
    html: generateHalloweenConfirmationEmail({
      guestName: b.guest_name || 'Guest',
      quantity: b.quantity,
      ticket: {
        token: b.ticket_token,
        reference: formatBookingReference(HALLOWEEN_EVENT.nightSlug, b.id),
      },
    }),
  }
}
