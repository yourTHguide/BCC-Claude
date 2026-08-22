'use client'

// "Quick Facts" — derived, but no longer a dead end. Every value here is
// still computed the same way ProductPage.tsx derives it (no second data
// model, no quick_facts column, no quick-facts editor route) — what changed
// is that each row is now a shortcut into the ONE canonical field that
// actually controls it:
//   Next Date   -> Schedule tab (Event Dates)
//   Start Time  -> products.default_start_time (Overview tab)
//   Price       -> products.default_price (Overview tab)
//   Duration    -> product_content.duration_minutes (this tab's Basics section)
// A missing value shows "Not set" and is still tappable — derived does not
// mean inaccessible.

import { M } from './styles'

function baht(n: number | null): string | null {
  if (n == null) return null
  return `฿${n.toLocaleString()}`
}

function hhmm(t: string | null): string | null {
  if (!t) return null
  return t.slice(0, 5)
}

function durationLabel(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

function formatEventDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export interface QuickFactsInput {
  defaultPrice: number | null
  defaultStartTime: string | null
  durationMinutes: number | null
  nextOpenDate: string | null
  onTapNextDate: () => void
  onTapStartTime: () => void
  onTapPrice: () => void
  onTapDuration: () => void
}

export default function QuickFacts({
  defaultPrice,
  defaultStartTime,
  durationMinutes,
  nextOpenDate,
  onTapNextDate,
  onTapStartTime,
  onTapPrice,
  onTapDuration,
}: QuickFactsInput) {
  const rows: { label: string; value: string; onTap: () => void }[] = [
    { label: 'Next Date', value: nextOpenDate ? formatEventDate(nextOpenDate) : 'Not set', onTap: onTapNextDate },
    { label: 'Start Time', value: hhmm(defaultStartTime) ?? 'Not set', onTap: onTapStartTime },
    { label: 'Price', value: baht(defaultPrice) ?? 'Not set', onTap: onTapPrice },
    { label: 'Duration', value: durationLabel(durationMinutes) ?? 'Not set', onTap: onTapDuration },
  ]

  return (
    <div style={{ marginBottom: '18px' }}>
      <p style={M.quickFactsLabel}>Quick Facts</p>
      <p style={M.quickFactsHint}>Auto-generated from schedule, time, duration and price. Tap any value to edit it where it&rsquo;s controlled.</p>
      <div style={M.listCard}>
        {rows.map((row, i) => (
          <button
            key={row.label}
            type="button"
            style={{ ...M.row(), ...(i === rows.length - 1 ? { borderBottom: 'none' } : {}) }}
            onClick={row.onTap}
          >
            <span style={M.rowLabel}>{row.label}</span>
            <span style={M.rowSummary}>
              {row.value}
              <span style={M.chevron}>›</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
