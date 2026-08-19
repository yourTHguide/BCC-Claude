-- ============================================================
-- PHASE 4 · Stage 8b — Supabase Storage bucket for Product media
-- ============================================================
-- Public-read, no public write. Admin uploads/deletes go through
-- authenticated Next.js admin routes using the server-side service role
-- (Stage 8d) — no new auth model. storage.objects already has RLS enabled
-- with no policies (verified pre-migration: relrowsecurity=true on
-- storage.objects project-wide, zero rows in pg_policies), so this bucket
-- inherits the same deny-by-default, service-role-only write posture as
-- product_content/product_media.
--
-- Idempotent: ON CONFLICT keeps a re-run a no-op against an existing bucket
-- with the same config.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
