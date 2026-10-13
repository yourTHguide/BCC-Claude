import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, CalendarDays, Clock, MapPin, Ticket } from 'lucide-react'
import SmcBookingForm from '@/components/smc/SmcBookingForm'
import {
  SMC_NEXT_EDITION,
  formatLongDate,
  formatPrice,
  formatStartTime,
} from '@/lib/smc/config'
import { canRenderSmcPage, smcCheckoutReadiness } from '@/lib/smc/env'
import { loadNextSmcEvent } from '@/lib/smc/event'
import '@/components/smc/smc.css'

export const dynamic = 'force-dynamic'

const TITLE = 'Reserve your spot | Single Meet Club'

export const metadata: Metadata = {
  title: TITLE,
  description: 'Book your place at Single Meet Club, a monthly social night for Bangkok singles.',
  openGraph: {
    title: TITLE,
    url: 'https://www.bestnightlifethailand.com/single-meet-club/book',
    type: 'website',
  },
  robots: { index: false, follow: false },
}

export default async function SmcBookPage({ searchParams }: { searchParams: { cancelled?: string } }) {
  if (!canRenderSmcPage()) notFound()

  const event = await loadNextSmcEvent()
  const readiness = smcCheckoutReadiness()
  if (!readiness.ready) {
    console.warn('SMC checkout closed:', readiness.internalReasons.join('; '))
  }

  // Display uses the same formatting helpers as the landing page.
  const display = { ...SMC_NEXT_EDITION, date: event.date, startTime: event.startTime, priceThb: event.priceThb }
  const soldOut = event.remaining !== null && event.remaining <= 0

  let closedMessage: string | null = null
  if (soldOut) closedMessage = 'This edition is sold out.'
  else if (!event.isOpen && event.source === 'database') closedMessage = 'Booking for this date has closed.'
  else if (!readiness.ready || event.source !== 'database') closedMessage = 'Online booking is not open yet.'

  const checkoutOpen = closedMessage === null && event.eventId !== null

  return (
    <div className="smc-page smc-book-page">
      <header className="smc-subheader">
        <div className="smc-container smc-subheader-inner">
          <a href="/single-meet-club" className="smc-back">
            <ArrowLeft aria-hidden size={18} />
            Single Meet Club
          </a>
        </div>
      </header>

      <main className="smc-container smc-book-main">
        <p className="smc-eyebrow">Reserve your spot</p>
        <h1 className="smc-h2">Single Meet Club</h1>

        <div className="smc-book-event">
          <ul>
            <li>
              <CalendarDays aria-hidden size={20} strokeWidth={1.7} />
              <span>{formatLongDate(display)}</span>
            </li>
            <li>
              <Clock aria-hidden size={20} strokeWidth={1.7} />
              <span>{formatStartTime(display)} onwards</span>
            </li>
            <li>
              <MapPin aria-hidden size={20} strokeWidth={1.7} />
              <span>
                {display.venueName}, {display.venueArea}
              </span>
            </li>
            <li>
              <Ticket aria-hidden size={20} strokeWidth={1.7} />
              <span>
                {formatPrice(display)} per guest · {display.inclusion}
              </span>
            </li>
          </ul>
        </div>

        <SmcBookingForm
          eventId={event.eventId}
          priceThb={event.priceThb}
          maxQuantity={event.remaining ?? 4}
          checkoutOpen={checkoutOpen}
          closedMessage={closedMessage}
          cancelled={searchParams.cancelled === '1'}
        />
      </main>
    </div>
  )
}
