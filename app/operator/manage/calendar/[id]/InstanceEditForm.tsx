'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HOSTS } from '@/lib/operator/eventOps'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

// Two routes, deliberately — matches the exact ownership split confirmed in
// SNX_PHASE2B_CALENDAR_INSTANCES_PLAN.md §1: capacity/priceOverride/
// startTimeOverride/isOpen are owned by /api/admin/events/[id]
// (requireRole owner/admin); hostAssigned is owned by
// /api/admin/dashboard/events/[id] (requireAdmin) — the same route Phase
// 2A's Overview already writes it through. Not a new pattern.
export default function InstanceEditForm({
  id,
  isOpen,
  capacity,
  priceOverride,
  defaultPrice,
  startTime24,
  hostAssigned,
}: {
  id: string
  isOpen: boolean
  capacity: number | null
  priceOverride: number | null
  defaultPrice: number | null
  startTime24: string | null
  hostAssigned: string | null
}) {
  const router = useRouter()
  const [cap, setCap] = useState(capacity != null ? String(capacity) : '')
  const [price, setPrice] = useState(priceOverride != null ? String(priceOverride) : '')
  const [time, setTime] = useState(startTime24 ?? '')
  const [host, setHost] = useState(hostAssigned ?? '')
  const [saving, setSaving] = useState(false)

  const fieldStyle = {
    width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
    background: T.bgElevated, color: T.text, fontSize: '13.5px', fontFamily: 'inherit',
  }

  async function patchEvent(body: Record<string, unknown>) {
    setSaving(true)
    try {
      await fetch(`/api/admin/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function patchHost(next: string) {
    setHost(next)
    setSaving(true)
    try {
      await fetch(`/api/admin/dashboard/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostAssigned: next || null }),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: '10px', marginBottom: '18px', opacity: saving ? 0.6 : 1 }}>
      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Sales</p>
        <button
          type="button"
          disabled={saving}
          onClick={() => patchEvent({ isOpen: !isOpen })}
          style={{ ...fieldStyle, textAlign: 'left', cursor: 'pointer', color: isOpen ? T.statusGreen : T.statusRed }}
        >
          {isOpen ? 'Open — tap to close sales' : 'Closed — tap to open sales'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Capacity</p>
          <input
            type="number" inputMode="numeric" value={cap} disabled={saving} placeholder="No limit set"
            onChange={(e) => setCap(e.target.value)}
            onBlur={() => patchEvent({ capacity: cap === '' ? null : Number(cap) })}
            style={fieldStyle}
          />
        </div>
        <div>
          <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Start Time</p>
          <input
            type="time" value={time} disabled={saving}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => patchEvent({ startTimeOverride: time || null })}
            style={fieldStyle}
          />
        </div>
      </div>

      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>
          Price Override {defaultPrice != null && <span style={{ textTransform: 'none', fontWeight: 400 }}>(standard: ฿{defaultPrice.toLocaleString()})</span>}
        </p>
        <input
          type="number" inputMode="numeric" value={price} disabled={saving} placeholder="Using standard price"
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => patchEvent({ priceOverride: price === '' ? null : Number(price) })}
          style={fieldStyle}
        />
      </div>

      <div>
        <p style={{ ...eyebrow(T.textFaint), marginBottom: '5px' }}>Host</p>
        <select value={host} disabled={saving} onChange={(e) => patchHost(e.target.value)} style={fieldStyle}>
          <option value="">Unassigned</option>
          {HOSTS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
    </div>
  )
}
