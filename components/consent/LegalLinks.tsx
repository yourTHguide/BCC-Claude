'use client'

import { useEffect, useState } from 'react'
import { openConsentSettings } from '@/lib/consent'

// Footer links: "Privacy notice" (only where the brand's notice is available
// — the layout puts its URL on <body data-privacy-href>) and "Cookie
// settings" (reopens the consent choice to change or withdraw it).
export default function LegalLinks({ separator = ' · ', style }: { separator?: string; style?: React.CSSProperties }) {
  const [privacyHref, setPrivacyHref] = useState<string | null>(null)
  useEffect(() => {
    setPrivacyHref(document.body.dataset.privacyHref || null)
  }, [])
  const link: React.CSSProperties = { color: 'inherit', textDecoration: 'underline', ...style }
  return (
    <>
      {privacyHref && (
        <>
          <a href={privacyHref} style={link}>
            Privacy notice
          </a>
          {separator}
        </>
      )}
      <button
        type="button"
        onClick={openConsentSettings}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', ...link }}
      >
        Cookie settings
      </button>
    </>
  )
}
