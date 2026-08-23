export interface RevealedMeetingPoint {
  visibility: 'public' | 'after_booking'
  display_name: string | null
  address: string | null
  maps_url: string | null
  instructions: string | null
}

// Post-purchase meeting-point disclosure (Stage 9c ticket page + Stage 9d
// check-in resolver). Deliberately different from the PRE-purchase gate in
// app/api/products/[slug]/route.ts (which nulls out 'after_booking' entirely,
// carrying zero location fields) — this function is only ever called once a
// valid ticket_token has already resolved a real Booking, which is itself
// the "after booking" moment. So here, both 'public' AND 'after_booking'
// reveal full location details.
//
// 'private' (and unset '{}' / any invalid value) still reveal NOTHING in any
// context, including here — that tier means "never disclose electronically
// through this system", not "disclose once booked". The host coordinates
// those manually (WhatsApp / meetup email), unchanged by Stage 9.
//
// Do not call this from anything reachable WITHOUT a resolved ticket_token
// (e.g. never wire this into the public product page or its read API) — see
// the caution in the Stage 9 architecture audit against leaking
// after_booking/private info through a public resolver.
export function revealMeetingPointForTicket(raw: unknown): RevealedMeetingPoint | null {
  if (!raw || typeof raw !== 'object') return null
  const mp = raw as Record<string, unknown>

  if (mp.visibility === 'public' || mp.visibility === 'after_booking') {
    return {
      visibility: mp.visibility,
      display_name: typeof mp.display_name === 'string' ? mp.display_name : null,
      address: typeof mp.address === 'string' ? mp.address : null,
      maps_url: typeof mp.maps_url === 'string' ? mp.maps_url : null,
      instructions: typeof mp.instructions === 'string' ? mp.instructions : null,
    }
  }

  return null
}
