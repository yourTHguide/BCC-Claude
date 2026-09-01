import Link from 'next/link'
import { Package, LayoutDashboard, ChevronRight, Info } from 'lucide-react'
import { getAdminUser } from '@/lib/admin-auth'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Link-outs only, per Phase 1 scope: existing desktop/admin-console tools
// (product admin) aren't rebuilt into the mobile shell, just linked. Email
// Preview (app/dashboard/email-preview/[token]) has no index route — it only
// exists per-booking-token — so there's nothing generic to link to here.
const LINKS = [
  { href: '/dashboard/products', label: 'Product Admin', detail: 'Products, schedules, content, media', Icon: Package },
  { href: '/dashboard', label: 'BCC Dashboard', detail: 'Full owner calendar & day panel', Icon: LayoutDashboard },
]

export default async function OperatorMorePage() {
  const admin = await getAdminUser()

  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>More</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 20px' }}>Settings & Tools</h1>

      {admin && (
        <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: '13px 14px', marginBottom: '18px' }}>
          <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px' }}>{admin.email}</p>
          <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0, textTransform: 'capitalize' }}>{admin.role}</p>
        </div>
      )}

      <p style={{ ...eyebrow(T.textFaint), marginBottom: '10px' }}>Existing tools</p>
      {LINKS.map(({ href, label, detail, Icon }) => (
        <Link
          key={href}
          href={href}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '10px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          <Icon size={17} color={T.textMuted} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{detail}</p>
          </div>
          <ChevronRight size={16} color={T.textFaint} />
        </Link>
      ))}

      <div style={{ display: 'flex', gap: '8px', padding: '13px 14px', marginTop: '18px', background: T.dashedBg, border: `1px dashed ${T.border}`, borderRadius: T.radiusSm }}>
        <Info size={15} color={T.textFaint} style={{ flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '12px', color: T.textFaint, margin: 0, lineHeight: 1.5 }}>
          Email Preview is per-booking (opened from a confirmation email link) and has no general page to link here.
        </p>
      </div>
    </div>
  )
}
