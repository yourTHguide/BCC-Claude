import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServiceSupabase } from '@/lib/supabase'
import { INVITE_PROBLEM_TEXT, inviteProblem, loadInvite } from '@/lib/hostInvites'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your invite — Bangkok Club Crawl', robots: { index: false, follow: false } }

// Phase 3C: a host's invite link, /with/<host>/<code>. A working link opens
// the booking calendar on the invited night (the guest picks how many
// tickets and pays the normal price). A used, expired or cancelled link says
// so and offers the normal calendar.
export default async function InvitePage({ params }: { params: { host: string; code: string } }) {
  let inv = null
  let date: string | null = null
  try {
    const db = getServiceSupabase()
    inv = await loadInvite(db, params.code.toLowerCase())
    if (inv) {
      const { data } = await db.from('event_dates').select('event_date').eq('id', inv.event_id).maybeSingle()
      date = (data as any)?.event_date ?? null
    }
  } catch {
    inv = null
  }
  const problem = inviteProblem(inv, null)
  if (!problem && inv && date) redirect(`/book?date=${date}&invite=${inv.code}`)

  return (
    <main style={{ minHeight: '100vh', background: '#0D000A', color: '#fff', fontFamily: 'Inter, sans-serif', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '420px', textAlign: 'center' }}>
        <p style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#EA003A', fontWeight: 600 }}>Bangkok Club Crawl</p>
        <h1 style={{ fontSize: '22px', margin: '8px 0 12px' }}>{INVITE_PROBLEM_TEXT[problem ?? 'not_found']}</h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: 1.5 }}>
          {problem === 'used' || problem === 'expired' ? 'Ask your host for a new link, or ' : ''}book your night on our calendar — same price, same party.
        </p>
        <Link href="/book" style={{ display: 'inline-block', marginTop: '18px', padding: '12px 22px', borderRadius: '10px', background: 'linear-gradient(135deg, #EA003A 0%, #820065 100%)', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
          See available nights
        </Link>
      </div>
    </main>
  )
}
