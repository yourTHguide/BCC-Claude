import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { resolveStorefront } from '@/lib/storefront'
import { isPreviewOrDev, isSmcPagePublished } from '@/lib/smc/env'
import { isPreviewAccessConfigured } from '@/lib/smc/previewAccess'
import SmcAccessForm from '@/components/smc/SmcAccessForm'
import '@/components/smc/smc.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Private access | Single Meet Club',
  robots: { index: false, follow: false },
}

// Pre-launch private access (lib/smc/previewAccess.ts). Exists only while
// SMC_PREVIEW_CODE is set and the page is not yet published.
export default function SmcAccessPage() {
  if (!isPreviewAccessConfigured() || isSmcPagePublished()) notFound()
  if (!isPreviewOrDev() && resolveStorefront(headers().get('host')) !== 'bnt') notFound()

  return (
    <div className="smc-page smc-book-page">
      <main className="smc-container smc-book-main">
        <p className="smc-eyebrow">Single Meet Club</p>
        <h1 className="smc-h2">Private access</h1>
        <SmcAccessForm />
      </main>
    </div>
  )
}
