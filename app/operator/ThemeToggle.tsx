'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'

const STORAGE_KEY = 'operator-theme'

// Simple 2-state toggle, no dependency. Default paint (before this mounts)
// already matches system preference via the CSS media query in
// operator-theme.css — this only needs to (a) reflect a stored explicit
// choice on mount and (b) let the user override + persist it.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      /* localStorage unavailable (private mode etc.) — fall through to system preference */
    }
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored)
    } else {
      setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    }
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* best-effort persistence only */
    }
    document.getElementById('operator-shell')?.setAttribute('data-theme', next)
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: T.textFaint,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  )
}
