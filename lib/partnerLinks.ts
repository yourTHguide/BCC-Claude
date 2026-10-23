// Venue link fields (Instagram / Facebook / TikTok / website / Google Maps)
// on partner_locations. Client-safe: used by the Edit Links form for instant
// feedback and by the API route as the source of truth.

export const LOCATION_LINK_FIELDS = [
  { key: 'instagramUrl', column: 'instagram_url', label: 'Instagram', placeholder: 'instagram.com/venue or @venue' },
  { key: 'facebookUrl', column: 'facebook_url', label: 'Facebook', placeholder: 'facebook.com/venue' },
  { key: 'tiktokUrl', column: 'tiktok_url', label: 'TikTok', placeholder: 'tiktok.com/@venue or @venue' },
  { key: 'websiteUrl', column: 'website_url', label: 'Website', placeholder: 'venue.com' },
  { key: 'googleMapsUrl', column: 'google_maps_url', label: 'Google Maps', placeholder: 'Paste the Google Maps share link' },
] as const

export type LocationLinkKey = (typeof LOCATION_LINK_FIELDS)[number]['key']
export type LocationLinks = Record<LocationLinkKey, string | null>

/**
 * Turn whatever was pasted into a clean https URL, or null when blank.
 * "@handle" becomes the profile URL for Instagram/TikTok; a bare domain gets
 * https:// added. Throws with a readable message when it can't be a link.
 */
export function normalizeLocationLink(key: LocationLinkKey, raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  if (value.startsWith('@')) {
    const handle = value.slice(1).replace(/\/+$/, '')
    if (!/^[A-Za-z0-9._]+$/.test(handle)) throw new Error(`That doesn't look like a valid handle: ${value}`)
    if (key === 'instagramUrl') return `https://www.instagram.com/${handle}/`
    if (key === 'tiktokUrl') return `https://www.tiktok.com/@${handle}`
    throw new Error('Paste the full link here, not an @handle.')
  }

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw new Error(`That doesn't look like a link: ${value}`)
  }
  if (!url.hostname.includes('.')) throw new Error(`That doesn't look like a link: ${value}`)
  url.protocol = 'https:'
  return url.toString()
}
