'use client'

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'

// Phone/tablet "Reserve" bar pinned to the bottom of the screen. It steps
// aside while the hero's own Reserve button (`watchId`) is on screen so the
// two never stack.
export default function SmcStickyCta({ href, label, watchId }: { href: string; label: string; watchId: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const target = document.getElementById(watchId)
    if (!target || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting))
    observer.observe(target)
    return () => observer.disconnect()
  }, [watchId])

  return (
    <div className={`smc-sticky-cta ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <a href={href} className="smc-btn smc-btn-block" tabIndex={visible ? undefined : -1}>
        {label}
        <ArrowRight aria-hidden size={20} strokeWidth={2} />
      </a>
    </div>
  )
}
