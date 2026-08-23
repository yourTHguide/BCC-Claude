import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAdminUser } from '@/lib/admin-auth'

// /dashboard depends on the auth session; render on demand, never prerender.
export const dynamic = 'force-dynamic'

// Paths a 'staff' (Host) admin_user may reach directly. Everything else
// under /dashboard/* — the owner calendar/EventPanel, product/storefront
// config — redirects a staff user to their own landing page instead.
const STAFF_ALLOWED_PREFIXES = ['/dashboard/host', '/dashboard/checkin']

// Authorization gate for the whole /dashboard subtree: a valid session is not
// enough — the user must be in admin_users. Non-admins are sent to /login.
// (Authentication for /dashboard is also enforced in middleware; this adds the
// admin-membership check and is the server-side source of truth.)
//
// Stage 9j: also redirects a 'staff' role away from owner-only pages
// (`/dashboard`, `/dashboard/products/*`) to `/dashboard/host`. Read this as
// defense-in-depth / correct UX landing, NOT as the real security boundary —
// it does not, and cannot, restrict what a staff user's browser can read
// directly from Supabase via the anon key, because event_dates/bookings/
// ota_bookings/expenses all currently carry a public `USING (true)` SELECT
// policy (pre-existing, unrelated to role). The real enforcement for
// revenue/host-pay data is that the NEW `/api/admin/host/*` routes
// (app/dashboard/host) never fetch those fields server-side in the first
// place. See PHASE4_CHECKPOINT.md for the full explanation of this gap.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getAdminUser()
  if (!admin) redirect('/login')

  if (admin.role === 'staff') {
    const pathname = headers().get('x-pathname') || ''
    if (!STAFF_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))) {
      redirect('/dashboard/host')
    }
  }

  return <>{children}</>
}
