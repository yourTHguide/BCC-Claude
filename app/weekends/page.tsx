import type { Metadata } from 'next'
import WeekendsPage from '@/components/WeekendsPage'
import { buildPageMetadata } from '@/lib/seo'

// Authoritative BCC product page. bestnightlifethailand.com/weekends now
// 308-redirects here (next.config.js) instead of serving a duplicate.
export const metadata: Metadata = buildPageMetadata('bcc', {
  path: '/weekends',
  title: 'Bangkok Club Crawl — Friday & Saturday Nights',
  description: 'Four venues. A crowd worth meeting. The weekend Bangkok Club Crawl — Friday & Saturday nights in small hosted groups.',
})

export default function Weekends() {
  return <WeekendsPage />
}
