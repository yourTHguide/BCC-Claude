'use client'

import { openConsentSettings } from '@/lib/consent'

// Footer link that reopens the consent choice (change or withdraw).
export default function CookieSettingsLink({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className={className}
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textDecoration: 'underline', ...style }}
    >
      Cookie settings
    </button>
  )
}
