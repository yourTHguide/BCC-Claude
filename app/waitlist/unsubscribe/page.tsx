import type { Metadata } from 'next'
import UnsubscribeClient from './UnsubscribeClient'

export const metadata: Metadata = {
  title: 'Unsubscribe · BEST Nightlife Thailand',
  robots: { index: false, follow: false },
}

export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  return <UnsubscribeClient token={searchParams.token || ''} />
}
