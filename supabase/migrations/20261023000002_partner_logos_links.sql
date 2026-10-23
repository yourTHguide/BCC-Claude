-- ============================================================
-- Partner logos + venue links (Instagram / Facebook / TikTok /
-- website / Google Maps).
-- ============================================================
-- Additive only: nullable columns, nothing existing changes. Logo is per
-- partner (a group like SOHO has one brand mark); links are per venue,
-- because each venue under a group has its own Instagram and map pin.
-- URLs are validated/normalised in the API layer (lib/partnerLinks.ts).
-- ============================================================

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.partner_locations
  ADD COLUMN IF NOT EXISTS instagram_url   TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url    TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url      TEXT,
  ADD COLUMN IF NOT EXISTS website_url     TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

COMMENT ON COLUMN public.partners.logo_url IS
  'Partner logo: a site-relative path (e.g. /partner-logos/aces.jpg) or an absolute https URL.';
