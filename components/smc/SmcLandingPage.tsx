import Image from 'next/image'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Dices,
  MapPin,
  Martini,
  MessagesSquare,
  Plus,
  Sparkles,
  Ticket,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import {
  SMC_BOOKING_HREF,
  SMC_FREQUENCY_LABEL,
  SMC_NEXT_EDITION as baseEdition,
  formatLongDate,
  formatPrice,
  formatShortDate,
  formatStartTime,
} from '@/lib/smc/config'
import { SMC_COPY as copy } from '@/lib/smc/content'
import type { SmcBookableEvent } from '@/lib/smc/event'
import SmcGallery, { type SmcGalleryPhoto } from './SmcGallery'
import './smc.css'

const IMAGE_QUALITY = 90

// Photos from SMC nights at Tony's. The hero is also the homepage card
// (components/bnt/BntLandingPage.tsx).
const HERO_PHOTO = {
  src: '/smc/hero.jpg',
  alt: "Guests talking and laughing around a table under the Tony's sign",
}

const CONVERSATION_PHOTOS: SmcGalleryPhoto[] = [
  { src: '/smc/conv-1.jpg', alt: 'Two guests chatting at a small marble table', position: 'center 40%' },
  { src: '/smc/conv-2.jpg', alt: 'Three guests talking over drinks at a candlelit table', position: 'center 55%' },
  { src: '/smc/conv-3.jpg', alt: 'Two guests sharing a laugh across the table', position: 'center 55%' },
  { src: '/smc/conv-4.jpg', alt: "A small group talking by the Tony's sign", position: 'center 45%' },
  { src: '/smc/conv-5.jpg', alt: 'Two guests in conversation at the bar', position: 'center 45%' },
]

const ACTIVITY_PHOTOS: SmcGalleryPhoto[] = [
  { src: '/smc/act-1.jpg', alt: 'A table of guests smiling during the red flag, green flag game', position: 'center 55%' },
  { src: '/smc/act-2.jpg', alt: "Guests raising red and green flags under the Tony's sign", position: 'center 65%' },
  { src: '/smc/act-3.jpg', alt: 'Guests playing a group game around the tables', position: 'center 60%' },
  { src: '/smc/act-4.jpg', alt: 'A game prompt on screen while guests vote with flags', position: 'center 50%' },
  { src: '/smc/act-5.jpg', alt: 'A guest filling in a Connection Bingo card', position: 'center 45%' },
  { src: '/smc/act-6.jpg', alt: 'Single Meet Club conversation prompt cards on the table', position: 'center 60%' },
]

const EXPECT_ICONS: Record<string, LucideIcon> = {
  drink: Martini,
  prompts: MessagesSquare,
  games: Dices,
  mingling: UsersRound,
}

function Photo({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string
  alt: string
  sizes: string
  priority?: boolean
  className?: string
}) {
  return (
    <div className={`smc-photo ${className ?? ''}`}>
      <Image src={src} alt={alt} fill sizes={sizes} quality={IMAGE_QUALITY} priority={priority} />
    </div>
  )
}

function ReserveButton({ label, className }: { label: string; className?: string }) {
  return (
    <a href={SMC_BOOKING_HREF} className={`smc-btn ${className ?? ''}`}>
      {label}
      <ArrowRight aria-hidden size={20} strokeWidth={2} />
    </a>
  )
}

function Wordmark() {
  return (
    <a href="#top" className="smc-wordmark" aria-label="Single Meet Club">
      <Image src="/smc/smc-logo.png" alt="Single Meet Club" width={640} height={293} priority />
    </a>
  )
}

// `next` is the next SMC event from the database (lib/smc/event.ts), so the
// date rolls forward on its own after each edition.
export default function SmcLandingPage({ next }: { next: SmcBookableEvent }) {
  const edition = {
    ...baseEdition,
    date: next.date,
    startTime: next.startTime,
    priceThb: next.priceThb,
    capacity: next.capacity ?? baseEdition.capacity,
  }
  const shortDate = formatShortDate(edition)
  const startTime = formatStartTime(edition)
  const price = formatPrice(edition)

  return (
    <div className="smc-page" id="top">
      <header className="smc-header">
        <div className="smc-container smc-header-inner">
          <Wordmark />
          <nav className="smc-header-nav" aria-label="Single Meet Club">
            <a href="#about">About</a>
            <a href="#next-edition">Next edition</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a href={SMC_BOOKING_HREF} className="smc-header-cta">
            Reserve
          </a>
        </div>
      </header>

      <main>
        {/* ── 1. Hero ── */}
        <section className="smc-hero" aria-labelledby="smc-hero-title">
          <Photo
            src={HERO_PHOTO.src}
            alt={HERO_PHOTO.alt}
            sizes="100vw"
            priority
            className="smc-hero-photo"
          />
          <div className="smc-hero-scrim" aria-hidden />
          <div className="smc-container smc-hero-content">
            <p className="smc-eyebrow">{copy.hero.eyebrow}</p>
            <h1 id="smc-hero-title" className="smc-hero-title">
              <span>{copy.hero.titleTop}</span>
              <span className="smc-accent">{copy.hero.titleBottom}</span>
            </h1>
            <p className="smc-hero-tagline">{copy.hero.tagline}</p>
            <p className="smc-hero-body">{copy.hero.body}</p>

            {edition.editionName && (
              <p className="smc-hero-edition">
                <strong>{edition.editionName}</strong>
                {edition.editionTagline && <span>{edition.editionTagline}</span>}
              </p>
            )}

            <ul className="smc-strip" aria-label="Event details">
              <li>
                <CalendarDays aria-hidden size={20} strokeWidth={1.7} />
                <span>{shortDate}</span>
              </li>
              <li>
                <Clock aria-hidden size={20} strokeWidth={1.7} />
                <span>{startTime} onwards</span>
              </li>
              <li>
                <MapPin aria-hidden size={20} strokeWidth={1.7} />
                <span>
                  {edition.venueShortName}
                  {/* keep a trailing number (e.g. "Soi 11") with its word */}
                  <small>{edition.venueArea.replace(/ (\d+)$/, '\u00a0$1')}</small>
                </span>
              </li>
            </ul>

            <ReserveButton label={copy.hero.cta} className="smc-btn-block" />
            <p className="smc-hero-note">
              {price} · {edition.inclusion} · Limited to {edition.capacity} guests
            </p>
          </div>
        </section>

        {/* ── 2. About ── */}
        <section id="about" className="smc-section smc-about-wrap" aria-labelledby="smc-about-title">
          <div className="smc-container">
            <div className="smc-about">
              <div className="smc-about-text">
                <p className="smc-eyebrow smc-eyebrow-dark">{copy.about.eyebrow}</p>
                <h2 id="smc-about-title" className="smc-h2 smc-h2-dark">
                  <span>{copy.about.titleTop}</span>
                  <span>{copy.about.titleBottom}</span>
                </h2>
                <p className="smc-body-dark">{copy.about.body}</p>
              </div>
              <SmcGallery
                photos={CONVERSATION_PHOTOS}
                label="Conversations at Single Meet Club"
                variant="wide"
                className="smc-about-gallery"
              />
            </div>
          </div>
        </section>

        {/* ── 3. What to expect ── */}
        <section className="smc-section" aria-labelledby="smc-expect-title">
          <div className="smc-container">
            <p className="smc-eyebrow">{copy.expect.eyebrow}</p>
            <h2 id="smc-expect-title" className="smc-h2">
              <span>{copy.expect.titleTop}</span>
              <span>{copy.expect.titleBottom}</span>
            </h2>
            <ul className="smc-expect">
              {copy.expect.items.map((item) => {
                const Icon = EXPECT_ICONS[item.key]
                return (
                  <li key={item.key}>
                    <span className="smc-expect-icon">
                      <Icon aria-hidden size={22} strokeWidth={1.6} />
                    </span>
                    <span className="smc-expect-label">{item.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="smc-container">
            <SmcGallery
              photos={ACTIVITY_PHOTOS}
              label="Games and activities at Single Meet Club"
              variant="compact"
              className="smc-expect-gallery"
            />
          </div>
        </section>

        {/* ── 4. Next edition ── */}
        <section id="next-edition" className="smc-section" aria-labelledby="smc-next-title">
          <div className="smc-container">
            <div className="smc-ticket">
              <p className="smc-eyebrow smc-eyebrow-dark">
                {edition.editionName ? `${copy.nextEdition.eyebrow} · ${edition.editionName}` : copy.nextEdition.eyebrow}
              </p>
              {edition.editionTagline && <p className="smc-ticket-tagline">{edition.editionTagline}</p>}
              <h2 id="smc-next-title" className="smc-ticket-date">
                {formatLongDate(edition)}
              </h2>
              <ul className="smc-ticket-list">
                <li>
                  <Clock aria-hidden size={20} strokeWidth={1.7} />
                  <span>{startTime} onwards</span>
                </li>
                <li className="smc-ticket-venue">
                  <MapPin aria-hidden size={20} strokeWidth={1.7} />
                  <span>
                    {edition.venueName}
                    <br />
                    {edition.venueArea}, {edition.venueCity}
                  </span>
                  <a href={edition.mapUrl} target="_blank" rel="noopener noreferrer" className="smc-chip">
                    {copy.nextEdition.mapCta}
                  </a>
                </li>
                <li>
                  <Ticket aria-hidden size={20} strokeWidth={1.7} />
                  <span>
                    {price} · {edition.inclusion}
                  </span>
                </li>
                <li>
                  <Users aria-hidden size={20} strokeWidth={1.7} />
                  <span>Limited to {edition.capacity} guests · 20+ only</span>
                </li>
                {edition.themeNote && (
                  <li>
                    <Sparkles aria-hidden size={20} strokeWidth={1.7} />
                    <span>{edition.themeNote}</span>
                  </li>
                )}
                <li>
                  <CalendarDays aria-hidden size={20} strokeWidth={1.7} />
                  <span>{SMC_FREQUENCY_LABEL}</span>
                </li>
              </ul>
              <ReserveButton label={copy.nextEdition.cta} className="smc-btn-block" />
            </div>
          </div>
        </section>

        {/* ── 5. FAQ ── */}
        <section id="faq" className="smc-section" aria-labelledby="smc-faq-title">
          <div className="smc-container smc-faq-wrap">
            <h2 id="smc-faq-title" className="smc-h2">
              {copy.faq.title}
            </h2>
            <div className="smc-faq">
              {copy.faq.items.map((item) => (
                <details key={item.q}>
                  <summary>
                    <span>{item.q}</span>
                    <Plus aria-hidden size={18} strokeWidth={1.8} className="smc-faq-icon" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── 6. Footer ── */}
      <footer className="smc-footer">
        <div className="smc-container">
          <div className="smc-footer-brands">
            <Wordmark />
            <div className="smc-footer-divider" aria-hidden />
            <div className="smc-footer-partner">
              <span className="smc-footer-label">{copy.footer.endorsement}</span>
              <a href="/" className="smc-footer-best">
                <Image
                  src="/bnt/logo/best-nightlife-thailand-logo.png"
                  alt="BEST Nightlife Thailand"
                  width={56}
                  height={56}
                />
                <span>BEST Nightlife Thailand</span>
              </a>
            </div>
            <div className="smc-footer-partner">
              <span className="smc-footer-label">{copy.footer.venueLabel}</span>
              <span className="smc-footer-venue">
                <Image src="/smc/tonys-logo.png" alt={edition.venueName} width={360} height={193} />
              </span>
            </div>
          </div>
          <nav className="smc-footer-links" aria-label="Contact">
            <a href="/contact">Contact</a>
            <a href="https://wa.me/66660399569" target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a href="https://www.instagram.com/nightlife.thailand" target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          </nav>
          <p className="smc-footer-legal">
            © {new Date().getFullYear()} BEST Nightlife Thailand. Single Meet Club.
          </p>
        </div>
      </footer>
    </div>
  )
}
