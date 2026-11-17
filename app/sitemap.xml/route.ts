import { resolveStorefront } from '@/lib/storefront'
import { CANONICAL_ORIGIN, isIndexableHost, sitemapPaths } from '@/lib/seo'
import { smcPageIndexable } from '@/lib/smc/env'

export const dynamic = 'force-dynamic'

// Per-domain sitemap (Nov 2026 SEO Phase 1): only that brand's public,
// canonical pages. No booking/payment/ticket states, no cross-brand
// duplicates, no preview hosts (they get an empty urlset).
export function GET(req: Request) {
  const host = req.headers.get('host')
  const storefront = resolveStorefront(host)
  const origin = CANONICAL_ORIGIN[storefront]
  const paths = isIndexableHost(host) ? sitemapPaths(storefront, { smcIndexable: smcPageIndexable() }) : []
  const urls = paths.map((p) => `  <url><loc>${origin}${p === '/' ? '/' : p}</loc></url>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
