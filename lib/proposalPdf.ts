import 'server-only'

// SNX Phase 3G correction — pdfkit replaced with pdf-lib. pdfkit's Node
// entry resolves its 14 standard fonts through Node's package.json
// `imports` field (`#standard-fonts/*`), which Next's bundling of a Route
// Handler doesn't preserve — it crashed Finalize & Generate PDF on Vercel
// with "Cannot find module '#standard-fonts/Helvetica'". Adding pdfkit to
// serverComponentsExternalPackages did NOT fix it in the actual deployed
// runtime (confirmed by a live retest), so rather than keep stacking
// bundling workarounds around a package whose font-loading mechanism this
// stack can't reliably support, it's replaced outright. pdf-lib ships its
// 14 standard font metrics as plain embedded JS data (StandardFonts) — no
// package.json `imports` trick, no external font files, nothing for a
// bundler to lose — and has zero npm-audit-flagged dependencies.
//
// Public boundary preserved exactly: renderProposalPdf(document) => Buffer.
// Every caller (lib/proposals.ts's finalizeProposal) is unchanged.
//
// pdf-lib has no built-in flowing-text layout or automatic pagination (unlike
// pdfkit) — this file does its own word-wrapping and page-break tracking via
// a small mutable render cursor. It also has no single-call mixed-run text
// (bold/italic switching mid-line), which this app's real content actually
// needs (a `**Label:**` prefix inside a plain paragraph, and the writing
// standard's whole-paragraph italic disclaimers) — handled by wrapping at
// the word level with a font resolved per source DocRun, not per block.
//
// V1 scope only, per instruction: reliable structure (header/cover, headings,
// wrapped paragraphs/lists, a commercial-terms table, page breaks, a footer)
// — not final branding/template design, which is a later pass.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage, RGB } from 'pdf-lib'
import type { DocBlock, DocRun, ProposalClientDocument } from '@/lib/proposalDocument'

// V1 correction: no brand accent color — plain black/neutral grayscale only.
const INK: RGB = rgb(0.1216, 0.1608, 0.2157)
const MUTE: RGB = rgb(0.4196, 0.4471, 0.502)
const RULE: RGB = rgb(0.898, 0.9059, 0.9216)
const FAINT: RGB = rgb(0.9529, 0.9569, 0.9647)

const PAGE_SIZE: [number, number] = [595.28, 841.89] // A4, points
const MARGIN = { top: 60, bottom: 56, left: 64, right: 64 }
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN.left - MARGIN.right

interface Fonts {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
  boldItalic: PDFFont
}

interface RenderState {
  doc: PDFDocument
  fonts: Fonts
  page: PDFPage
  y: number
}

function fontFor(fonts: Fonts, bold?: boolean, italic?: boolean): PDFFont {
  if (bold && italic) return fonts.boldItalic
  if (bold) return fonts.bold
  if (italic) return fonts.italic
  return fonts.regular
}

function newPage(state: RenderState): void {
  state.page = state.doc.addPage(PAGE_SIZE)
  state.y = PAGE_SIZE[1] - MARGIN.top
}

/** Page-break check: start a fresh page if the next `height` of content would run past the bottom margin. */
function ensure(state: RenderState, height: number): void {
  if (state.y - height < MARGIN.bottom) newPage(state)
}

interface Word {
  text: string
  font: PDFFont
}

/** Flatten runs into words tagged with the font their own bold/italic resolves to, then greedily wrap to maxWidth. */
function wrapRuns(fonts: Fonts, runs: DocRun[], size: number, maxWidth: number): Word[][] {
  const words: Word[] = []
  for (const run of runs) {
    const font = fontFor(fonts, run.bold, run.italic)
    for (const part of run.text.split(/\s+/).filter(Boolean)) words.push({ text: part, font })
  }
  const lines: Word[][] = []
  let current: Word[] = []
  let width = 0
  const spaceWidth = fonts.regular.widthOfTextAtSize(' ', size)
  for (const w of words) {
    const wordWidth = w.font.widthOfTextAtSize(w.text, size)
    const addWidth = current.length ? spaceWidth + wordWidth : wordWidth
    if (width + addWidth > maxWidth && current.length) {
      lines.push(current)
      current = [w]
      width = wordWidth
    } else {
      current.push(w)
      width += addWidth
    }
  }
  if (current.length) lines.push(current)
  return lines
}

function drawWords(state: RenderState, words: Word[], x: number, size: number, color: RGB): void {
  let cx = x
  const spaceWidth = state.fonts.regular.widthOfTextAtSize(' ', size)
  for (const w of words) {
    state.page.drawText(w.text, { x: cx, y: state.y, size, font: w.font, color })
    cx += w.font.widthOfTextAtSize(w.text, size) + spaceWidth
  }
}

/** Wrap + page-break + draw a run sequence as flowing text, one call per logical block. */
function drawRuns(state: RenderState, runs: DocRun[], opts: { size: number; x?: number; width?: number; lineHeight?: number; color?: RGB }): void {
  const x = opts.x ?? MARGIN.left
  const width = opts.width ?? CONTENT_WIDTH
  const lineHeight = opts.lineHeight ?? opts.size * 1.35
  const color = opts.color ?? INK
  const lines = wrapRuns(state.fonts, runs, opts.size, width)
  if (lines.length === 0) {
    state.y -= lineHeight
    return
  }
  for (const line of lines) {
    ensure(state, lineHeight)
    drawWords(state, line, x, opts.size, color)
    state.y -= lineHeight
  }
}

function drawRule(state: RenderState): void {
  ensure(state, 20)
  state.y -= 6
  state.page.drawLine({ start: { x: MARGIN.left, y: state.y }, end: { x: PAGE_SIZE[0] - MARGIN.right, y: state.y }, thickness: 0.75, color: RULE })
  state.y -= 12
}

function drawCover(state: RenderState, meta: ProposalClientDocument['meta']): void {
  drawRuns(state, [{ text: meta.preparedBy.toUpperCase(), bold: true }], { size: 8.5, color: MUTE, lineHeight: 13 })
  // Visible gap before the headline — was too tight against the eyebrow line.
  state.y -= 12
  drawRuns(state, [{ text: meta.title, bold: true }], { size: 21, color: INK, lineHeight: 26 })
  state.y -= 3
  drawRuns(state, [{ text: meta.partnerName, bold: true }], { size: 13.5, color: INK, lineHeight: 19 })
  drawRuns(state, [{ text: `× ${meta.product ?? meta.businessLabel}` }], { size: 11.5, color: MUTE, lineHeight: 17 })
  state.y -= 5
  drawRuns(state, [{ text: `Prepared by ${meta.preparedBy}` }], { size: 10, color: MUTE, lineHeight: 15 })
  drawRuns(state, [{ text: meta.dateLabel }], { size: 10, color: MUTE, lineHeight: 15 })
  state.y -= 6
  ensure(state, 4)
  state.page.drawLine({ start: { x: MARGIN.left, y: state.y }, end: { x: MARGIN.left + 52, y: state.y }, thickness: 1.2, color: INK })
  state.y -= 22
}

/**
 * Rough height of the first line of `block` — used only as a "keep with
 * next" reservation for the heading that precedes it, never for real
 * layout. A heading followed by another heading (or by nothing) needs no
 * safeguard: an empty section heading breaking alone is not the "orphaned
 * heading" case being guarded against.
 */
function leadingBlockHeight(block: DocBlock | undefined): number {
  switch (block?.type) {
    case 'paragraph':
      return 15
    case 'list':
      return 17
    case 'terms':
      return 16
    case 'table':
      return 20
    default:
      return 0
  }
}

/**
 * `keepWithNext` reserves enough extra room for the first line of whatever
 * follows this heading, so a page break lands BEFORE the heading instead of
 * leaving it stranded alone at the bottom of a page with its body pushed to
 * the next one.
 */
function drawHeading(state: RenderState, block: Extract<DocBlock, { type: 'heading' }>, keepWithNext = 0): void {
  const size = block.level <= 1 ? 15 : block.level === 2 ? 12.5 : 11
  ensure(state, size * 1.4 + 28 + keepWithNext)
  state.y -= block.level <= 2 ? 12 : 7
  drawRuns(state, block.runs.map((r) => ({ ...r, bold: true })), { size, color: INK, lineHeight: size * 1.3 })
  state.y -= 4
}

function drawParagraph(state: RenderState, runs: DocRun[]): void {
  drawRuns(state, runs, { size: 10.5, color: INK, lineHeight: 15 })
  state.y -= 6
}

function drawList(state: RenderState, block: Extract<DocBlock, { type: 'list' }>): void {
  block.items.forEach((item, idx) => {
    ensure(state, 15)
    const marker = block.ordered ? `${idx + 1}.` : '•'
    state.page.drawText(marker, { x: MARGIN.left, y: state.y, size: 10.5, font: state.fonts.bold, color: INK })
    drawRuns(state, item, { size: 10.5, x: MARGIN.left + 16, width: CONTENT_WIDTH - 16, color: INK, lineHeight: 15 })
    state.y -= 2
  })
  state.y -= 5
}

function drawTermsTable(state: RenderState, block: Extract<DocBlock, { type: 'terms' }>): void {
  const labelWidth = Math.round(CONTENT_WIDTH * 0.38)
  const valueWidth = CONTENT_WIDTH - labelWidth - 14
  state.y -= 3
  for (const row of block.rows) {
    ensure(state, 16)
    const rowStartY = state.y
    drawRuns(state, row.label, { size: 10, x: MARGIN.left, width: labelWidth, color: INK, lineHeight: 14 })
    const afterLabelY = state.y
    state.y = rowStartY
    drawRuns(state, row.value, { size: 10, x: MARGIN.left + labelWidth + 14, width: valueWidth, color: INK, lineHeight: 14 })
    // No divider line between rows — editorial, two-column alignment carries
    // the structure. Row gap widened slightly to compensate.
    state.y = Math.min(state.y, afterLabelY) - 8
  }
  state.y -= 8
}

function drawTable(state: RenderState, block: Extract<DocBlock, { type: 'table' }>): void {
  const cols = Math.max(block.header.length, 1)
  const colWidth = CONTENT_WIDTH / cols

  const drawRow = (cells: string[], header: boolean) => {
    ensure(state, 20)
    if (header) {
      state.page.drawRectangle({ x: MARGIN.left, y: state.y - 5, width: CONTENT_WIDTH, height: 16, color: FAINT })
    }
    const font = header ? state.fonts.bold : state.fonts.regular
    cells.forEach((cell, i) => {
      state.page.drawText(cell || '', { x: MARGIN.left + i * colWidth + 6, y: state.y, size: 9.5, font, color: INK, maxWidth: colWidth - 12 })
    })
    state.y -= 18
  }

  state.y -= 3
  if (block.header.length) drawRow(block.header, true)
  for (const row of block.rows) drawRow(row, false)
  state.y -= 6
}

function drawFooters(pages: PDFPage[], fonts: Fonts, meta: ProposalClientDocument['meta']): void {
  pages.forEach((page, i) => {
    const y = MARGIN.bottom - 22
    page.drawLine({ start: { x: MARGIN.left, y: y + 14 }, end: { x: PAGE_SIZE[0] - MARGIN.right, y: y + 14 }, thickness: 0.5, color: RULE })
    page.drawText(`${meta.preparedBy}  |  Partnership Proposal`, { x: MARGIN.left, y, size: 8, font: fonts.regular, color: MUTE })
    const pageLabel = `Page ${i + 1} of ${pages.length}`
    const labelWidth = fonts.regular.widthOfTextAtSize(pageLabel, 8)
    page.drawText(pageLabel, { x: PAGE_SIZE[0] - MARGIN.right - labelWidth, y, size: 8, font: fonts.regular, color: MUTE })
  })
}

export async function renderProposalPdf(document: ProposalClientDocument): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Partnership Proposal — ${document.meta.partnerName}`)
  doc.setAuthor(document.meta.preparedBy)

  const [regular, bold, italic, boldItalic] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
    doc.embedFont(StandardFonts.HelveticaBoldOblique),
  ])
  const fonts: Fonts = { regular, bold, italic, boldItalic }

  const firstPage = doc.addPage(PAGE_SIZE)
  const state: RenderState = { doc, fonts, page: firstPage, y: PAGE_SIZE[1] - MARGIN.top }

  drawCover(state, document.meta)
  for (let i = 0; i < document.blocks.length; i++) {
    const block = document.blocks[i]
    switch (block.type) {
      case 'heading':
        drawHeading(state, block, leadingBlockHeight(document.blocks[i + 1]))
        break
      case 'paragraph':
        drawParagraph(state, block.runs)
        break
      case 'list':
        drawList(state, block)
        break
      case 'terms':
        drawTermsTable(state, block)
        break
      case 'table':
        drawTable(state, block)
        break
      case 'rule':
        drawRule(state)
        break
    }
  }

  drawFooters(doc.getPages(), fonts, document.meta)

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
