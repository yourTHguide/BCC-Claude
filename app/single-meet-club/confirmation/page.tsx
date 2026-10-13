import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import SmcConfirmationStatus from '@/components/smc/SmcConfirmationStatus'
import { canRenderSmcPage } from '@/lib/smc/env'
import { brandFor } from '@/lib/storefrontBrand'
import '@/components/smc/smc.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your booking | Single Meet Club',
  robots: { index: false, follow: false },
}

// Stripe returns guests here with ?session_id=cs_… after checkout. The page
// only displays status; bookings are created exclusively by the SMC webhook.
export default function SmcConfirmationPage({ searchParams }: { searchParams: { session_id?: string } }) {
  if (!canRenderSmcPage()) notFound()
  const sessionId = searchParams.session_id && /^cs_(test|live)_[A-Za-z0-9]+$/.test(searchParams.session_id)
    ? searchParams.session_id
    : null

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
        <SmcConfirmationStatus sessionId={sessionId} supportWhatsappUrl={brandFor('bnt').supportWhatsappUrl} />
      </main>
    </div>
  )
}
