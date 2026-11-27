// Phase 3D vans (Nov 2026). Owner rules:
// - 10 guests + 1 host per van. Van 1 runs at 5 guests, van 2 at 4.
// - Everyone pays upfront; van 2 sells until the owner closes it.
// - Groups are never split: a party goes to van 1 if it fits whole, else van 2.
//   Seats aren't fixed; hosts can swap people on the night.
// - 7 PM: go / no-go for the night. 8 PM: reminder only if van 2 is still open
//   with guests. The owner decides; nothing is cancelled automatically.
// The capacity column stays the one seat gate: 2 vans = 20, 1 van = 10.

export const VAN_SEATS = 10
export const VAN_MIN = { 1: 5, 2: 4 } as const

export interface Party { id: string; table: 'bookings' | 'ota_bookings'; quantity: number; createdAt: string }

export interface VanSplit {
  van1: Party[]
  van2: Party[]
  over: Party[]          // more guests than seats (e.g. OTA oversold)
  van1Guests: number
  van2Guests: number
}

// Booking order; a party goes in van 1 if it fits whole, otherwise van 2.
export function splitVans(parties: Party[], vanCount: number): VanSplit {
  const sorted = [...parties].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
  const out: VanSplit = { van1: [], van2: [], over: [], van1Guests: 0, van2Guests: 0 }
  for (const p of sorted) {
    if (out.van1Guests + p.quantity <= VAN_SEATS) { out.van1.push(p); out.van1Guests += p.quantity }
    else if (vanCount >= 2 && out.van2Guests + p.quantity <= VAN_SEATS) { out.van2.push(p); out.van2Guests += p.quantity }
    else out.over.push(p)
  }
  return out
}

export interface VanStatus {
  vanCount: number
  van1: { guests: number; min: number; ok: boolean }
  van2: { guests: number; min: number; ok: boolean; state: 'open' | 'running' | 'closed' } | null
  over: number
  needsDecision: boolean  // van 1 short, or van 2 has guests and is still open
}

export function vanStatus(split: VanSplit, vanCount: number, van2State: 'open' | 'running' | 'closed'): VanStatus {
  const van1 = { guests: split.van1Guests, min: VAN_MIN[1], ok: split.van1Guests >= VAN_MIN[1] }
  const van2 = vanCount >= 2 ? { guests: split.van2Guests, min: VAN_MIN[2], ok: split.van2Guests >= VAN_MIN[2], state: van2State } : null
  return {
    vanCount, van1, van2, over: split.over.reduce((s, p) => s + p.quantity, 0),
    needsDecision: !van1.ok || (!!van2 && van2.guests > 0 && van2.state === 'open'),
  }
}

// Capacity that matches the van setting. Closing van 2 keeps the seats already
// sold (so nobody is pushed out) and stops further sales.
export function capacityFor(vanCount: number | null, van2State: string, taken: number, legacy = 12): number {
  if (!vanCount) return legacy
  if (vanCount === 1) return VAN_SEATS
  return van2State === 'closed' ? Math.max(VAN_SEATS, taken) : VAN_SEATS * 2
}

// What the booking page tells guests (public): seats only when low, plus the
// van 2 unlock message. Based on the total taken (exact grouping is the host's job).
export function vanMessage(vanCount: number | null, van2State: string, capacity: number | null, taken: number): string | null {
  const left = capacity != null ? Math.max(0, capacity - taken) : null
  if (!vanCount) return left != null && left > 0 && left <= 4 ? `🔥 Only ${left} spot${left === 1 ? '' : 's'} left` : null
  const van1Left = Math.max(0, VAN_SEATS - taken)
  if (van1Left > 0) return van1Left <= 4 ? `🔥 Only ${van1Left} spot${van1Left === 1 ? '' : 's'} left in Van 1` : null
  if (vanCount < 2 || van2State === 'closed') return null
  const van2Guests = taken - VAN_SEATS
  if (van2Guests < VAN_MIN[2]) {
    const need = VAN_MIN[2] - van2Guests
    return `🚐 Van 1 is full! Book your spot in Van 2 — just need ${need} more and it’s on`
  }
  return left != null && left <= 4 ? `Van 2 is rolling! 🎉 Only ${left} spot${left === 1 ? '' : 's'} left` : 'Van 2 is rolling! 🎉'
}
