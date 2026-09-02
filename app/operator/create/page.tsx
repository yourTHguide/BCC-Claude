import Link from 'next/link'
import { Package, Users2, Sparkles, ArrowUpRight, Lock } from 'lucide-react'
import { operatorTheme as T, eyebrow } from '@/lib/operator/theme'

export const dynamic = 'force-dynamic'

// Phase 1A (SNX_PHASE1_ALIGNMENT_AUDIT.md §7a / Refinement 2): only what's
// genuinely proven gets a visible entry point. New Product uses BCC's real
// production flow (a TEMPORARY LINK-OUT, same caveat as Manage). Caption Set
// is a proven engine (per the Codex audit) but not migrated to SNX's
// production stack yet — shown, clearly inert, as "Coming next," not
// pretending to be functional. Everything else from the Create mockup
// (Blog/SEO Article, Recommendation, Reel Ideas/Scripts, Carousel, Repurpose
// Content, the asset-remix "Turn into" pattern) has no implementation
// evidence in either BCC-website or Living OS and is hidden entirely — not
// even a placeholder — per explicit instruction.
//
// Phase 3E: Partner + Proposal graduates from "Coming next" to a real
// in-shell flow — Setup (pick/create Partner, pick/create Deal context) ->
// Working Draft (edit/regenerate/request changes). It does NOT yet reach
// Finalize & Generate PDF; that's a later phase.
const ACTIVE = [
  { href: '/dashboard/products/new', label: 'New Nightlife Product / Experience', detail: 'BCC / BNT scheduled product flow', Icon: Package },
  { href: '/operator/create/proposal', label: 'Partner + Proposal', detail: 'Set up a partner, deal context, and draft', Icon: Users2 },
]

const COMING_NEXT = [
  { label: 'Caption Set', detail: 'Coming soon', Icon: Sparkles },
]

export default function OperatorCreatePage() {
  return (
    <div style={{ padding: '20px 18px 8px' }}>
      <p style={eyebrow(T.textFaint)}>Create</p>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '4px 0 4px' }}>Start Structured Work</h1>
      <p style={{ fontSize: '13px', color: T.textMuted, margin: '0 0 20px' }}>
        More creation tools are on the way.
      </p>

      {ACTIVE.map(({ href, label, detail, Icon }) => (
        <Link
          key={href}
          href={href}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '10px',
            background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, textDecoration: 'none', color: T.text,
          }}
        >
          <Icon size={17} color={T.statusGreen} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px' }}>{label}</p>
            <p style={{ fontSize: '11.5px', color: T.textMuted, margin: 0 }}>{detail}</p>
          </div>
          <ArrowUpRight size={15} color={T.textFaint} style={{ flexShrink: 0 }} />
        </Link>
      ))}

      <p style={{ ...eyebrow(T.textFaint), margin: '18px 0 10px' }}>Coming next</p>
      {COMING_NEXT.map(({ label, detail, Icon }) => (
        <div
          key={label}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', marginBottom: '10px',
            background: T.dashedBg, border: `1px dashed ${T.border}`, borderRadius: T.radiusSm, opacity: 0.55,
          }}
        >
          <Icon size={17} color={T.textFaint} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 1px', color: T.textFaint }}>{label}</p>
            <p style={{ fontSize: '11.5px', color: T.textFaint, margin: 0 }}>{detail}</p>
          </div>
          <Lock size={14} color={T.textFaint} style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}
