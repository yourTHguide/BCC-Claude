import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

// BEST leads inbox (Phase 3 finalization): private inquiries, contact
// messages, waitlist subscribers and human-approved waitlist announcements.
// Owner/admin only — customer personal data.
export default async function LeadsPage() {
  const admin = await getAdminUser()
  if (!admin || admin.role === 'staff') redirect('/login')
  return <LeadsClient />
}
