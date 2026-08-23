// Quick Add presets for the What's Included admin editor only (Stage 4,
// revised scope). Admin-only convenience data — selecting one just
// materializes a normal canonical ContentItem ({icon, text}); nothing here
// is a preset id or business rule. components/ProductPage.tsx must never
// import this file.
import type { ContentIconId } from '@/lib/contentIcons'

export interface WhatsIncludedPreset {
  id: string // local React key only — never persisted
  label: string // Quick Add tile label
  icon: ContentIconId
  text: string // default item text; freely editable after adding
}

export const WHATS_INCLUDED_PRESETS: WhatsIncludedPreset[] = [
  { id: 'welcome-drink', label: 'Welcome drink', icon: 'wine', text: 'Welcome drink' },
  { id: 'entry', label: 'Entry to venues', icon: 'ticket', text: 'Entry to venues' },
  { id: 'host', label: 'Host', icon: 'host', text: 'Host' },
  { id: 'drinking-games', label: 'Drinking games', icon: 'games', text: 'Drinking games' },
  { id: 'transport', label: 'Transport', icon: 'bus', text: 'Transport' },
  { id: 'food', label: 'Food', icon: 'utensils', text: 'Food' },
  { id: 'photo-ops', label: 'Photo ops', icon: 'camera', text: 'Photo opportunities' },
  { id: 'vip-access', label: 'VIP access', icon: 'vip', text: 'VIP access' },
  { id: 'other', label: 'Other', icon: 'other', text: '' },
]
