'use client'

// Read-only, derived-only "Quick Facts" surface for the mobile shell. This
// is NOT an editor and never will be one in Stage A — Quick Facts is
// computed from the Product's schedule/price and content.duration_minutes,
// exactly like ProductPage.tsx's own Quick Facts block. There is no
// quick_facts column and no quick-facts editor route; this component only
// re-derives the same values the public page already derives, so an admin
// can see at a glance what the public page will show without duplicating
// the source of truth.

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
}

export default function QuickFacts({ defaultPrice, defaultStartTime, durationMinutes, nextOpenDate }: QuickFactsInput) {
  const facts: { label: string; value: string }[] = []
  if (nextOpenDate) facts.push({ label: 'Next Date', value: formatEventDate(nextOpenDate) })
  const timeLabel = hhmm(defaultStartTime)
  if (timeLabel) facts.push({ label: 'Start Time', value: timeLabel })
  const durLabel = durationLabel(durationMinutes)
  if (durLabel) facts.push({ label: 'Duration', value: durLabel })
  const priceLabel = baht(defaultPrice)
  if (priceLabel) facts.push({ label: 'Price', value: `${priceLabel} / person` })

  return (
    <div style={M.quickFactsCard}>
      <p style={M.quickFactsLabel}>Quick Facts</p>
      <p style={M.quickFactsHint}>Auto-generated from schedule, time, duration and price — read-only, not editable here.</p>
      {facts.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
          Nothing to show yet — set a default price/time on the Overview tab and a duration under Basics.
        </p>
      ) : (
        <div style={M.quickFactsGrid}>
          {facts.map((f) => (
            <div key={f.label}>
              <p style={M.quickFactItemLabel}>{f.label}</p>
              <p style={M.quickFactItemValue}>{f.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
