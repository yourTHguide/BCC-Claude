'use client'

import { useEffect, useState } from 'react'

// Visitor consent for non-essential third parties (pre-release review, Nov 2026).
//
// One first-party cookie per site (BEST and BCC are separate sites, so a
// choice on one does not apply to the other):
//   snx_consent=all        -> Meta Pixel, Elfsight reviews, Google Maps embed
//   snx_consent=necessary  -> none of the above
//   (no cookie)            -> nothing non-essential loads; the banner asks
// The cookie itself is strictly necessary (it only stores the choice).
// Bump CONSENT_VERSION when the purposes change, so everyone is asked again.

export type Consent = 'all' | 'necessary' | null

export const CONSENT_COOKIE = 'snx_consent'
export const CONSENT_VERSION = '1'
const MAX_AGE_DAYS = 365
export const CONSENT_CHANGE_EVENT = 'snx:consent-change'
export const CONSENT_OPEN_EVENT = 'snx:consent-open'

// Pages where no advertising tracking or consent banner runs: staff tools
// and guest pages whose URL carries a private token.
export const PRIVATE_PATH_RE = /^\/(dashboard|operator|login|set-password|ticket|waitlist\/unsubscribe)(\/|$)/

export function readConsent(): Consent {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`))
  if (!m) return null
  const [version, value] = decodeURIComponent(m[1]).split(':')
  if (version !== CONSENT_VERSION) return null
  return value === 'all' || value === 'necessary' ? value : null
}

export function writeConsent(value: 'all' | 'necessary') {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(`${CONSENT_VERSION}:${value}`)}; Max-Age=${MAX_AGE_DAYS * 86400}; Path=/; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }))
}

// Removes Meta's first-party cookies on withdrawal (they may be set on the
// host or on the parent domain).
export function clearMetaCookies() {
  const host = location.hostname
  const parts = host.split('.')
  const domains = ['', host, `.${host}`, parts.length > 2 ? `.${parts.slice(-2).join('.')}` : `.${host}`]
  for (const name of ['_fbp', '_fbc']) {
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`
    }
  }
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}

export function useConsent(): Consent {
  const [consent, setConsent] = useState<Consent>(null)
  useEffect(() => {
    setConsent(readConsent())
    const onChange = () => setConsent(readConsent())
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
  }, [])
  return consent
}
