import { resolveStorefront } from '@/lib/storefront'
import { CANONICAL_ORIGIN, isIndexableHost } from '@/lib/seo'

export const dynamic = 'force-dynamic'

// Per-domain robots.txt (Nov 2026 SEO Phase 1). Only the production
// deployment on a preferred host may be crawled; bcc-claude.vercel.app,
// preview URLs and local dev disallow everything.
export function GET(req: Request) {
  const host = req.headers.get('host')
  let body: string
  if (!isIndexableHost(host)) {
    body = 'User-agent: *\nDisallow: /\n'
  } else {
    const origin = CANONICAL_ORIGIN[resolveStorefront(host)]
    body = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /dashboard',
      'Disallow: /operator',
      'Disallow: /login',
      'Disallow: /set-password',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n')
  }
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
