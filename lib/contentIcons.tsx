// Shared icon registry for content list items (Highlights, What's Included,
// What's Not Included, Important Info). Canonical data stores only the
// stable string keys below (e.g. "users") — never rendered SVG/HTML, never
// an emoji. Both the admin icon picker (Stage 3) and the public
// ProductPage renderer (Stage 2) resolve an id through `resolveContentIcon`
// so there is exactly one place that maps an id to an actual icon.
//
// Uses lucide-react (already tree-shakeable: sideEffects:false + a proper
// ESM entry point) rather than a hand-maintained SVG set — importing only
// the ~20 icons below pulls only those into the client bundle, not the
// full library.
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
} as const satisfies Record<string, LucideIcon>

export type ContentIconId = keyof typeof CONTENT_ICONS

export const CONTENT_ICON_IDS = Object.keys(CONTENT_ICONS) as ContentIconId[]

// Resolves a stored icon id to its component. Returns null for a missing,
// unknown, or since-deprecated id — callers render text-only in that case
// rather than throwing. This is the "fail gracefully" contract: an icon
// library change can never break a previously-saved item.
export function resolveContentIcon(id: string | null | undefined): LucideIcon | null {
  if (!id) return null
  return (CONTENT_ICONS as Record<string, LucideIcon>)[id] ?? null
}
