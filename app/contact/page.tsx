import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveStorefront } from '@/lib/storefront'
import BntContactPage from '@/components/bnt/BntContactPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Contact | BEST NIGHTLIFE THAILAND',
}

// bkkclubcrawl.com has no /contact page today, so this route only exists for
// the BNT storefront — fail closed (404) for any other host rather than
// exposing BNT content as a de facto BCC page.
export default function ContactPage() {
  const host = headers().get('host')
  if (resolveStorefront(host) !== 'bnt') {
    notFound()
  }
  return <BntContactPage />
}
