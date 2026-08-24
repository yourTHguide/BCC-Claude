// Shared icon registry for content list items (Highlights, What's Included,
// What's Not Included, Important Info). Canonical data stores only the
// stable string keys below (e.g. "users") — never rendered SVG/HTML, never
// an emoji. Both the admin icon picker and the public ProductPage renderer
// resolve an id through `resolveContentIcon` so there is exactly one place
// that maps an id to an actual icon.
//
// Uses lucide-react (already tree-shakeable: sideEffects:false + a proper
// ESM entry point) rather than a hand-maintained SVG set — importing only
// the icons below pulls only those into the client bundle, not the full
// library.
import {
  Users,
  UserCheck,
  Wine,
  Coffee,
  Building2,
  Globe,
  Smile,
  Gamepad2,
  Ticket,
  MapPin,
  Clock,
  Calendar,
  Tag,
  Sparkles,
  Heart,
  Music,
  Bus,
  Utensils,
  IdCard,
  ShieldAlert,
  PartyPopper,
  Camera,
  Crown,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

export const CONTENT_ICONS = {
  users: Users,
  host: UserCheck,
  wine: Wine,
  coffee: Coffee,
  city: Building2,
  globe: Globe,
  smile: Smile,
  games: Gamepad2,
  ticket: Ticket,
  'map-pin': MapPin,
  clock: Clock,
  calendar: Calendar,
  tag: Tag,
  sparkles: Sparkles,
  heart: Heart,
  music: Music,
  bus: Bus,
  utensils: Utensils,
  'id-card': IdCard,
  'shield-alert': ShieldAlert,
  party: PartyPopper,
  camera: Camera,
  vip: Crown,
  other: MoreHorizontal,
} as const satisfies Record<string, LucideIcon>

export type ContentIconId = keyof typeof CONTENT_ICONS

export const CONTENT_ICON_IDS = Object.keys(CONTENT_ICONS) as ContentIconId[]

// Human-readable labels for the admin icon picker. Public ProductPage
// rendering never imports this — it only resolves ids to components via
// resolveContentIcon below.
export const CONTENT_ICON_LABELS: Record<ContentIconId, string> = {
  users: 'Group / Friends',
  host: 'Host',
  wine: 'Drinks',
  coffee: 'Coffee',
  city: 'City / Venue',
  globe: 'Travel',
  smile: 'Fun / Social',
  games: 'Games',
  ticket: 'Ticket / Entry',
  'map-pin': 'Location',
  clock: 'Time',
  calendar: 'Date',
  tag: 'Price',
  sparkles: 'Highlight',
  heart: 'Favorite',
  music: 'Music',
  bus: 'Transport',
  utensils: 'Food',
  'id-card': 'ID Required',
  'shield-alert': 'Warning',
  party: 'Party',
  camera: 'Photo',
  vip: 'VIP Access',
  other: 'Other',
}

// Resolves a stored icon id to its component. Returns null for a missing,
// unknown, or since-deprecated id — callers render text-only in that case
// rather than throwing. This is the "fail gracefully" contract: an icon
// library change can never break a previously-saved item.
export function resolveContentIcon(id: string | null | undefined): LucideIcon | null {
  if (!id) return null
  return (CONTENT_ICONS as Record<string, LucideIcon>)[id] ?? null
}
