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
  Ticket,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import {
  SMC_BOOKING_HREF,
  SMC_FREQUENCY_LABEL,
  SMC_NEXT_EDITION as edition,
  SMC_SHOW_PLACEHOLDER_TAGS,
  formatLongDate,
  formatPrice,
  formatShortDate,
  formatStartTime,
} from '@/lib/smc/config'
import { SMC_COPY as copy } from '@/lib/smc/content'
import './smc.css'

const IMAGE_QUALITY = 90

// Existing BEST/BCC event photography standing in for genuine SMC photos —
// swap paths here when real SMC photography is supplied (public/smc/...).
const PHOTOS = {
  hero: { src: '/images/gallery/g3.jpg', alt: 'Guests talking and laughing at a warmly lit Bangkok bar' },
  about: { src: '/images/30plus-night.jpg', alt: 'Guests mingling over drinks' },
  band: { src: '/images/gallery/g12.jpg', alt: 'A group gathered around a table in a red-lit lounge' },
  moments: [
    { src: '/images/gallery/g4.jpg', alt: 'Guests raising a toast together' },
    { src: '/images/gallery/g5.jpg', alt: 'Two guests laughing together' },
    { src: '/images/gallery/g1.jpg', alt: 'Live performance in a warmly lit bar' },
    { src: '/images/gallery/g9.jpg', alt: 'A group of guests posing together' },
  ],
}

const EXPECT_ICONS: Record<string, LucideIcon> = {
  drink: Martini,
  prompts: MessagesSquare,
  games: Dices,
  mingling: UsersRound,
}

function PlaceholderTag() {
  if (!SMC_SHOW_PLACEHOLDER_TAGS) return null
  return <span className="smc-placeholder-tag">Placeholder photo</span>
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
      <PlaceholderTag />
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
  // Typeset product name, not a logo — replace with approved SMC logo artwork.
  return (
    <a href="#top" className="smc-wordmark" aria-label="Single Meet Club">
      <span>Single</span>
      <span className="smc-wordmark-accent">Meet Club</span>
    </a>
  )
}

export default function SmcLandingPage() {
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
            src={PHOTOS.hero.src}
            alt={PHOTOS.hero.alt}
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

            <ul className="smc-strip" aria-label="Event details">
              <li>
                <CalendarDays aria-hidden size={26} strokeWidth={1.6} />
                <span>{shortDate}</span>
              </li>
              <li>
                <Clock aria-hidden size={26} strokeWidth={1.6} />
                <span>{startTime} onwards</span>
              </li>
              <li>
                <MapPin aria-hidden size={26} strokeWidth={1.6} />
                <span>
                  {edition.venueShortName}
                  <small>{edition.venueArea}</small>
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
              <Photo
                src={PHOTOS.about.src}
                alt={PHOTOS.about.alt}
                sizes="(min-width: 900px) 360px, 40vw"
                className="smc-about-photo"
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
                      <Icon aria-hidden size={30} strokeWidth={1.5} />
                    </span>
                    <span className="smc-expect-label">{item.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="smc-container">
            <Photo
              src={PHOTOS.band.src}
              alt={PHOTOS.band.alt}
              sizes="(min-width: 1120px) 1080px, 100vw"
              className="smc-band-photo"
            />
          </div>
        </section>

        {/* ── 4. Next edition ── */}
        <section id="next-edition" className="smc-section" aria-labelledby="smc-next-title">
          <div className="smc-container">
            <div className="smc-ticket">
              <p className="smc-eyebrow smc-eyebrow-dark">{copy.nextEdition.eyebrow}</p>
              <h2 id="smc-next-title" className="smc-ticket-date">
                {formatLongDate(edition)}
              </h2>
              <ul className="smc-ticket-list">
                <li>
                  <Clock aria-hidden size={24} strokeWidth={1.6} />
                  <span>{startTime} onwards</span>
                </li>
                <li className="smc-ticket-venue">
                  <MapPin aria-hidden size={24} strokeWidth={1.6} />
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
                  <Ticket aria-hidden size={24} strokeWidth={1.6} />
                  <span>
                    {price} · {edition.inclusion}
                  </span>
                </li>
                <li>
                  <Users aria-hidden size={24} strokeWidth={1.6} />
                  <span>Limited to {edition.capacity} guests</span>
                </li>
                <li>
                  <CalendarDays aria-hidden size={24} strokeWidth={1.6} />
                  <span>{SMC_FREQUENCY_LABEL}</span>
                </li>
              </ul>
              <ReserveButton label={copy.nextEdition.cta} className="smc-btn-block" />
            </div>
          </div>
        </section>

        {/* ── 5. Real moments ── */}
        <section className="smc-section" aria-labelledby="smc-moments-title">
          <div className="smc-container">
            <p className="smc-eyebrow">{copy.moments.eyebrow}</p>
            <h2 id="smc-moments-title" className="smc-h2">
              {copy.moments.title}
            </h2>
            <p className="smc-body smc-moments-intro">{copy.moments.body}</p>
            <div className="smc-gallery">
              {PHOTOS.moments.map((p, i) => (
                <Photo
                  key={p.src}
                  src={p.src}
                  alt={p.alt}
                  sizes={i === 0 ? '(min-width: 900px) 540px, 100vw' : '(min-width: 900px) 260px, 33vw'}
                  className={i === 0 ? 'smc-gallery-main' : 'smc-gallery-item'}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── 6. FAQ ── */}
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
                    <Plus aria-hidden size={20} strokeWidth={1.8} className="smc-faq-icon" />
                  </summary>
                  <p>
                    {item.draft && <span className="smc-draft-tag">Draft</span>}
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── 7. Footer ── */}
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
              {/* Text until Tony's official logo artwork is supplied. */}
              <span className="smc-footer-venue">{edition.venueName}</span>
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
