'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, MapPinned, Pencil, Plus } from 'lucide-react'
import { operatorTheme as T } from '@/lib/operator/theme'
import { LOCATION_LINK_FIELDS, normalizeLocationLink, type LocationLinkKey, type LocationLinks } from '@/lib/partnerLinks'

// One-tap buttons for a venue's Instagram / Facebook / TikTok / website /
// Google Maps, plus an inline form to paste or change them.

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
    </svg>
  )
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 3h-3v12.2a2.7 2.7 0 1 1-2.7-2.7c.3 0 .6 0 .8.1V9.5a5.8 5.8 0 1 0 4.9 5.7V9.1a7.3 7.3 0 0 0 4.1 1.3V7.3a4.2 4.2 0 0 1-4.1-4.3z" />
    </svg>
  )
}

const ICONS: Record<LocationLinkKey, (props: { size?: number }) => JSX.Element> = {
  instagramUrl: InstagramIcon,
  facebookUrl: FacebookIcon,
  tiktokUrl: TikTokIcon,
  websiteUrl: ({ size }) => <Globe size={size} />,
  googleMapsUrl: ({ size }) => <MapPinned size={size} />,
}

const iconButton = {
  width: '36px', height: '36px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${T.border}`, background: T.bg, color: T.text, textDecoration: 'none', flexShrink: 0,
} as const

export default function LocationLinksBar({ partnerId, locationId, venueName, links }: {
  partnerId: string
  locationId: string
  venueName: string
  links: LocationLinks
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<LocationLinkKey, string>>(() =>
    Object.fromEntries(LOCATION_LINK_FIELDS.map((f) => [f.key, links[f.key] ?? ''])) as Record<LocationLinkKey, string>
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const present = LOCATION_LINK_FIELDS.filter((f) => links[f.key])

  const save = async () => {
    setError(null)
    // Validate locally first so a typo is caught before the round trip.
    try {
      for (const f of LOCATION_LINK_FIELDS) normalizeLocationLink(f.key, draft[f.key])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid link.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/locations/${locationId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ links: draft }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? 'The links could not be saved.')
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The links could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: '10px' }}>
      {!editing && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {present.map((f) => {
            const Icon = ICONS[f.key]
            return (
              <a key={f.key} href={links[f.key]!} target="_blank" rel="noopener noreferrer" aria-label={`${venueName} on ${f.label}`} title={f.label} style={iconButton}>
                <Icon size={16} />
              </a>
            )
          })}
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ ...iconButton, width: 'auto', padding: '0 10px', gap: '5px', fontSize: '11.5px', fontWeight: 600, color: T.textMuted, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {present.length ? <Pencil size={12} /> : <Plus size={13} />}
            {present.length ? 'Edit links' : 'Add Instagram, Maps…'}
          </button>
        </div>
      )}

      {editing && (
        <div style={{ display: 'grid', gap: '8px', paddingTop: '4px' }}>
          {LOCATION_LINK_FIELDS.map((f) => {
            const Icon = ICONS[f.key]
            return (
              <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ ...iconButton, width: '32px', height: '32px', color: T.textMuted }} title={f.label}><Icon size={14} /></span>
                <input
                  value={draft[f.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  aria-label={f.label}
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: '8px', border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: '13px', fontFamily: 'inherit' }}
                />
              </label>
            )
          })}
          {error && <p role="alert" style={{ fontSize: '12px', color: T.statusRed, margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              style={{ flex: 1, padding: '10px', borderRadius: T.radiusSm, border: 'none', background: T.accent, color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit' }}
            >
              {saving ? 'Saving…' : 'Save links'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null) }}
              disabled={saving}
              style={{ padding: '10px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.borderStrong}`, background: 'transparent', color: T.text, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
