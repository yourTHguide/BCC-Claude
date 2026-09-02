import 'server-only'

// SNX Phase 3F/3G — Storage adapter for the private `proposal-pdfs` bucket
// (Phase 3C-1 migration 20260903000002). Thin wrapper around
// getServiceSupabase().storage: this is the ONLY place in the app that
// touches the bucket directly, so the write-once / signed-URL-only posture
// documented in the migration lives in one spot.

import { getServiceSupabase } from '@/lib/supabase'

export const PROPOSAL_PDFS_BUCKET = 'proposal-pdfs'

/** Canonical object path — see the schema migration's comment on proposals.pdf_storage_path for why it's keyed on draft_revision, not version. */
export function proposalPdfStoragePath(partnerId: string, seriesId: string, proposalId: string, draftRevision: number): string {
  return `${partnerId}/${seriesId}/${proposalId}/r${draftRevision}.pdf`
}

/**
 * Upload a rendered PDF to its canonical, revision-keyed path. Never
 * overwrites: if that exact path already holds an object (a retry against an
 * unchanged draft_revision), this is treated as a safe, idempotent no-op —
 * the existing object is already the correct render for that revision. Any
 * other upload error is rethrown.
 */
export async function uploadProposalPdf(path: string, pdf: Buffer): Promise<void> {
  const supabase = getServiceSupabase()
  const { error } = await supabase.storage.from(PROPOSAL_PDFS_BUCKET).upload(path, pdf, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) {
    const message = 'message' in error ? String((error as { message?: unknown }).message) : String(error)
    // Supabase Storage's "already exists" error for a duplicate path with upsert:false.
    if (/already exists|duplicate/i.test(message)) return
    console.error('lib/proposalPdfStorage uploadProposalPdf: upload error:', error)
    throw new Error('Failed to upload proposal PDF')
  }
}

/**
 * Short-lived signed URL for viewing or downloading a finalized proposal's
 * PDF. Never a public URL, never persisted — always derived fresh from
 * pdf_storage_path at read time (Phase 3B §8).
 */
export async function getSignedProposalPdfUrl(path: string, opts?: { download?: boolean | string }): Promise<string> {
  const supabase = getServiceSupabase()
  const expiresInSeconds = 300
  const { data, error } = await supabase.storage.from(PROPOSAL_PDFS_BUCKET).createSignedUrl(path, expiresInSeconds, {
    download: opts?.download,
  })
  if (error || !data?.signedUrl) {
    console.error('lib/proposalPdfStorage getSignedProposalPdfUrl: error:', error)
    throw new Error('Failed to create a signed PDF URL')
  }
  return data.signedUrl
}
