'use client'

import { useEffect, useState } from 'react'
import { BNT_WHATSAPP_URL } from '@/lib/bnt/contact'

// Phase 3 (Nov 2026): mobile-only bottom bar on the BEST homepage, shown once
// the visitor scrolls past the hero. Hidden on desktop by CSS.
export default function BntStickyBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.7)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={visible ? 'bnt-sticky-bar visible' : 'bnt-sticky-bar'} aria-hidden={!visible}>
      <a href="#signature-events" tabIndex={visible ? 0 : -1}>Events</a>
      <a href="#master-deck" tabIndex={visible ? 0 : -1}>Private</a>
      <a href={BNT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="sticky-whatsapp" tabIndex={visible ? 0 : -1}>
        WhatsApp
      </a>
    </div>
  )
}
