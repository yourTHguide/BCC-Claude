import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
import Hero from '@/components/Hero'
import Trust from '@/components/Trust'
import HowItWorks from '@/components/HowItWorks'
import People from '@/components/People'
import Stops from '@/components/Stops'
import Reviews from '@/components/Reviews'
import Hosts from '@/components/Hosts'
import FAQ from '@/components/FAQ'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'
import StickyBar from '@/components/StickyBar'
import { resolveStorefront } from '@/lib/storefront'
import BntLandingPage from '@/components/bnt/BntLandingPage'

export const dynamic = 'force-dynamic'

// The root layout's static `metadata` export is BCC-branded (it's the
// long-standing default for bkkclubcrawl.com); this override only replaces
// it for the BNT host, matching landing.html's own <title>/description
// exactly. Returning undefined-equivalent (an empty object won't work —
// Next.js requires a full object) for the BCC case would blank the title,
// so the BCC branch re-states the layout's existing values verbatim rather
// than omitting them.
export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('host')
  if (resolveStorefront(host) === 'bnt') {
    return {
      title: 'Bangkok Nightlife. Unlocked. | BEST NIGHTLIFE THAILAND',
      description:
        'Private parties, luxury yachts, and VIP club access. Perfectly designed for you. BEST NIGHTLIFE THAILAND is your premium nightlife concierge.',
    }
  }
  return {
    title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
    description:
      'Premium structured nightlife experience in Bangkok. Curated venues, VIP entry, and dedicated hosts every weekend.',
    openGraph: {
      title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
      description: 'Curated venues. VIP entry. A crowd worth meeting.',
      url: 'https://bkkclubcrawl.com',
      type: 'website',
    },
  }
}

export default function Home() {
  const host = headers().get('host')
  if (resolveStorefront(host) === 'bnt') {
    return <BntLandingPage />
  }

  return (
    <>
      <Navigation />
      <main>
        <Hero />
        <Trust />
        <HowItWorks />
        <People />
        <Stops />
        <Reviews />
        <Hosts />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <StickyBar />
    </>
  )
}
