'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Users } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import { isAtCapacity } from '@/lib/operator/calendar'
import type { CalendarInstance } from '@/lib/operator/calendar'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const VERDICT_COLOR: Record<string, string> = {
  Pending: T.textMuted,
  'Pre-confirmation': T.statusAmber,
  'Operation Confirmed': T.statusGreen,
  'Cancelled / Rescheduled': T.statusRed,
  Completed: T.statusBlue,
  Reviewed: T.statusPurple,
}

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}
function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

export default function CalendarClient({
  year,
  month,
  today,
  instances,
  missingHostIds,
}: {
  year: number
  month: number
  today: string
  instances: CalendarInstance[]
  missingHostIds: Set<string>
}) {
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarInstance[]>()
    for (const inst of instances) {
      const arr = m.get(inst.eventDate) ?? []
      arr.push(inst)
      m.set(inst.eventDate, arr)
    }
    return m
  }, [instances])

  const defaultSelected = byDate.has(today) ? today : (instances[0]?.eventDate ?? null)
  const [selected, setSelected] = useState<string | null>(defaultSelected)

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const startWeekday = firstOfMonth.getUTCDay() // 0=Sun

  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const prev = prevMonth(year, month)
  const next = nextMonth(year, month)

  const selectedInstances = selected ? byDate.get(selected) ?? [] : []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <Link href={`/operator/manage/calendar?year=${prev.year}&month=${prev.month}`} style={{ padding: '6px', color: T.textMuted }}>
          <ChevronLeft size={20} />
        </Link>
        <p style={{ fontSize: '14.5px', fontWeight: 700, margin: 0 }}>{MONTH_NAMES[month - 1]} {year}</p>
        <Link href={`/operator/manage/calendar?year=${next.year}&month=${next.month}`} style={{ padding: '6px', color: T.textMuted }}>
          <ChevronRight size={20} />
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '4px' }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: T.textFaint, padding: '4px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px', marginBottom: '18px' }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayInstances = byDate.get(dateStr) ?? []
          const isToday = dateStr === today
          const isSelected = dateStr === selected
          const hasOpen = dayInstances.some((e) => e.isOpen)
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => dayInstances.length > 0 && setSelected(dateStr)}
              disabled={dayInstances.length === 0}
              style={{
                aspectRatio: '1', borderRadius: '8px', border: isSelected ? `1.5px solid ${T.accent}` : `1px solid ${isToday ? T.accent : T.border}`,
                background: isSelected ? T.accentSoft : T.bgElevated, cursor: dayInstances.length > 0 ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
                opacity: dayInstances.length > 0 ? 1 : 0.45, padding: 0,
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: isToday ? 700 : 500, color: T.text }}>{day}</span>
              {dayInstances.length > 0 && (
                <span style={{ width: '4px', height: '4px', borderRadius: '999px', background: hasOpen ? T.statusGreen : T.textFaint }} />
              )}
            </button>
          )
        })}
      </div>

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '9px' }}>
        {selected ? new Date(selected + 'T00:00:00Z').toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'No date selected'}
      </p>

      {selectedInstances.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CalendarDays size={22} color={T.textFaint} style={{ marginBottom: '8px' }} />
          <p style={{ fontSize: '13px', color: T.textFaint, margin: 0 }}>No instances this day.</p>
        </div>
      )}

      {selectedInstances.map((inst) => {
        const atCapacity = isAtCapacity(inst.capacity, inst.bookingCount)
        return (
          <Link
            key={inst.id}
            href={`/operator/manage/calendar/${inst.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', marginBottom: '8px',
              background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{inst.nightName}</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: inst.isOpen ? T.statusGreen : T.textMuted, background: inst.isOpen ? T.statusGreenSoft : T.chipBg }}>
                  {inst.isOpen ? 'Open' : 'Closed'}
                </span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: VERDICT_COLOR[inst.operationVerdict] ?? T.textMuted, background: T.chipBg }}>
                  {inst.operationVerdict}
                </span>
                {missingHostIds.has(inst.id) && (
                  <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.statusAmber, background: T.statusAmberSoft }}>
                    No host
                  </span>
                )}
                {atCapacity && (
                  <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.statusAmber, background: T.statusAmberSoft }}>
                    At capacity
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
                <Users size={12} color={T.textFaint} />
                <span style={{ fontSize: '11px', color: T.textMuted }}>
                  {inst.bookingCount}{inst.capacity != null ? ` / ${inst.capacity}` : ''} booked{inst.hostAssigned ? ` · Host: ${inst.hostAssigned}` : ''}
                </span>
              </div>
            </div>
            <ChevronRight size={16} color={T.textFaint} style={{ flexShrink: 0 }} />
          </Link>
        )
      })}
    </div>
  )
}
