import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo'

// Internal QA route rendering BEST pages on any host — a duplicate of the real BEST pages, so kept out of search. Never indexed (Nov 2026 SEO Phase 1).
export const metadata: Metadata = { robots: NOINDEX }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
