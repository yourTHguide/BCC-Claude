import { Suspense } from 'react'
import BookV2Client from './BookV2Client'

// Isolated Phase 3 preview surface. Kept out of search indexes and unlinked
// from the nav — it exists only for Preview verification and side-by-side
// comparison against /book. Removed when /book is cut over.
export const metadata = {
  title: 'Book (v2 preview) — Bangkok Club Crawl',
  robots: { index: false, follow: false },
}

export default function BookV2Page() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', background: '#1A0015', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontFamily: 'Inter, sans-serif' }}>Loading…</p>
        </div>
      }
    >
      <BookV2Client />
    </Suspense>
  )
}
