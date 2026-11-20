import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { resolveStorefront } from '@/lib/storefront'
import { buildPageMetadata } from '@/lib/seo'
import { privacyAvailable, privacyPublished } from '@/lib/privacy/publish'
import { isProductionHost } from '@/lib/consentConfig'
import type { Storefront } from '@/lib/storefront'
import { BRAND_THEME } from '@/components/privacy/NoticeParts'
import BestPrivacyNotice from '@/components/privacy/BestPrivacyNotice'
import BccPrivacyNotice from '@/components/privacy/BccPrivacyNotice'
import LegalLinks from '@/components/consent/LegalLinks'

export const dynamic = 'force-dynamic'

// The site-wide viewport sets maximumScale: 1 (no pinch-zoom). A legal notice
// must be zoomable (WCAG 1.4.4), so this page allows it.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, viewportFit: 'cover' }

// Brand-specific privacy notice: BEST on bestnightlifethailand.com, BCC on
// bkkclubcrawl.com. See lib/privacy/publish.ts for when it is served.
export function generateMetadata(): Metadata {
  const host = headers().get('host')
  const storefront = resolveStorefront(host)
  const base = buildPageMetadata(storefront, {
    path: '/privacy',
    title: storefront === 'bnt' ? 'Privacy Notice | BEST Nightlife Thailand' : 'Privacy Notice | Bangkok Club Crawl',
    description: 'How we collect, use and protect personal data, your rights, and cookie choices.',
  })
  return privacyPublished(storefront) ? base : { ...base, robots: { index: false, follow: false } }
}

// Review aid: on previews/local (never production) ?brand=bnt|bcc shows the
// other brand's notice, because preview hosts always resolve to BCC.
function brandFor(host: string | null, brand?: string): Storefront {
  if (!isProductionHost(host) && (brand === 'bnt' || brand === 'bcc')) return brand
  return resolveStorefront(host)
}

export default function PrivacyPage({ searchParams }: { searchParams: { brand?: string } }) {
  const host = headers().get('host')
  const storefront = brandFor(host, searchParams.brand)
  if (!privacyAvailable(host, storefront)) notFound()
  const t = BRAND_THEME[storefront]
  const draft = !privacyPublished(storefront)

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: '#FFFFFF', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '18px 20px' }}>
        <a href="/" style={{ color: '#FFFFFF', textDecoration: 'none', fontFamily: t.heading, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 13 }}>
          ← {t.name}
        </a>
      </header>
      {draft && (
        <p role="note" style={{ margin: 0, padding: '12px 20px', background: 'rgba(255,196,0,0.15)', borderBottom: '1px solid rgba(255,196,0,0.5)', color: '#FFE08A', fontSize: 14 }}>
          DRAFT for review — not published and not legally reviewed. Highlighted items still need a decision.
        </p>
      )}
      <main style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 80px', fontSize: 16, lineHeight: 1.65 }} className="privacy-notice">
        {storefront === 'bnt' ? <BestPrivacyNotice /> : <BccPrivacyNotice />}
      </main>
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        © 2026 Sanctuary Nexus Co., Ltd. · <LegalLinks />
      </footer>
      <style>{`
        .privacy-notice a { color: #FFFFFF; text-decoration: underline; text-decoration-color: ${t.accent}; text-underline-offset: 3px; }
        .privacy-notice a:focus-visible, .privacy-notice [tabindex]:focus-visible { outline: 2px solid ${t.accent}; outline-offset: 2px; }
        .privacy-notice ul { padding-left: 22px; }
        .privacy-notice li { margin: 6px 0; }
        .privacy-notice h1, .privacy-notice h2 { font-family: ${t.heading}; }
        .privacy-notice code { font-size: 0.9em; background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; }
      `}</style>
    </div>
  )
}
