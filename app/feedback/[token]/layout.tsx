import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Feedback · Bangkok Club Crawl', robots: { index: false, follow: false } }

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return children
}
