import type { DoorGuest } from '@/lib/doorList'

// Host after-event report (Nov 2026). Owner rules:
// - The assigned host writes it after the night; no deadline. Draft until
//   submitted; submitted reports are locked for the host (owner can still read).
// - Guests: a blank comment box plus quick tags the host can ask about on the
//   night (still travelling + next stop, coming back, VIP interest, other
//   events, great guest, issue). Internal service notes, not for marketing.
// - Venues: one short comment per venue on the route (no star ratings).
// - Incidents: type, what happened, what was done. The owner is emailed.
// - Host pay is only ready once the report is submitted; the owner sets the
//   fee after reviewing check-ins and approving expenses.

export const GUEST_TAGS: { key: string; label: string }[] = [
  { key: 'travelling', label: '🧳 Still travelling' },
  { key: 'returning', label: '🔁 Coming back to Bangkok' },
  { key: 'vip', label: '🍾 Interested in VIP tables / bottles' },
  { key: 'events', label: '🎉 Interested in other events' },
  { key: 'great', label: '⭐ Great guest' },
  { key: 'issue', label: '⚠ Issue' },
]
export const INCIDENT_TYPES: { key: string; label: string }[] = [
  { key: 'medical', label: 'Medical' },
  { key: 'security', label: 'Security / police' },
  { key: 'entry_refused', label: 'Venue refused entry' },
  { key: 'lost_item', label: 'Lost item' },
  { key: 'behaviour', label: 'Guest behaviour' },
  { key: 'other', label: 'Other' },
]
export const HOST_EXPENSE_CATEGORIES: { key: string; label: string; ledger: string }[] = [
  // ledger = the category used in the existing `expenses` table once approved
  { key: 'taxi', label: 'Taxi / Grab', ledger: 'extra' },
  { key: 'van', label: 'Van', ledger: 'van' },
  { key: 'drinks', label: 'Drinks for guests', ledger: 'drinks' },
  { key: 'entry', label: 'Entry / cover charge', ledger: 'cover_charge' },
  { key: 'other', label: 'Other', ledger: 'extra' },
]

const TAG_KEYS = new Set(GUEST_TAGS.map((t) => t.key))
const INCIDENT_KEYS = new Set(INCIDENT_TYPES.map((t) => t.key))
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '')

export interface ReportGuest { key: string; name: string; quantity: number; attendance: string; tags: string[]; nextStop: string; comment: string }
export interface ReportVenue { venue: string; comment: string }
export interface ReportIncident { type: string; what: string; action: string }
export interface ReportBody { vibe: string; guests: ReportGuest[]; venues: ReportVenue[]; incidents: ReportIncident[] }

export function routeVenues(venueRoute: Record<string, string> | null | undefined): string[] {
  return ['venue1', 'venue2', 'venue3', 'venue4'].map((k) => (venueRoute?.[k] ?? '').trim()).filter(Boolean)
}

export const guestKey = (g: Pick<DoorGuest, 'table' | 'id'>) => `${g.table}:${g.id}`

// A blank report for the night, pre-filled with the guest list and route.
export function blankReport(guests: DoorGuest[], venues: string[]): ReportBody {
  return {
    vibe: '',
    guests: guests.map((g) => ({ key: guestKey(g), name: g.name, quantity: g.quantity, attendance: g.status, tags: [], nextStop: '', comment: '' })),
    venues: venues.map((venue) => ({ venue, comment: '' })),
    incidents: [],
  }
}

// Cleans what the browser sends. Guests are matched to the night's real guest
// list (names and attendance come from the server, never the client); the
// host's notes are kept only for guests on that list.
export function cleanReport(input: any, guests: DoorGuest[], venues: string[]): ReportBody {
  const sent = new Map<string, any>((Array.isArray(input?.guests) ? input.guests : []).map((g: any) => [String(g?.key ?? ''), g]))
  const venueIn = new Map<string, any>((Array.isArray(input?.venues) ? input.venues : []).map((v: any) => [String(v?.venue ?? ''), v]))
  const incidents = (Array.isArray(input?.incidents) ? input.incidents : []).slice(0, 10)
    .map((i: any) => ({ type: INCIDENT_KEYS.has(i?.type) ? i.type : 'other', what: text(i?.what, 2000), action: text(i?.action, 2000) }))
    .filter((i: ReportIncident) => i.what)
  return {
    vibe: text(input?.vibe, 3000),
    guests: guests.map((g) => {
      const s = sent.get(guestKey(g)) ?? {}
      const tags = Array.from(new Set((Array.isArray(s.tags) ? s.tags : []).map(String))).filter((t) => TAG_KEYS.has(t as string)) as string[]
      return { key: guestKey(g), name: g.name, quantity: g.quantity, attendance: g.status, tags, nextStop: tags.includes('travelling') ? text(s.nextStop, 120) : '', comment: text(s.comment, 1000) }
    }),
    venues: venues.map((venue) => ({ venue, comment: text(venueIn.get(venue)?.comment, 1000) })),
    incidents,
  }
}

// What must be in place before Submit.
export function submitProblems(r: ReportBody): string[] {
  const p: string[] = []
  if (r.vibe.length < 3) p.push('Write a line about the overall vibe.')
  return p
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

// Assigned host, or the owner/admin (who can also use the host view).
export function canWorkNight(admin: { role: string; displayName: string | null }, hostAssigned: string | null): boolean {
  return admin.role !== 'staff' || (!!admin.displayName && hostAssigned === admin.displayName)
}

export const RECEIPT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf',
}
export const RECEIPT_MAX_BYTES = 4 * 1024 * 1024 // Vercel request limit is 4.5 MB
