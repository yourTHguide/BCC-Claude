'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  CONSENT_OPEN_EVENT,
  PRIVATE_PATH_RE,
  clearMetaCookies,
  readConsent,
  writeConsent,
  type Consent,
} from '@/lib/consent'

// Consent banner + the ONLY place the Meta Pixel is loaded (pre-release
// review, Nov 2026). Before the visitor chooses, and after "Only necessary",
// nothing is requested from Meta: no script, no cookie, no PageView, and all
// existing window.fbq?.(...) calls in the app are no-ops because fbq is
// undefined. No <noscript> pixel exists: a visitor without JavaScript can't
// consent, so they are never tracked.
//
// The pixel loads only when: consent is 'all', the host is a production
// storefront (trackingHost, decided on the server), and the page is not a
// private one (staff tools, ticket and unsubscribe links).

type Brand = 'bnt' | 'bcc'

// purposes: what this site actually loads with consent (keep in sync with
// the privacy notice). BEST has no reviews widget or map embed.
const STYLES: Record<Brand, { bg: string; border: string; accent: string; heading: string; font: string; name: string; purposes: string }> = {
  bnt: { bg: '#0D0D0D', border: 'rgba(234,0,58,0.45)', accent: '#EA003A', heading: 'Montserrat, Inter, sans-serif', font: 'Inter, sans-serif', name: 'BEST Nightlife Thailand',
    purposes: 'With your permission we use Meta (Facebook/Instagram) cookies to measure our ads.' },
  bcc: { bg: '#1A0015', border: 'rgba(130,0,101,0.7)', accent: '#EA003A', heading: 'Inter, sans-serif', font: 'Inter, sans-serif', name: 'Bangkok Club Crawl',
    purposes: 'With your permission we use Meta (Facebook/Instagram) cookies to measure our ads, and show guest reviews (Elfsight) and a map (Google), which may set their own cookies.' },
}

type Fbq = (...args: unknown[]) => void
const fbqOf = () => (window as unknown as { fbq?: Fbq }).fbq

function loadMetaPixel(pixelId: string) {
  if (fbqOf()) return
  /* Meta's standard base code, unchanged apart from being called on demand. */
  /* eslint-disable */
  ;(function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    })
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    const t = b.createElement(e) as HTMLScriptElement
    t.async = true
    t.src = v
    const s = b.getElementsByTagName(e)[0]
    s.parentNode!.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
  fbqOf()!('init', pixelId)
  fbqOf()!('track', 'PageView')
}

export default function ConsentManager({
  brand,
  trackingHost,
  pixelId,
}: {
  brand: Brand
  trackingHost: boolean
  pixelId: string
}) {
  const pathname = usePathname() || '/'
  const isPrivate = PRIVATE_PATH_RE.test(pathname)
  const [consent, setConsent] = useState<Consent>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const pixelLoaded = useRef(false)
  const bannerRef = useRef<HTMLDivElement>(null)
  // The BEST private-inquiry modal sets body.bnt-modal-open. While a
  // visitor is filling it in, the banner steps aside (it returns on close)
  // so it never covers the form's buttons.
  const [modalOpen, setModalOpen] = useState(false)
  useEffect(() => {
    const update = () => setModalOpen(document.body.classList.contains('bnt-modal-open'))
    update()
    const mo = new MutationObserver(update)
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    const c = readConsent()
    setConsent(c)
    setReady(true)
    setOpen(c === null)
    const onOpen = () => setOpen(true)
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (consent === 'all' && trackingHost && !isPrivate && !pixelLoaded.current) {
      loadMetaPixel(pixelId)
      pixelLoaded.current = true
    }
  }, [consent, trackingHost, isPrivate, pixelId])

  function choose(value: 'all' | 'necessary') {
    const had = consent
    writeConsent(value)
    setConsent(value)
    setOpen(false)
    if (value === 'necessary' && had === 'all') {
      // Withdrawal: stop Meta for the rest of this visit and remove its
      // cookies. A reload guarantees the already-loaded script is gone.
      clearMetaCookies()
      const fbq = fbqOf()
      if (fbq) {
        try {
          fbq('consent', 'revoke')
        } catch {}
        window.location.reload()
      }
    }
  }

  const visible = ready && !isPrivate && open && !modalOpen
  // Reserve space at the bottom of the page while the banner is up, so the
  // end of any page (e.g. a booking form's submit button) can scroll clear.
  useEffect(() => {
    if (!visible) return
    const h = bannerRef.current?.offsetHeight ?? 0
    const prev = document.body.style.paddingBottom
    document.body.style.paddingBottom = `${h + 24}px`
    return () => {
      document.body.style.paddingBottom = prev
    }
  }, [visible])

  // Sit above any fixed bar at the bottom of the screen (BCC's sticky "Book"
  // bar, BEST's mobile bar, SMC's reserve bar) instead of covering it, so the
  // booking path is never blocked while the visitor hasn't chosen yet.
  const [lift, setLift] = useState(0)
  useEffect(() => {
    if (!visible) return
    const measure = () => {
      const banner = bannerRef.current
      if (!banner) return
      const prev = banner.style.visibility
      banner.style.visibility = 'hidden'
      const hits = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight - 4)
      banner.style.visibility = prev
      let top = window.innerHeight
      for (const el of hits) {
        for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
          const cs = getComputedStyle(n)
          if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.visibility !== 'hidden' && cs.display !== 'none') {
            const r = n.getBoundingClientRect()
            if (r.bottom >= window.innerHeight - 8 && r.height < window.innerHeight / 2) top = Math.min(top, r.top)
          }
        }
      }
      setLift(Math.max(0, window.innerHeight - top))
    }
    measure()
    const t = window.setInterval(measure, 700)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.clearInterval(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [visible])

  if (!visible) return null
  const st = STYLES[brand]
  const btn: React.CSSProperties = {
    flex: '1 1 0',
    minWidth: 0,
    padding: '12px 14px',
    borderRadius: 9999,
    fontFamily: st.font,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#FFFFFF',
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-body"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: lift ? lift + 8 : 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 2000,
        maxWidth: 520,
        margin: '0 auto',
        background: st.bg,
        border: `1px solid ${st.border}`,
        borderRadius: 16,
        padding: '16px 16px 14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        color: '#FFFFFF',
        fontFamily: st.font,
      }}
    >
      <p id="consent-title" style={{ margin: '0 0 6px', fontFamily: st.heading, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Cookies on {st.name}
      </p>
      <p id="consent-body" style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.75)' }}>
        {st.purposes} Choose &ldquo;Only necessary&rdquo; and none of these load. You can change this any time under &ldquo;Cookie settings&rdquo;.
        {consent && (
          <>
            {' '}
            Current choice: <strong>{consent === 'all' ? 'Accepted' : 'Only necessary'}</strong>.
          </>
        )}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Equal weight on purpose: no visual nudge toward either choice. */}
        <button type="button" onClick={() => choose('necessary')} style={{ ...btn, background: 'rgba(255,255,255,0.06)', border: `1px solid ${st.accent}` }}>
          Only necessary
        </button>
        <button type="button" onClick={() => choose('all')} style={{ ...btn, background: 'rgba(255,255,255,0.06)', border: `1px solid ${st.accent}` }}>
          Accept
        </button>
      </div>
    </div>
  )
}
