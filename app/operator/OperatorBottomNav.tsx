'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, Sparkles, Layers, MoreHorizontal } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'

const TABS = [
  { href: '/operator', label: 'Home', Icon: Home },
  { href: '/operator/work', label: 'Work', Icon: ClipboardList },
  { href: '/operator/hermes', label: 'Hermes', Icon: Sparkles },
  { href: '/operator/records', label: 'Records', Icon: Layers },
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
