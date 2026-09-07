-- ============================================================
-- Phase 3C-1 — Proposal PDF storage bucket
-- ============================================================
-- Private bucket for durable, write-once approved-proposal PDFs
-- (SNX_PHASE3B_PARTNER_PROPOSAL_ARCHITECTURE.md §8, correction pass item 3;
-- SNX_PHASE3C_PARTNER_PROPOSAL_IMPLEMENTATION_PLAN.md §2).
--
-- Deliberately the OPPOSITE posture of the existing 'product-media' bucket
-- (20260819180419_phase4c_storage_bucket_product_media.sql), which is
-- public-read by design for storefront images. Proposal PDFs are
-- confidential partner-facing commercial documents and must never be
-- publicly reachable.
--
-- public = false, and NO storage.objects policy is added for this bucket
-- (or any bucket) here. storage.objects already has RLS enabled with zero
-- policies project-wide (verified pre-existing, see the product-media
-- migration's own comment) -- a private bucket with no policy is therefore
-- already service-role-only by construction. Access from the app is always
-- a short-lived signed URL generated server-side with the service role
-- (lib/proposalPdfStorage.ts, Phase 3C §2/§3) -- never a public URL, never
-- a client-side/anon read.
--
-- This migration touches ONLY the new 'proposal-pdfs' bucket. It does not
-- modify the 'product-media' bucket or any other existing bucket/policy.
--
-- NOT idempotent, deliberately (migration-safety correction): a plain
-- INSERT with no ON CONFLICT clause. If a bucket named 'proposal-pdfs'
-- already exists -- whether from a prior successful run of this exact
-- migration (which Supabase's own migration-history tracking already
-- prevents from happening via a normal `db push`) or an unexpected
-- collision with something else entirely -- this fails loudly with a clean
-- unique-violation error rather than silently reconfiguring whatever is
-- already there to match this file's intended settings. A bucket meant to
-- hold confidential, write-once partner PDFs must never be silently
-- repointed to different public/mime-type/size-limit settings by a re-run.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proposal-pdfs',
  'proposal-pdfs',
  false,               -- private: no public-read, service-role only
  10485760,            -- 10 MB -- generous headroom for a multi-page A4 text PDF
  ARRAY['application/pdf']
);
