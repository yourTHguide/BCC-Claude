'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { operatorTheme as T } from '@/lib/operator/theme'

const TABS = [
  { seg: '', label: 'Overview' },
  { seg: '/guests', label: 'Guests' },
  { seg: '/expenses', label: 'Expenses' },
  { seg: '/brief', label: 'Brief' },
  { seg: '/closeout', label: 'Closeout' },
] as const

export default function EventOpsTabs({ id }: { id: string }) {
  const pathname = usePathname()
  const base = `/operator/manage/events/${id}`
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Presentation-only fix: bring the active tab into view/center on route
  // change, so switching tabs never leaves the new one partially cut off
  // at the scroll edge. Same routes, same tabs — just where the strip is
  // scrolled to.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [pathname])

  return (
    <div
      ref={scrollerRef}
      className="eventops-tabs-scroll"
      style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '0 18px 4px', marginBottom: '4px' }}
    >
      {/* Hides the scrollbar itself (Firefox/IE via inline style above,
          WebKit/Chromium via this selector) — horizontal scroll/swipe stays
          fully functional, only the visible track is removed. */}
      <style>{'.eventops-tabs-scroll{scrollbar-width:none;-ms-overflow-style:none}.eventops-tabs-scroll::-webkit-scrollbar{display:none}'}</style>
      {TABS.map(({ seg, label }) => {
        const href = base + seg
        const active = pathname === href
        return (
          <Link
            key={seg}
            href={href}
            ref={active ? activeRef : undefined}
            style={{
              flexShrink: 0, fontSize: '12.5px', fontWeight: active ? 600 : 500, padding: '6px 12px',
              borderRadius: '999px', textDecoration: 'none',
              color: active ? T.bg : T.textMuted,
              background: active ? T.accent : T.chipBg,
            }}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
