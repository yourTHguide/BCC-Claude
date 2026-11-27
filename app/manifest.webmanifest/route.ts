import { NextRequest, NextResponse } from 'next/server'
import { resolveStorefront } from '@/lib/storefront'

// Web-app manifest (Nov 2026): "Add to Home Screen" uses the brand logo and
// name of the site it was added from. The dashboard opens straight to
// /dashboard when added from there.
export function GET(req: NextRequest) {
  const bnt = resolveStorefront(req.headers.get('host')) === 'bnt'
  const p = bnt ? 'bnt' : 'bcc'
  const bg = bnt ? '#070707' : '#1A0015'
  return NextResponse.json({
    name: bnt ? 'BEST Nightlife Thailand' : 'Bangkok Club Crawl',
    short_name: bnt ? 'BEST Nightlife' : 'Club Crawl',
    start_url: '/',
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: `/icons/${p}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/icons/${p}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `/icons/${p}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } })
}
