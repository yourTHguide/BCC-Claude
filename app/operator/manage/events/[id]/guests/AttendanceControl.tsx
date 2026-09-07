'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { operatorTheme as T } from '@/lib/operator/theme'

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  checked_in: { color: T.statusGreen, bg: T.statusGreenSoft },
  expected: { color: T.statusBlue, bg: T.statusBlueSoft },
  no_show: { color: T.statusRed, bg: T.statusRedSoft },
}

// Reuses POST /api/update-attendance exactly — same route, same
// booking-level semantics the audit confirmed (a quantity>1 booking checks
// in as one unit, no per-guest sub-state). No new endpoint.
export default function AttendanceControl({
  table,
  id,
  status,
}: {
  table: 'bookings' | 'ota_bookings'
  id: string
  status: 'expected' | 'checked_in' | 'no_show'
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function setStatus(next: string) {
    if (next === status) return
    setSaving(true)
    try {
      await fetch('/api/update-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, status: next }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const s = STATUS_COLOR[status] ?? STATUS_COLOR.expected

  return (
    <select
      value={status}
      disabled={saving}
      onChange={(e) => setStatus(e.target.value)}
      style={{
        fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', border: 'none',
        color: s.color, background: s.bg, flexShrink: 0,
      }}
    >
      <option value="expected">Expected</option>
      <option value="checked_in">Checked in</option>
      <option value="no_show">No-show</option>
    </select>
  )
}
