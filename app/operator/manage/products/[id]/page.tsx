import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, ArrowUpRight, FileText, Image as ImageIcon, CalendarDays, Package } from 'lucide-react'
import { getProductDetail, getProductContent, getProductInstanceRows } from '@/lib/operator/products'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'
import ProductLifecycleControl from './ProductLifecycleControl'

export const dynamic = 'force-dynamic'

const STATUS_COLOR: Record<string, string> = { active: T.statusGreen, draft: T.statusAmber, archived: T.textMuted }
const STATUS_SOFT: Record<string, string> = { active: T.statusGreenSoft, draft: T.statusAmberSoft, archived: T.chipBg }

const baht = (n: number | null) => (n == null ? '—' : `฿${n.toLocaleString()}`)
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—')

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ ...eyebrow(T.textFaint), marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{value}</p>
    </div>
  )
}

function SectionLabel({ children, mt = 20 }: { children: React.ReactNode; mt?: number }) {
  return <p style={{ ...eyebrow(T.textFaint), margin: `${mt}px 0 9px` }}>{children}</p>
}

function LinkRow({ href, Icon, label, detail }: { href: string; Icon: any; label: string; detail: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 14px', marginBottom: '8px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text, minHeight: '44px' }}>
      <Icon size={18} color={T.textMuted} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '14.5px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
        <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{detail}</p>
      </div>
      <ArrowUpRight size={16} color={T.textFaint} />
    </Link>
  )
}

// Product owns identity + content + media. Calendar/Instances (Phase 2B)
// keeps owning scheduling; Event Operations (Phase 2A) keeps owning
// operational state — this page provides read-only context and deep-links
// into both, never duplicating either (SNX_PHASE2C plan §6). Basic Info/
// Pricing fields render read-only here: no write route exists anywhere in
// production for name/slug/default_price/default_start_time/early-bird
// pricing (confirmed by audit), so none is invented in this phase.
export default async function ProductOverviewPage({ params }: { params: { id: string } }) {
  const product = await getProductDetail(params.id)
  if (!product) notFound()

  const [content, instances] = await Promise.all([
    getProductContent(params.id),
    getProductInstanceRows(params.id),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = instances.filter((i) => i.eventDate >= today).slice(0, 5)

  const priceStats: { label: string; value: React.ReactNode }[] = [
    { label: 'Standard price', value: baht(product.defaultPrice) },
  ]
  if (product.earlyBirdPrice != null) {
    priceStats.push({
      label: 'Early-bird price',
      value: `${baht(product.earlyBirdPrice)}${product.earlyBirdCutoffHours != null ? ` (${product.earlyBirdCutoffHours}h cutoff)` : ''}`,
    })
  }
  priceStats.push({ label: 'Start time', value: hhmm(product.defaultStartTime) })
  if (content.durationMinutes != null) priceStats.push({ label: 'Duration', value: `${content.durationMinutes} min` })

  return (
    <div style={{ padding: '20px 18px 40px' }}>
      <Link href="/operator/manage/products" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: T.textMuted, textDecoration: 'none', marginBottom: '10px' }}>
        <ChevronLeft size={14} /> Products
      </Link>

      {/* Identity */}
      {product.coverUrl ? (
        <img src={product.coverUrl} alt="" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: T.radius, marginBottom: '14px' }} />
      ) : (
        <div style={{ width: '100%', height: '72px', borderRadius: T.radius, background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
          <Package size={22} color={T.textFaint} />
        </div>
      )}
      <p style={eyebrow(T.textFaint)}>{product.slug}</p>
      <h1 style={{ fontSize: '21px', fontWeight: 700, margin: '4px 0 8px' }}>{product.name}</h1>
      {content.tagline && <p style={{ fontSize: '13.5px', color: T.textMuted, margin: '0 0 4px', lineHeight: 1.5 }}>{content.tagline}</p>}

      {/* Lifecycle + storefront */}
      <SectionLabel>Lifecycle &amp; Storefront</SectionLabel>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '11px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: STATUS_COLOR[product.status], background: STATUS_SOFT[product.status] }}>
          {product.status}
        </span>
        {product.visibleBcc && <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>BCC</span>}
        {product.visibleBnt && <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.textMuted, background: T.chipBg }}>BNT</span>}
        {!product.visibleBcc && !product.visibleBnt && <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', color: T.textFaint, background: T.chipBg }}>No storefront</span>}
      </div>
      <ProductLifecycleControl
        productId={product.id}
        status={product.status}
        visibleBcc={product.visibleBcc}
        visibleBnt={product.visibleBnt}
        defaultPrice={product.defaultPrice}
        upcomingOpen={product.events.upcomingOpen}
      />

      {/* Pricing / start time / duration */}
      <SectionLabel>Pricing &amp; Timing</SectionLabel>
      <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '15px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px' }}>
        {priceStats.map((s) => <Stat key={s.label} label={s.label} value={s.value} />)}
      </div>

      {/* Schedule configuration + instance context */}
      <SectionLabel>Schedule</SectionLabel>
      <div style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '15px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px' }}>
        <Stat label="Configuration" value={product.scheduleLabel} />
        <Stat label="Event instances" value={`${product.events.total} total`} />
        <Stat label="Upcoming & open" value={product.events.upcomingOpen} />
        <Stat label="Next open date" value={product.events.nextOpenDate ?? '—'} />
      </div>

      {/* Details action / Media action */}
      <SectionLabel mt={10}>Edit</SectionLabel>
      <LinkRow href={`/operator/manage/products/${product.id}/details`} Icon={FileText} label="Details" detail="Description, meeting point, what's included" />
      <LinkRow href={`/operator/manage/products/${product.id}/media`} Icon={ImageIcon} label="Media" detail="Cover image & gallery" />

      {/* Recent / upcoming instances */}
      <SectionLabel>Upcoming Instances</SectionLabel>
      {upcoming.length === 0 && <p style={{ fontSize: '13px', color: T.textFaint, marginBottom: '10px' }}>No upcoming instances.</p>}
      {upcoming.map((inst) => (
        <Link
          key={inst.id}
          href={`/operator/manage/calendar/${inst.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', marginBottom: '8px', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text }}
        >
          <CalendarDays size={16} color={T.textMuted} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13.5px', fontWeight: 600, margin: '0 0 2px' }}>{inst.eventDate}</p>
            <p style={{ fontSize: '11px', color: T.textMuted, margin: 0 }}>
              {inst.isOpen ? 'Open' : 'Closed'} · {inst.bookingCount} booked
            </p>
          </div>
          <ChevronRight size={15} color={T.textFaint} />
        </Link>
      ))}
      {instances.length > upcoming.length && (
        <p style={{ fontSize: '11.5px', color: T.textFaint, marginTop: '2px' }}>
          {instances.length - upcoming.length} more on Calendar / Instances.
        </p>
      )}
    </div>
  )
}
