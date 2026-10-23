import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import { listCaptions } from '@/lib/captionStore'
import CaptionsClient from './CaptionsClient'

export const dynamic = 'force-dynamic'

// Create -> Captions: the Bangkok Club Crawl Caption Library. Same shelf
// Living OS reads (public.captions). Pick a vibe, copy, it moves to Used;
// tap Generate to have Gemini write 20 more in the BCC voice.
// Auth: the /operator layout already restricts this subtree to owner/admin.
export default async function CreateCaptionsPage() {
  let captions: Awaited<ReturnType<typeof listCaptions>> = []
  let loadError: string | null = null
  try {
    captions = await listCaptions()
  } catch (error) {
    console.error('CreateCaptionsPage:', error)
    loadError = 'The caption shelf could not be opened.'
  }

  return (
    <div style={{ padding: '20px 18px 40px' }}>
      <Link href="/operator/create" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Create
      </Link>
      <p style={eyebrow(T.textFaint)}>Create · Bangkok Club Crawl</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Captions</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 18px', lineHeight: 1.5 }}>
        Pick the vibe that matches your photos, copy, and post. Copied captions move to Used.
      </p>

      <CaptionsClient initialCaptions={captions} initialError={loadError} />
    </div>
  )
}
