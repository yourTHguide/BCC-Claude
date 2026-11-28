import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Your night · Bangkok Club Crawl',
  description: 'Get ready for your Bangkok Club Crawl: what to know, and the WhatsApp group for your night.',
  robots: { index: false, follow: false },
}

export default function NightLayout({ children }: { children: React.ReactNode }) {
  return children
}
