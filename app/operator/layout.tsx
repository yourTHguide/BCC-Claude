import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-auth'
import { operatorTheme as T } from '@/lib/operator/theme'
import OperatorBottomNav from './OperatorBottomNav'
import ThemeToggle from './ThemeToggle'
import './operator-theme.css'

// /operator depends on the auth session; never prerender.
export const dynamic = 'force-dynamic'

// Authorization gate for the whole /operator subtree — same pattern as
// app/dashboard/layout.tsx: a valid session is not enough, the user must be
// in admin_users. (Authentication is also enforced in middleware.ts; this is
// the server-side source of truth for membership + role.)
//
// Phase 1 scope decision: /operator is owner/admin only. Unlike /dashboard,
// there is no staff-safe redacted view built for it yet (Records would
// surface bookings/expenses the audit flags as revenue-sensitive for staff).
// A 'staff' admin_user is sent to their existing landing page instead.
export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const admin = await getAdminUser()
  if (!admin) redirect('/login?redirect=/operator')
  if (admin.role === 'staff') redirect('/dashboard/host')

  return (
    <div id="operator-shell" style={{ minHeight: '100vh', background: T.bg, color: T.text, fontFamily: T.fontFamily }}>
      {/* Applies a stored theme choice before first paint, so switching pages
          never flashes system-default before snapping to a saved preference.
          No stored value -> no attribute set -> CSS media query (system
          preference) keeps deciding, exactly like the un-toggled default. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var t=localStorage.getItem('operator-theme');if(t==='light'||t==='dark'){document.getElementById('operator-shell').setAttribute('data-theme',t);}}catch(e){}})();",
        }}
      />
      <div style={{ maxWidth: T.maxWidth, margin: '0 auto', minHeight: '100vh', paddingBottom: '92px' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '10px 16px',
            background: T.bg,
            borderBottom: `1px solid ${T.border}`,
          }}
        >
          <ThemeToggle />
        </div>
        {children}
      </div>
      <OperatorBottomNav />
    </div>
  )
}
