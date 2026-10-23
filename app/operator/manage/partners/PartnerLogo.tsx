import { Handshake } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'

// Partner logo tile used by the directory (list + grid) and the profile.
// Falls back to the generic handshake mark when a partner has no logo yet.
export default function PartnerLogo({ src, name, size, radius = '10px' }: { src: string | null; name: string; size: number; radius?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} logo`}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0, border: `1px solid ${T.border}`, background: T.chipBg }}
      />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: T.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Handshake size={Math.round(size * 0.42)} color={T.textFaint} />
    </div>
  )
}
