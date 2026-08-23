// "Add to calendar" helpers (Stage 9c) — no external service, no API key.
// Google gets a pre-filled render link (just a URL); everything else
// (Apple Calendar, Outlook) gets a downloadable .ics data URI, the standard
// interchange format both understand natively.

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toUtcBasic(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

// Bangkok is UTC+7 year-round (no DST) — safe to hardcode the offset rather
// than pull in a timezone library for one conversion.
function bangkokLocalToUtc(eventDate: string, time: string): Date {
  const [y, m, d] = eventDate.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0))
}

interface CalendarEventInput {
  title: string
  eventDate: string // YYYY-MM-DD, Bangkok-local
  startTime: string // HH:MM, Bangkok-local
  durationMinutes: number
  location?: string | null
  details?: string
}

export function googleCalendarUrl(opts: CalendarEventInput): string {
  const start = bangkokLocalToUtc(opts.eventDate, opts.startTime)
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${toUtcBasic(start)}/${toUtcBasic(end)}`,
    details: opts.details || '',
    location: opts.location || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function icsDataUrl(opts: CalendarEventInput & { uid: string }): string {
  const start = bangkokLocalToUtc(opts.eventDate, opts.startTime)
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000)
  const escape = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BEST Nightlife//Ticket//EN',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@bkkclubcrawl.com`,
    `DTSTAMP:${toUtcBasic(new Date())}`,
    `DTSTART:${toUtcBasic(start)}`,
    `DTEND:${toUtcBasic(end)}`,
    `SUMMARY:${escape(opts.title)}`,
    opts.location ? `LOCATION:${escape(opts.location)}` : '',
    opts.details ? `DESCRIPTION:${escape(opts.details)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`
}
