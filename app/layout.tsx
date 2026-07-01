import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
  description: 'Premium structured nightlife experience in Bangkok. Curated venues, VIP entry, and dedicated hosts every weekend.',
  openGraph: {
    title: 'Bangkok Club Crawl — Bangkok Nights. Done Right.',
    description: 'Curated venues. VIP entry. A crowd worth meeting.',
    url: 'https://bkkclubcrawl.com',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ overflowX: 'hidden', maxWidth: '100vw' }}>{children}</body>
    </html>
  )
}
