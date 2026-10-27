import { formatBookingReference } from '@/lib/bookingReference'

export type AttendanceStatus = 'expected' | 'checked_in' | 'no_show'

// One row of the door list: a booking (direct, with a QR ticket) or an OTA
// booking (checked in by name). Deliberately carries no revenue fields so the
// same loader is safe for the Host (staff) view.
export interface DoorGuest {
  id: string
  table: 'bookings' | 'ota_bookings'
  name: string
  quantity: number
  source: string
  status: AttendanceStatus
  email: string | null
  phone: string | null
  ref: string | null
  notes: string | null
  attendeeNames: string[]
}

// supabase is the untyped service client used across the codebase's server code.
export async function loadDoorGuests(
  supabase: any,
  eventDate: string,
  nightSlug: string
): Promise<{ guests: DoorGuest[]; error: any }> {
  const [b, o] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, product_id, guest_name, guest_email, guest_phone, guest_whatsapp, quantity, source, attendance_status, ticket_token, notes, booking_attendees(full_name, position)'
      )
      .eq('event_date', eventDate)
      .eq('night_slug', nightSlug)
      .eq('status', 'confirmed'),
    supabase
      .from('ota_bookings')
      .select('id, guest_name, guest_email, quantity, source, attendance_status, notes')
      .eq('event_date', eventDate)
      .eq('night_slug', nightSlug),
  ])
  if (b.error || o.error) return { guests: [], error: b.error || o.error }

  const productIds = Array.from(new Set((b.data ?? []).map((x: any) => x.product_id).filter(Boolean)))
  const slugById = new Map<string, string>()
  if (productIds.length) {
    const { data: products } = await supabase.from('products').select('id, slug').in('id', productIds)
    for (const p of products ?? []) slugById.set(p.id, p.slug)
  }

  const guests: DoorGuest[] = [
    ...(b.data ?? []).map((x: any) => ({
      id: x.id,
      table: 'bookings' as const,
      name: x.guest_name || x.guest_email || 'Guest',
      quantity: x.quantity,
      source: x.source || 'website',
      status: x.attendance_status,
      email: x.guest_email || null,
      phone: x.guest_whatsapp || x.guest_phone || null,
      ref: x.ticket_token ? formatBookingReference(slugById.get(x.product_id) ?? null, x.id) : null,
      notes: x.notes || null,
      attendeeNames: [...(x.booking_attendees ?? [])]
        .sort((p: any, q: any) => p.position - q.position)
        .map((a: any) => a.full_name as string),
    })),
    ...(o.data ?? []).map((x: any) => ({
      id: x.id,
      table: 'ota_bookings' as const,
      name: x.guest_name || 'Guest',
      quantity: x.quantity,
      source: x.source,
      status: x.attendance_status,
      email: x.guest_email || null,
      phone: null,
      ref: null,
      notes: x.notes || null,
      attendeeNames: [],
    })),
  ].sort((p, q) => p.name.trim().localeCompare(q.name.trim(), 'en', { sensitivity: 'base' }))

  return { guests, error: null }
}
