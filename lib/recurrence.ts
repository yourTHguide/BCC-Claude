// Pure recurrence generator (Phase 4 Stage 3).
//
// No I/O, no DB, no framework imports — deterministic and unit-testable. It is
// isomorphic: the Create Product UI uses it for a live preview, and Stage 4's
// server-side generation will call the SAME function so the dates that are
// previewed are exactly the dates that get materialized. All date math is done
// in UTC so results never drift with the server's timezone (event_date is a
// calendar DATE, so wall-clock time is irrelevant).

// 0=Sunday .. 6=Saturday, matching JS Date.getUTCDay().
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export interface OnceRule {
  freq: 'once'
  date: string // YYYY-MM-DD
}
export interface WeeklyRule {
  freq: 'weekly'
  weekday: Weekday
  startDate: string // YYYY-MM-DD, inclusive lower bound
  untilDate?: string | null // YYYY-MM-DD inclusive; when set, overrides the horizon
  horizonWeeks?: number // used only when untilDate is absent; default 12
}
export type RecurrenceRule = OnceRule | WeeklyRule

export const DEFAULT_HORIZON_WEEKS = 12
// Safety cap so a far-future through-date can't produce an unbounded list.
export const MAX_OCCURRENCES = 366

export interface RecurrenceResult {
  dates: string[] // YYYY-MM-DD, ascending, unique
  count: number
  truncated: boolean // true if MAX_OCCURRENCES was hit
  effectiveUntil: string | null // last generated date (for "through …" display)
  error: string | null // human-readable reason the result is empty, if any
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function isValidISO(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  // Reject impossible dates (e.g. 2026-02-30 rolling over).
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function parseUTC(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function formatUTC(ms: number): string {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function empty(error: string): RecurrenceResult {
  return { dates: [], count: 0, truncated: false, effectiveUntil: null, error }
}

export function generateOccurrences(rule: RecurrenceRule): RecurrenceResult {
  if (!rule || (rule.freq !== 'once' && rule.freq !== 'weekly')) {
    return empty('Unknown recurrence type.')
  }

  if (rule.freq === 'once') {
    if (!isValidISO(rule.date)) return empty('Choose a valid date.')
    return { dates: [rule.date], count: 1, truncated: false, effectiveUntil: rule.date, error: null }
  }

  // weekly
  if (!Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6) {
    return empty('Choose a day of the week.')
  }
  if (!isValidISO(rule.startDate)) return empty('Choose a valid start date.')

  const startMs = parseUTC(rule.startDate)
  // First occurrence on/after the start date that lands on the chosen weekday.
  const startDow = new Date(startMs).getUTCDay()
  const delta = (rule.weekday - startDow + 7) % 7
  const firstMs = startMs + delta * DAY_MS

  let endMs: number
  const hasUntil = rule.untilDate != null && rule.untilDate !== ''
  if (hasUntil) {
    if (!isValidISO(rule.untilDate)) return empty('Choose a valid generate-through date.')
    endMs = parseUTC(rule.untilDate as string)
    if (endMs < firstMs) {
      return empty('The generate-through date is before the first occurrence.')
    }
  } else {
    const weeks = Number.isInteger(rule.horizonWeeks) && (rule.horizonWeeks as number) > 0
      ? (rule.horizonWeeks as number)
      : DEFAULT_HORIZON_WEEKS
    // Inclusive: weeks occurrences → first + (weeks-1)*7 days.
    endMs = firstMs + (weeks - 1) * 7 * DAY_MS
  }

  const dates: string[] = []
  let truncated = false
  for (let ms = firstMs; ms <= endMs; ms += 7 * DAY_MS) {
    if (dates.length >= MAX_OCCURRENCES) {
      truncated = true
      break
    }
    dates.push(formatUTC(ms))
  }

  if (dates.length === 0) return empty('No dates in the selected range.')
  return {
    dates,
    count: dates.length,
    truncated,
    effectiveUntil: dates[dates.length - 1],
    error: null,
  }
}
