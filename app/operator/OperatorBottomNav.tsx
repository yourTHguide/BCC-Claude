'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutGrid, Plus, Target, MoreHorizontal } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'

// Phase 1A shell rewire (2026-09-02): Home/Manage/Create/Quest/More per
// SNX_PHASE1_ALIGNMENT_AUDIT.md. Work, Hermes, and Records are no longer
// primary nav destinations — their routes still exist (app/operator/work,
// app/operator/hermes) and are reachable by deep link (e.g. Home's
// notification bell -> /operator/work); Records moved under
// /operator/more/records.
const TABS = [
  { href: '/operator', label: 'Home', Icon: Home },
  { href: '/operator/manage', label: 'Manage', Icon: LayoutGrid },
  { href: '/operator/create', label: 'Create', Icon: Plus },
  { href: '/operator/quest', label: 'Quest', Icon: Target },
  { href: '/operator/more', label: 'More', Icon: MoreHorizontal },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/operator') return pathname === '/operator'
  return pathname.startsWith(href)
}

export default function OperatorBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: T.navBg,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: `1px solid ${T.border}`,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '8px 4px calc(8px + env(safe-area-inset-bottom))',
        maxWidth: T.maxWidth,
        margin: '0 auto',
        zIndex: 50,
      }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              textDecoration: 'none',
              color: active ? T.accent : T.textMuted,
              minWidth: '56px',
            }}
          >
            <Icon size={21} strokeWidth={active ? 2.25 : 1.75} />
            <span style={{ fontSize: '10px', fontWeight: active ? 600 : 500 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
