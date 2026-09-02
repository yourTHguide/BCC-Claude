// SNX Phase 3C-2 — ported from Living OS (sanctuary-nexus)
// src/lib/proposalDocument.ts. "PORT UNCHANGED" per the Phase 3C plan: pure
// functions over a Proposal-shaped object, no storage awareness at all — the
// caller (a future 3G finalize/PDF action) uploads the output; these
// functions never did that and still don't.
//
// One adaptation: Living OS's buildProposalDocument() looked up a per-
// business logo/color "identity" via getProductProposalIdentity() for the
// PDF cover. No such identity registry exists in this repo yet (out of
// scope for Phase 3C-2, not in the implementation plan) — meta.identity is
// always undefined here, so proposalPdf.ts's cover renderer always takes its
// existing "no identity" plain-cover branch. Wiring real per-business
// branding is a future enhancement, not a silent gap: it's documented here.
//
// The clean CLIENT-FACING document model for a proposal PDF.
//
// This is the boundary Living OS's own design requires: the internal
// Proposal record holds ids, version, status, framework/writing-standard/
// product-profile versions, approved_at, pdf_storage_path, draft_revision,
// etc. — NONE of which belong in the external PDF. buildProposalDocument
// derives a document that contains only what the recipient should see:
// title, partner, business context, preparer, proposal date, and the
// approved proposal content parsed into renderable blocks.
//
// Metadata that leaks into the approved content (e.g. a "**Version:** v3"
// header line from the composer) is stripped here so it never reaches the
// client.

import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Proposal } from '@/lib/proposals'
import { proposalFinalContent } from '@/lib/proposals'

export interface DocRun {
  text: string
  bold?: boolean
  italic?: boolean
}

export type DocBlock =
  | { type: 'heading'; level: number; runs: DocRun[] }
  | { type: 'paragraph'; runs: DocRun[] }
  | { type: 'list'; ordered: boolean; items: DocRun[][] }
  | { type: 'terms'; rows: Array<{ label: DocRun[]; value: DocRun[] }> }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'rule' }

/** Per-business PDF branding. No registry exists in this repo yet (see file header) — reserved for a future enhancement. */
export interface ProposalDocumentIdentity {
  logoPath: string
  dark: string
  accent: string
}

export interface ProposalDocumentMeta {
  title: string
  partnerName: string
  businessLabel: string
  product?: string
  identity?: ProposalDocumentIdentity
  preparedBy: string
  dateLabel: string
}

export interface ProposalClientDocument {
  meta: ProposalDocumentMeta
  blocks: DocBlock[]
}

/** Internal metadata lines that must never appear in the client PDF. */
const META_LINE = /^\s*(\*\*|_)?\s*(for|prepared by|date|version|framework version|writing standard version|writing-standard version|product profile version|product-profile version|status|exported|approved|artifact)\b/i
const REDUNDANT_TITLE = /^#\s+partnership proposal\b/i

/** Remove the composer's metadata header + any stray version/status lines. */
function stripInternalMetadata(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let started = false
  for (const line of lines) {
    const t = line.trim()
    if (!started) {
      if (t === '' || t === '---' || t === '***') continue
      if (REDUNDANT_TITLE.test(t)) continue
      if (META_LINE.test(t)) continue
      started = true
    }
    if (META_LINE.test(t)) continue
    out.push(line)
  }
  return out.join('\n').trim()
}

interface MdNode {
  type: string
  depth?: number
  ordered?: boolean
  value?: string
  children?: MdNode[]
}

function inlineRuns(nodes: MdNode[] | undefined, bold = false, italic = false): DocRun[] {
  const runs: DocRun[] = []
  for (const node of nodes ?? []) {
    switch (node.type) {
      case 'text':
      case 'inlineCode':
        if (node.value) runs.push({ text: node.value, bold, italic })
        break
      case 'strong':
        runs.push(...inlineRuns(node.children, true, italic))
        break
      case 'emphasis':
        runs.push(...inlineRuns(node.children, bold, true))
        break
      case 'break':
        runs.push({ text: '\n', bold, italic })
        break
      case 'link':
        runs.push(...inlineRuns(node.children, bold, italic))
        break
      default:
        if (node.children) runs.push(...inlineRuns(node.children, bold, italic))
        else if (node.value) runs.push({ text: node.value, bold, italic })
    }
  }
  return runs
}

function runsText(runs: DocRun[]): string {
  return runs.map((r) => r.text).join('')
}

function splitTerm(runs: DocRun[]): { label: DocRun[]; value: DocRun[] } | null {
  // Split "Label: value" or "Label — value" into two columns, at the first separator.
  const full = runsText(runs)
  const match = full.match(/^(.*?)(:|\s—\s|\s-\s)\s*([\s\S]*)$/)
  if (!match) return null
  const label = match[1].trim()
  const value = match[3].trim()
  if (!label || !value) return null
  return {
    label: [{ text: label.replace(/[*]/g, ''), bold: true }],
    value: [{ text: value }],
  }
}

/** Detect a pipe table inside a paragraph the parser didn't recognize as GFM. */
function pipeTable(text: string): { header: string[]; rows: string[][] } | null {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2 || !lines.every((l) => l.includes('|'))) return null
  const sep = lines[1].replace(/[^|:\- ]/g, '')
  if (!/^\|?[\s:|-]+\|?$/.test(lines[1]) || !sep.includes('-')) return null
  const cells = (l: string) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  return { header: cells(lines[0]), rows: lines.slice(2).map(cells) }
}

export function parseBlocks(markdown: string): DocBlock[] {
  const tree = fromMarkdown(stripInternalMetadata(markdown)) as unknown as MdNode
  const blocks: DocBlock[] = []
  let lastHeading = ''

  for (const node of tree.children ?? []) {
    switch (node.type) {
      case 'heading': {
        const runs = inlineRuns(node.children)
        lastHeading = runsText(runs)
        blocks.push({ type: 'heading', level: node.depth ?? 2, runs })
        break
      }
      case 'paragraph': {
        const runs = inlineRuns(node.children)
        const table = pipeTable(runsText(runs))
        if (table) blocks.push({ type: 'table', ...table })
        else blocks.push({ type: 'paragraph', runs })
        break
      }
      case 'list': {
        const items = (node.children ?? []).map((li) => inlineRuns(li.children?.flatMap((c) => c.children ?? []) ?? []))
        const isTerms = /term|commercial|arrangement|pricing/i.test(lastHeading)
        const rows = isTerms ? items.map(splitTerm) : []
        if (isTerms && rows.every(Boolean) && rows.length > 0) {
          blocks.push({ type: 'terms', rows: rows as Array<{ label: DocRun[]; value: DocRun[] }> })
        } else {
          blocks.push({ type: 'list', ordered: Boolean(node.ordered), items })
        }
        break
      }
      case 'thematicBreak':
        blocks.push({ type: 'rule' })
        break
      default:
        if (node.children) {
          const runs = inlineRuns(node.children)
          if (runsText(runs).trim()) blocks.push({ type: 'paragraph', runs })
        }
    }
  }
  return blocks
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  // proposal_date/approved_at are business dates the partner sees — always
  // rendered in Bangkok local time regardless of the server's own timezone.
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })
}

export function buildProposalDocument(proposal: Proposal, partnerName: string): ProposalClientDocument {
  return {
    meta: {
      title: 'PARTNERSHIP PROPOSAL',
      partnerName,
      businessLabel: proposal.businessContexts.join(' / '),
      product: proposal.product ?? undefined,
      // No per-business identity registry exists in this repo yet — see file header.
      identity: undefined,
      preparedBy: 'Sanctuary Nexus Co., Ltd.',
      // The proposal date the client sees — a business date, not a system timestamp.
      dateLabel: formatDate(proposal.approvedAt ?? proposal.proposalDate),
    },
    blocks: parseBlocks(proposalFinalContent(proposal)),
  }
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

/** Client-friendly filename, no internal ids: SOHO-Hospitality-Group_Bangkok-Club-Crawl_Partnership-Proposal.pdf */
export function proposalPdfFilename(doc: ProposalClientDocument): string {
  const parts = [slug(doc.meta.partnerName)]
  if (doc.meta.product) parts.push(slug(doc.meta.product))
  parts.push('Partnership-Proposal')
  return `${parts.filter(Boolean).join('_')}.pdf`
}
