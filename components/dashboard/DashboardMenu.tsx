'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Owner/admin menu on every /dashboard page (Nov 2026), so any page can reach
// any other without going back to the calendar. Not shown on the main
// dashboard (it has its own menu) or on the host view / check-in, which hosts
// use and which must not lead into the owner dashboard.

const LINKS: [string, string][] = [
  ['/dashboard', '📅 Calendar'],
  ['/dashboard?tab=bookings', '📋 Bookings'],
  ['/dashboard?tab=operations', '📊 Operations'],
  ['/dashboard/bokun', '🔄 Bókun'],
  ['/dashboard/leads', '📨 Leads'],
  ['/dashboard/products', '🧩 Products'],
  ['/dashboard/host', '🎤 Host view'],
  ['/dashboard/team', '👥 Team'],
]

export function showDashboardMenu(pathname: string): boolean {
  if (pathname === '/dashboard') return false
  return !['/dashboard/host', '/dashboard/checkin'].some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default function DashboardMenu() {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  if (!showDashboardMenu(pathname)) return null
  const active = (href: string) => href !== '/dashboard' && !href.includes('?') && pathname.startsWith(href)
  const link = (href: string, label: string, block = false) => (
    <Link key={href} href={href} onClick={() => setOpen(false)}
      className={`${block ? 'flex w-full' : 'inline-flex'} h-9 items-center whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold ${active(href) ? 'bg-accent-primary text-white' : 'border border-white/15 text-white/80'}`}>
      {label}
    </Link>
  )
  return (
    <nav className="sticky top-0 z-[150] border-b border-white/5 px-4 py-2 font-inter text-white sm:px-6" style={{ background: 'rgba(26,0,21,0.98)' }}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-primary">BCC Dashboard</Link>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">{LINKS.map(([h, l]) => link(h, l))}</div>
        <button type="button" className="h-9 rounded-lg border border-white/15 px-3 text-lg leading-none sm:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? '✕' : '☰'}
        </button>
      </div>
      {open && <div className="mt-2 grid gap-1 sm:hidden">{LINKS.map(([h, l]) => link(h, l, true))}</div>}
    </nav>
  )
}
