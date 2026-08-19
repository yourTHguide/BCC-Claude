import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'

// /dashboard depends on the auth session; render on demand, never prerender.
export const dynamic = 'force-dynamic'

// Authorization gate for the whole /dashboard subtree: a valid session is not
// enough — the user must be in admin_users. Non-admins are sent to /login.
// (Authentication for /dashboard is also enforced in middleware; this adds the
// admin-membership check and is the server-side source of truth.)
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getAdminUser()
  if (!admin) redirect('/login')
  return <>{children}</>
}
