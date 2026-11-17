import type { Metadata } from 'next'
import type { Storefront } from './storefront'
import { STOREFRONT_BRAND } from './storefrontBrand'

// Technical SEO for the two storefronts this one app serves (Nov 2026 audit,
// Phase 1). The single place that decides, per brand:
//   - the canonical origin (preferred host) every canonical/OG URL uses,
//   - the default title / description / share image,
//   - which public pages belong in that brand's sitemap.
// Cross-domain redirects for pages that belong to the other brand live in
// next.config.js (they have to run before any page renders).
//
// Copy here is taken from wording already on the live pages — no new
// commercial claims, prices, times or review counts.

export const CANONICAL_ORIGIN: Record<Storefront, string> = {
  bcc: 'https://www.bkkclubcrawl.com',
  bnt: 'https://bestnightlifethailand.com',
}

// Hosts that are allowed to be indexed. Everything else (bcc-claude.vercel.app,
// preview deployment URLs, localhost) is served with noindex.
export const CANONICAL_HOSTS = new Set(['www.bkkclubcrawl.com', 'bestnightlifethailand.com'])

interface SiteDefaults {
  siteName: string
  title: string
  description: string
  ogDescription: string
  image: string
  imageAlt: string
}

export const SITE_DEFAULTS: Record<Storefront, SiteDefaults> = {
  bcc: {
    siteName: 'Bangkok Club Crawl',
    title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
    description:
      'Premium structured nightlife experience in Bangkok. Curated venues, VIP entry, and dedicated hosts every weekend.',
    ogDescription: 'Curated venues. VIP entry. A crowd worth meeting.',
    image: '/og/bcc.jpg',
    imageAlt: 'Bangkok Club Crawl guests at a Bangkok venue',
  },
  bnt: {
    siteName: 'BEST Nightlife Thailand',
    title: 'Bangkok Nightlife. Unlocked. | BEST NIGHTLIFE THAILAND',
    description:
      'Private parties, luxury yachts, and VIP club access. Perfectly designed for you. BEST NIGHTLIFE THAILAND is your premium nightlife concierge.',
    ogDescription:
      'Private parties, luxury yachts, and VIP club access. Perfectly designed for you.',
    image: '/og/bnt.jpg',
    imageAlt: 'Rooftop event above the Bangkok skyline',
  },
}

export function isProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').toLowerCase().split(':')[0]
}

// True only for the production deployment served on a preferred host.
export function isIndexableHost(host: string | null | undefined): boolean {
  return isProductionDeployment() && CANONICAL_HOSTS.has(normalizeHost(host))
}

export function canonicalUrl(storefront: Storefront, path: string): string {
  // Homepage keeps its trailing slash so it matches the sitemap <loc> exactly.
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${CANONICAL_ORIGIN[storefront]}${clean}`
}

interface PageSeo {
  // Canonical path on this storefront (or on the other one, for a page whose
  // authoritative copy lives on the other brand).
  path: string
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  image?: string
  imageAlt?: string
  // Which brand's origin the canonical points at. Defaults to `storefront`.
  canonicalStorefront?: Storefront
  noindex?: boolean
}

// Full, self-contained Metadata for one page. Next.js replaces (does not
// merge) a parent's openGraph/twitter objects when a page sets them, so every
// page builds the whole set here — that's what stops BCC share tags leaking
// onto BEST pages again.
export function buildPageMetadata(storefront: Storefront, seo: PageSeo): Metadata {
  const d = SITE_DEFAULTS[storefront]
  const title = seo.title ?? d.title
  const description = seo.description ?? d.description
  const ogTitle = seo.ogTitle ?? title
  const ogDescription = seo.ogDescription ?? seo.description ?? d.ogDescription
  const image = seo.image ?? d.image
  const imageAlt = seo.imageAlt ?? d.imageAlt
  const url = canonicalUrl(seo.canonicalStorefront ?? storefront, seo.path)
  const imageUrl = `${CANONICAL_ORIGIN[storefront]}${image}`

  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url,
      siteName: d.siteName,
      type: 'website',
      locale: 'en_US',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: [imageUrl],
    },
  }
  if (seo.noindex) metadata.robots = { index: false, follow: false }
  return metadata
}

// Private / transactional states: never indexed, never in a sitemap.
export const NOINDEX: Metadata['robots'] = { index: false, follow: false }

// Organization + WebSite structured data per brand. Only facts already
// published on the sites (name, logo, URL, Instagram, shared WhatsApp line).
export function organizationJsonLd(storefront: Storefront): Record<string, unknown> {
  const brand = STOREFRONT_BRAND[storefront]
  const origin = CANONICAL_ORIGIN[storefront]
  const sameAs =
    storefront === 'bcc'
      ? ['https://instagram.com/bkkclubcrawl']
      : ['https://www.instagram.com/nightlife.thailand']
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: brand.name,
        url: `${origin}/`,
        logo: `${origin}${brand.logoSrc}`,
        email: brand.supportEmail,
        sameAs,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+66-66-039-9569',
          contactType: 'customer service',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: brand.name,
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  }
}

// Public, canonical pages per sitemap. Transactional, private, retired and
// cross-brand duplicate routes are deliberately absent.
export function sitemapPaths(storefront: Storefront, opts: { smcIndexable: boolean }): string[] {
  if (storefront === 'bcc') return ['/', '/weekends']
  const paths = ['/', '/new-in-bangkok', '/about', '/contact']
  if (opts.smcIndexable) paths.splice(2, 0, '/single-meet-club')
  return paths
}
