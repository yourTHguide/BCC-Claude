import type { Metadata } from 'next'
import { NOINDEX } from '@/lib/seo'

// Staff sign-in. Never indexed (Nov 2026 SEO Phase 1).
export const metadata: Metadata = { robots: NOINDEX }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
