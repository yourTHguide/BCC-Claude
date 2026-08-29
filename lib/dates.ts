// Today's calendar date in Asia/Bangkok (YYYY-MM-DD), matching /api/events'
// availability cutoff so "future"/"upcoming" mean the same thing everywhere.
export function bangkokToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Add N days to a YYYY-MM-DD date using UTC math (no timezone drift).
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

// Friendly long-form label for a YYYY-MM-DD date, e.g. "Tuesday, 1 September
// 2026". Parses into LOCAL date components (not `new Date(iso)`, which parses
// as UTC midnight and can roll the date back a day depending on server TZ) —
// same fix already applied ad hoc in app/api/create-checkout/route.ts;
// centralized here for new call sites (Stage 9c ticket page) to share.
export function formatEventDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  return dateObj.toLocaleDateString('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// HH:MM (24h) from a Postgres TIME string ("20:30:00" or "20:30"). Matches
// the slice-based convention already used by ProductPage's local `hhmm`.
export function formatStartTime(time: string | null): string | null {
  if (!time) return null
  return time.slice(0, 5)
}

// 12h "8:30 PM" from a Postgres TIME string ("20:30:00" or "20:30") — the
// same conversion app/book/BookingCalendarClient.tsx's local `formatTime`
// already does (minus its "– Late" suffix), centralized here so a new
// caller doesn't need to re-derive it inline.
export function formatStartTime12h(time: string | null): string | null {
  if (!time) return null
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  if (Number.isNaN(h)) return null
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${mStr} ${ampm}`
}
