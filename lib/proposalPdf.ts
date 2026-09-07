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
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { DocBlock, DocRun, ProposalClientDocument } from '@/lib/proposalDocument'
import type { ProposalLanguage } from '@/lib/proposals'

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
  language: ProposalLanguage
}

// SNX Phase 4 — Thai PDF font support. Standard PDF fonts (below) are
// WinAnsi/Latin-1 only and cannot encode Thai glyphs at all — pdf-lib
// throws at draw time if asked to. The English path is untouched: this
// only adds a custom-embedded font used exclusively when language === 'th'.
// Sarabun (SIL Open Font License; license text bundled alongside the font
// file — see assets/fonts/sarabun/OFL.txt) is Thailand's standard
// business-document typeface.
//
// Only ONE weight (Regular) is embedded, not all four — a real, confirmed
// pdf-lib limitation, not a bug in this file's own logic: embedding a
// SECOND custom fontkit-based font (e.g. Sarabun-Bold) alongside Regular in
// the same PDFDocument corrupts the ToUnicode text-extraction layer for
// characters shared between the two fonts (confirmed via 10 isolated
// repros against pdf-lib 1.17.1, the current latest release — a Thai
// character drawn correctly in Bold earlier in the document comes out
// missing from later Regular-font text, e.g. "ความ" extracting as "ควม").
// The rendered PAGE is pixel-correct either way (this is a text-layer/
// copy-paste/search-fidelity bug, not a visual one) — but shipping a
// visually-correct, textually-broken PDF isn't acceptable, so only one
// custom font is ever embedded for Thai. A "draw the same text twice with a
// small offset" faux-bold was tried and rejected: it visually reads as bold
// (still just the one real embedded font, so no corruption), but every bold
// word then appears TWICE in the copy/search text layer — trading one
// text-integrity defect for a different one. Net result: Thai headings and
// term labels render in the same weight as body text for now (still
// visually distinguished by their existing size/spacing), and no bold/
// italic distinction is attempted for Thai — the one deliberate visual
// trade-off against the alternative of a broken text layer. fontFor()'s
// bold/italic switch below is untouched and still resolves normally; for
// Thai every branch of it just lands on this same font object.
//
// Bundled under assets/ (NOT public/) so the raw font file is never served/
// downloadable at a public URL — only this server-only module reads it, via
// fs at render time. `@pdf-lib/fontkit` is required by pdf-lib to parse ANY
// non-standard (custom-embedded) font; StandardFonts need it not at all,
// which is why registerFontkit is only ever called on the Thai path, never
// the English one.
const SARABUN_DIR = path.join(process.cwd(), 'assets', 'fonts', 'sarabun')

async function embedEnglishFonts(doc: PDFDocument): Promise<Fonts> {
  const [regular, bold, italic, boldItalic] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
    doc.embedFont(StandardFonts.HelveticaBoldOblique),
  ])
  return { regular, bold, italic, boldItalic }
}

async function embedThaiFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit)
  const regularBytes = await readFile(path.join(SARABUN_DIR, 'Sarabun-Regular.ttf'))
  const regular = await doc.embedFont(regularBytes, { subset: true })
  // All four slots deliberately point at the SAME embedded font object —
  // see the file-header comment above for why. fontFor()'s bold/italic
  // switch still resolves normally; it just always lands on this one font
  // for Thai — no bold/italic distinction is attempted for Thai (see the
  // file-header comment for the trade-off that decision was made under).
  patchSaraAmDecomposition(regular)
  return { regular, bold: regular, italic: regular, boldItalic: regular }
}

/**
 * SNX Phase 4 correction — SARA AM (ำ, U+0E33) text-extraction fix.
 *
 * Root cause (confirmed by direct inspection of fontkit's shaping output and
 * pdf-lib's generated PDF bytes, not guessed): Sarabun's own OpenType GSUB
 * rules ALWAYS decompose ำ during shaping into two glyphs — a zero-advance
 * "loop" glyph (uni0E4D, optionally fused with a following tone mark) plus
 * the font's ordinary, shared า (SARA AA, U+0E32) glyph for the stroke. This
 * is correct, standard Thai typography — the rendered PAGE has always been
 * pixel-correct (confirmed visually every round this font has been used).
 * The defect is purely in pdf-lib's ToUnicode CMap: it derives each CID's
 * Unicode value from fontkit's per-glyph `codePoints`, which is a MUTABLE
 * property on a glyph object fontkit caches and reuses by glyph id — so the
 * SAME shared า-glyph object used for the ำ decomposition is also used for
 * every genuine, standalone า elsewhere in the whole document. Extracted
 * text ends up with a spurious extra า after every ำ (e.g. "จัดทำโดย"
 * extracts as "จัดทำาโดย") purely because the decomposition's second glyph
 * gets its own correct ToUnicode entry independent of the first.
 *
 * Fix: the font also ships a genuine, complete, standalone glyph for
 * precomposed SARA AM (reachable only via a direct cmap lookup — fontkit's
 * shaper never selects it on its own). This wraps the embedded font's
 * layout() — which both drawText() and widthOfTextAtSize() call internally,
 * so measurement and drawing stay in sync — to detect the decomposition
 * pattern and collapse it back into that one complete glyph, so ำ maps to
 * exactly one CID/one Unicode value like any other character. It also
 * "heals" the shared า-glyph object's mutated codePoints back to its
 * correct value immediately after each such collapse, since pdf-lib reads
 * that field lazily at doc.save() time — without this, one ำ anywhere in
 * the document could silently corrupt a real, unrelated า everywhere else.
 *
 * Known residual limitation, not fixed by this patch: a Thai tone mark
 * placed directly on a ำ syllable (e.g. ต่ำ, "minimum" — used in several
 * nightlife term labels) triggers a THIRD glyph variant (a loop+tone-mark
 * ligature) that has no complete standalone replacement in this font — the
 * loop and the stroke are genuinely two separate glyphs with no monolithic
 * alternative, so this narrower case still extracts with an extra า. The
 * rendered page remains pixel-correct for it either way; only copy/paste of
 * that specific pattern is affected. Not resolved here per the explicit
 * instruction against introducing a second embedded glyph identity via
 * lower-level PDF/subset-embedder surgery for this one narrow case.
 */
function patchSaraAmDecomposition(font: PDFFont): void {
  // @ts-expect-error — reaching into pdf-lib's internal embedder to get the
  // underlying fontkit font object; there is no public API for this. Pinned
  // to pdf-lib 1.17.1 (this project's exact version) — re-verify this reach-in
  // (and re-run the verification script this fix shipped with) before ever
  // upgrading pdf-lib.
  const fkFont = font.embedder?.font
  if (!fkFont || typeof fkFont.layout !== 'function') return

  const originalLayout = fkFont.layout.bind(fkFont)
  const isolated = originalLayout('ำ')
  if (isolated.glyphs.length !== 2) return // this font doesn't decompose SARA AM — nothing to patch
  const [firstPieceId, secondPieceId] = isolated.glyphs.map((g: any) => g.id)
  const monolithicGlyph = fkFont.glyphForCodePoint(0x0e33)
  if (!monolithicGlyph || monolithicGlyph.id === firstPieceId) return // no separate complete glyph available
  monolithicGlyph.codePoints = [0x0e33]
  // The calibration call just above ALSO clobbered the shared า-glyph's
  // codePoints (glyph #1 of this isolated run is that same shared object) as
  // a side effect of computing the decomposition it just revealed — heal it
  // immediately, before any real document text is ever rendered.
  isolated.glyphs[1].codePoints = [0x0e32]

  fkFont.layout = function (string: string, ...rest: unknown[]) {
    const run = originalLayout(string, ...rest)
    const glyphs: any[] = []
    const positions: any[] = []
    for (let i = 0; i < run.glyphs.length; i++) {
      const g = run.glyphs[i]
      const next = run.glyphs[i + 1]
      if (g.id === firstPieceId && next && next.id === secondPieceId && run.positions[i].xAdvance === 0) {
        glyphs.push(monolithicGlyph)
        positions.push(run.positions[i + 1])
        i++
        continue
      }
      glyphs.push(g)
      positions.push(run.positions[i])
    }
    // Unconditionally heal every occurrence of the shared า-glyph in THIS
    // run's output, not just ones consumed by the collapse above — it only
    // ever legitimately represents U+0E32, whether drawn standalone or as a
    // decomposition remnant somewhere else this same call touched. Without
    // this, one ำ anywhere in the document could silently corrupt a real,
    // unrelated า elsewhere (pdf-lib reads codePoints lazily, at doc.save()
    // time, off this same shared, mutable object).
    for (const g of glyphs) {
      if (g.id === secondPieceId) g.codePoints = [0x0e32]
    }
    run.glyphs = glyphs
    run.positions = positions
    return run
  }
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
  /** Width of a deliberate gap before this word — 0 for a token immediately following another with no whitespace in the source text between them (Thai word segmentation; see tokenizeRunText). */
  gapBefore: number
}

// SNX Phase 4 — Thai line wrapping. Thai script has no spaces between words
// within a sentence, so the plain `split(/\s+/)` this file always used
// (still used for English, unchanged below) would tokenize an entire Thai
// paragraph as one unbreakable "word" that overflows the column instead of
// wrapping. Intl.Segmenter('th', { granularity: 'word' }) gives real
// Thai word-boundary segmentation with zero new dependency — Node 22 (this
// project's runtime) ships full ICU by default. Reused as a single module-
// level instance; Intl.Segmenter has no per-call state, so this is safe to
// share across every render.
const THAI_WORD_SEGMENTER = new Intl.Segmenter('th', { granularity: 'word' })

interface Token {
  text: string
  /** Whether real whitespace existed before this token in the source text — distinct from Thai word segments, which are adjacent with no gap. */
  spaceBefore: boolean
}

function tokenizeRunText(text: string, language: ProposalLanguage): Token[] {
  if (language !== 'th') {
    // English/Latin: unchanged from the original whitespace-only split.
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => ({ text: t, spaceBefore: true }))
  }
  const tokens: Token[] = []
  let spaceBefore = false
  // Array.from (not for...of) — this project's tsconfig targets es5, which
  // can't iterate a Segments object directly without downlevelIteration;
  // Array.from works at any target since it's a runtime call, not
  // transpiled loop syntax.
  for (const { segment, isWordLike } of Array.from(THAI_WORD_SEGMENTER.segment(text))) {
    if (!isWordLike && /^\s+$/.test(segment)) {
      spaceBefore = true
      continue
    }
    if (!segment) continue
    // A word-like Thai/Latin/number segment, or a punctuation segment —
    // either way, a real token to render. Only a genuine space in the
    // source text (above) produces a gap before the next one.
    tokens.push({ text: segment, spaceBefore })
    spaceBefore = false
  }
  return tokens
}

/** Flatten runs into words tagged with the font their own bold/italic resolves to, then greedily wrap to maxWidth. */
function wrapRuns(fonts: Fonts, runs: DocRun[], size: number, maxWidth: number, language: ProposalLanguage): Word[][] {
  const spaceWidth = fonts.regular.widthOfTextAtSize(' ', size)
  const words: Word[] = []
  for (const run of runs) {
    const font = fontFor(fonts, run.bold, run.italic)
    for (const token of tokenizeRunText(run.text, language)) {
      words.push({ text: token.text, font, gapBefore: token.spaceBefore ? spaceWidth : 0 })
    }
  }
  const lines: Word[][] = []
  let current: Word[] = []
  let width = 0
  for (const w of words) {
    const wordWidth = w.font.widthOfTextAtSize(w.text, size)
    const addWidth = current.length ? w.gapBefore + wordWidth : wordWidth
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
  words.forEach((w, i) => {
    // The gap belongs BEFORE a word, not after — the first word on a line
    // starts flush at `x` regardless of whether a space preceded it in the
    // source text (that space was consumed by the line break itself).
    if (i > 0) cx += w.gapBefore
    state.page.drawText(w.text, { x: cx, y: state.y, size, font: w.font, color })
    cx += w.font.widthOfTextAtSize(w.text, size)
  })
}

/** Wrap + page-break + draw a run sequence as flowing text, one call per logical block. */
function drawRuns(state: RenderState, runs: DocRun[], opts: { size: number; x?: number; width?: number; lineHeight?: number; color?: RGB }): void {
  const x = opts.x ?? MARGIN.left
  const width = opts.width ?? CONTENT_WIDTH
  const lineHeight = opts.lineHeight ?? opts.size * 1.35
  const color = opts.color ?? INK
  const lines = wrapRuns(state.fonts, runs, opts.size, width, state.language)
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
  const preparedByLabel = meta.language === 'th' ? `จัดทำโดย ${meta.preparedBy}` : `Prepared by ${meta.preparedBy}`
  drawRuns(state, [{ text: preparedByLabel }], { size: 10, color: MUTE, lineHeight: 15 })
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
 *
 * Thai has no embedded bold (see embedThaiFonts) — a heading here would
 * otherwise be the same visual weight as body text. Layout-only compensation
 * instead of a second font: a larger size, more air above/below, and a thin
 * rule underneath in the same neutral RULE color already used for the
 * cover/footer dividers elsewhere in this file — no new color introduced.
 */
function drawHeading(state: RenderState, block: Extract<DocBlock, { type: 'heading' }>, keepWithNext = 0): void {
  const isTh = state.language === 'th'
  const size = (block.level <= 1 ? 15 : block.level === 2 ? 12.5 : 11) + (isTh ? 2 : 0)
  const spaceBefore = (block.level <= 2 ? 12 : 7) + (isTh ? 6 : 0)
  // ensure()'s own reservation is deliberately unchanged in shape from
  // before this Thai pass (size * 1.4 + 28 + keepWithNext) — spaceBefore is
  // applied after the check, exactly as it always was, so English's
  // page-break points don't shift by even a point from this change.
  ensure(state, size * 1.4 + 28 + keepWithNext)
  state.y -= spaceBefore
  drawRuns(state, block.runs.map((r) => ({ ...r, bold: true })), { size, color: INK, lineHeight: size * 1.3 })
  if (isTh) {
    state.y -= 3
    state.page.drawLine({ start: { x: MARGIN.left, y: state.y }, end: { x: PAGE_SIZE[0] - MARGIN.right, y: state.y }, thickness: 0.5, color: RULE })
    state.y -= 7
  } else {
    state.y -= 4
  }
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
  // Thai has no embedded bold, so label vs. value can't be told apart by
  // weight the way English's bold label can — instead the value uses MUTE,
  // the same secondary-text gray already used throughout this file (the
  // cover's "Prepared by"/date lines, footers), not a new color.
  const valueColor = state.language === 'th' ? MUTE : INK
  state.y -= 3
  for (const row of block.rows) {
    ensure(state, 16)
    const rowStartY = state.y
    drawRuns(state, row.label, { size: 10, x: MARGIN.left, width: labelWidth, color: INK, lineHeight: 14 })
    const afterLabelY = state.y
    state.y = rowStartY
    drawRuns(state, row.value, { size: 10, x: MARGIN.left + labelWidth + 14, width: valueWidth, color: valueColor, lineHeight: 14 })
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
  const docTypeLabel = meta.language === 'th' ? 'ข้อเสนอความร่วมมือ' : 'Partnership Proposal'
  pages.forEach((page, i) => {
    const y = MARGIN.bottom - 22
    page.drawLine({ start: { x: MARGIN.left, y: y + 14 }, end: { x: PAGE_SIZE[0] - MARGIN.right, y: y + 14 }, thickness: 0.5, color: RULE })
    page.drawText(`${meta.preparedBy}  |  ${docTypeLabel}`, { x: MARGIN.left, y, size: 8, font: fonts.regular, color: MUTE })
    const pageLabel = meta.language === 'th' ? `หน้า ${i + 1} จาก ${pages.length}` : `Page ${i + 1} of ${pages.length}`
    const labelWidth = fonts.regular.widthOfTextAtSize(pageLabel, 8)
    page.drawText(pageLabel, { x: PAGE_SIZE[0] - MARGIN.right - labelWidth, y, size: 8, font: fonts.regular, color: MUTE })
  })
}

export async function renderProposalPdf(document: ProposalClientDocument): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Partnership Proposal — ${document.meta.partnerName}`)
  doc.setAuthor(document.meta.preparedBy)

  // SNX Phase 4 — language is explicit, from document.meta (itself set from
  // the Proposal's own stored language column, never inferred from the
  // draft text — see lib/proposalDocument.ts). English keeps the exact same
  // Helvetica embed call as before; Thai is the only path that touches
  // fontkit/custom font embedding at all.
  const fonts = document.meta.language === 'th' ? await embedThaiFonts(doc) : await embedEnglishFonts(doc)

  const firstPage = doc.addPage(PAGE_SIZE)
  const state: RenderState = { doc, fonts, page: firstPage, y: PAGE_SIZE[1] - MARGIN.top, language: document.meta.language }

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
