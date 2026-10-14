'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export type SmcGalleryPhoto = {
  src: string
  alt: string
  // CSS object-position for the cropped tile, e.g. 'center 30%'
  position?: string
}

// Collage of photos; the first is the large feature tile. Any tile opens a
// full-screen viewer (arrow keys / swipe to move, Esc or backdrop to close).
export default function SmcGallery({
  photos,
  label,
  variant,
  className,
}: {
  photos: SmcGalleryPhoto[]
  label: string
  variant: 'wide' | 'compact'
  className?: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const touchX = useRef<number | null>(null)

  const close = useCallback(() => setOpen(null), [])
  const step = useCallback(
    (delta: number) => setOpen((i) => (i === null ? i : (i + delta + photos.length) % photos.length)),
    [photos.length],
  )

  const isOpen = open !== null

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', onKey)
      returnFocus.current?.focus()
    }
  }, [isOpen, close, step])

  const current = open === null ? null : photos[open]

  return (
    <>
      <ul className={`smc-gallery smc-gallery--${variant} ${className ?? ''}`} aria-label={label}>
        {photos.map((photo, i) => (
          <li key={photo.src} className="smc-gallery-item">
            <button
              type="button"
              className="smc-gallery-tile"
              onClick={(e) => {
                returnFocus.current = e.currentTarget
                setOpen(i)
              }}
              aria-label={`View larger: ${photo.alt}`}
            >
              <Image
                src={photo.src}
                alt=""
                fill
                sizes={i === 0 ? '(min-width: 1120px) 560px, 100vw' : '(min-width: 1120px) 280px, 50vw'}
                quality={85}
                style={{ objectPosition: photo.position ?? 'center' }}
              />
            </button>
          </li>
        ))}
      </ul>

      {current && open !== null && (
        <div
          className="smc-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
          }}
        >
          <figure className="smc-lightbox-figure" onClick={(e) => e.target === e.currentTarget && close()}>
            <div className="smc-lightbox-image">
              <Image key={current.src} src={current.src} alt={current.alt} fill sizes="100vw" quality={90} />
            </div>
            <figcaption>
              {open + 1} / {photos.length}
            </figcaption>
          </figure>
          <button ref={closeRef} type="button" className="smc-lightbox-btn smc-lightbox-close" onClick={close} aria-label="Close">
            <X aria-hidden size={24} />
          </button>
          {photos.length > 1 && (
            <>
              <button type="button" className="smc-lightbox-btn smc-lightbox-prev" onClick={() => step(-1)} aria-label="Previous photo">
                <ChevronLeft aria-hidden size={28} />
              </button>
              <button type="button" className="smc-lightbox-btn smc-lightbox-next" onClick={() => step(1)} aria-label="Next photo">
                <ChevronRight aria-hidden size={28} />
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
