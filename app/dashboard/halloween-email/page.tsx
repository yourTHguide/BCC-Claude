import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import HalloweenEmailClient from './HalloweenEmailClient'

export const dynamic = 'force-dynamic'

// Admin-only tool: preview the Halloween confirmation email (real QR per
// guest), send a test to yourself, then send to guests. URL-only, no nav link.
export default async function HalloweenEmailPage() {
  const admin = await getAdminUser()
  if (!admin || admin.role === 'staff') redirect('/login')
  return <HalloweenEmailClient />
}
