import 'server-only'

// SNX Phase 3C-2 — ported from Living OS (sanctuary-nexus)
// src/lib/server/proposalPdf.ts. "PORT UNCHANGED" per the Phase 3C plan —
// pure rendering logic, no storage awareness. The caller (a future 3G
// finalize action) uploads the returned Buffer to Supabase Storage; this
// function has never done that and still doesn't. `meta.identity` is always
// undefined today (see lib/proposalDocument.ts's header) so the cover always
// takes the plain "no identity" branch below — both branches are ported
// unchanged and ready for whenever per-business branding exists.
//
// True multi-page A4 PDF renderer for a client-facing proposal. Uses
// pdfkit's native document flow — text wraps and paginates automatically;
// tables and headings get manual page-break checks so nothing is stranded,
// clipped, or pushed off the page. It consumes the clean
// ProposalClientDocument (no internal metadata) and draws a cover, the
// proposal body, and a "Page X of Y" footer.
//
// This is NOT a screenshot of any UI and does not depend on viewport size.

import type { DocBlock, DocRun, ProposalClientDocument } from '@/lib/proposalDocument'
import fs from 'node:fs'
import path from 'node:path'

const INK = '#1f2937'
const MUTE = '#6b7280'
const ACCENT = '#7c3aed'
const RULE = '#e5e7eb'
const FAINT = '#f3f4f6'

const MARGIN = { top: 60, bottom: 72, left: 64, right: 64 }

type Doc = PDFKit.PDFDocument

function contentWidth(doc: Doc): number {
  return doc.page.width - MARGIN.left - MARGIN.right
}
function pageBottom(doc: Doc): number {
  return doc.page.height - MARGIN.bottom
}
function ensure(doc: Doc, height: number): void {
  if (doc.y + height > pageBottom(doc)) doc.addPage()
}

/** Emit a run sequence (with bold/italic) as one flowing paragraph. */
function renderRuns(doc: Doc, runs: DocRun[], opts: { size: number; x?: number; width: number; lineGap?: number; color?: string }): void {
  const startY = doc.y
  // Always anchor the first run at an explicit x (the left margin by default) so
  // a block never inherits a drifted doc.x from a preceding table cell.
  const x = opts.x ?? MARGIN.left
  doc.fontSize(opts.size).fillColor(opts.color ?? INK)
  runs.forEach((run, i) => {
    const font = run.bold ? (run.italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : run.italic ? 'Helvetica-Oblique' : 'Helvetica'
    doc.font(font)
    const textOpts = { width: opts.width, continued: i < runs.length - 1, lineGap: opts.lineGap ?? 3 }
    if (i === 0) doc.text(run.text, x, startY, textOpts)
    else doc.text(run.text, textOpts)
  })
}

function runsText(runs: DocRun[]): string {
  return runs.map((r) => r.text).join('')
}

function publicAssetPath(publicPath: string): string {
  return path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''))
}

function drawCover(doc: Doc, meta: ProposalClientDocument['meta']): void {
  const w = contentWidth(doc)
  const identity = meta.identity
  const accent = identity?.accent ?? ACCENT

  if (identity) {
    const headerX = 0
    const headerY = 0
    const headerH = 178
    const logoW = 182
    const logoH = 61
    const logoX = MARGIN.left
    const logoY = 46
    doc.rect(headerX, headerY, doc.page.width, headerH).fill(identity.dark)

    const logoPath = publicAssetPath(identity.logoPath)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, logoX, logoY, { fit: [logoW, logoH] })
    }

    doc.font('Helvetica').fontSize(7.5).fillColor('#d7d2de').text('PRESENTED BY:', MARGIN.left, 50, {
      align: 'right',
      width: w,
      characterSpacing: 0.5,
    })
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff').text(meta.preparedBy.toUpperCase(), MARGIN.left, 65, {
      align: 'right',
      width: w,
      characterSpacing: 0.2,
    })

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text(meta.title, MARGIN.left, 126, {
      characterSpacing: 1,
      width: w,
    })
    doc.lineWidth(1).strokeColor(accent).moveTo(MARGIN.left, 158).lineTo(MARGIN.left + 48, 158).stroke()

    doc.y = headerH + 34
  } else {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(accent).text(meta.preparedBy.toUpperCase(), MARGIN.left, MARGIN.top, { characterSpacing: 1.5, width: w })
    doc.moveDown(1.2)
    doc.font('Helvetica-Bold').fontSize(24).fillColor(INK).text(meta.title, MARGIN.left, doc.y, { characterSpacing: 1, width: w })
    doc.moveDown(0.5)
  }

  doc.font('Helvetica-Bold').fontSize(15).fillColor(INK).text(meta.partnerName, { width: w })
  doc.font('Helvetica').fontSize(13).fillColor(MUTE).text(`× ${meta.product ?? meta.businessLabel}`, { width: w })
  doc.moveDown(0.8)
  doc.font('Helvetica').fontSize(10).fillColor(MUTE).text(`Prepared by ${meta.preparedBy}`, { width: w })
  doc.font('Helvetica').fontSize(10).fillColor(MUTE).text(meta.dateLabel, { width: w })
  doc.moveDown(1)
  const y = doc.y
  doc.lineWidth(1).strokeColor(accent).moveTo(MARGIN.left, y).lineTo(MARGIN.left + 56, y).stroke()
  doc.moveDown(1.2)
}

function drawHeading(doc: Doc, block: Extract<DocBlock, { type: 'heading' }>): void {
  const size = block.level <= 1 ? 15 : block.level === 2 ? 12.5 : 11
  // Keep the heading with at least the next couple of lines.
  ensure(doc, size * 1.4 + 42)
  doc.moveDown(block.level <= 2 ? 0.7 : 0.4)
  renderRuns(doc, block.runs.map((r) => ({ ...r, bold: true })), { size, width: contentWidth(doc), lineGap: 2, color: INK })
  doc.moveDown(0.25)
}

function drawParagraph(doc: Doc, runs: DocRun[]): void {
  renderRuns(doc, runs, { size: 10.5, width: contentWidth(doc), lineGap: 3, color: INK })
  doc.moveDown(0.55)
}

function drawList(doc: Doc, block: Extract<DocBlock, { type: 'list' }>): void {
  const w = contentWidth(doc)
  block.items.forEach((item, idx) => {
    doc.font('Helvetica').fontSize(10.5)
    const bodyText = runsText(item)
    const h = doc.heightOfString(bodyText, { width: w - 18, lineGap: 3 })
    ensure(doc, h + 4)
    const y0 = doc.y
    const marker = block.ordered ? `${idx + 1}.` : '•'
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(ACCENT).text(marker, MARGIN.left, y0, { width: 14 })
    doc.y = y0
    renderRuns(doc, item, { size: 10.5, x: MARGIN.left + 18, width: w - 18, lineGap: 3, color: INK })
    doc.moveDown(0.2)
  })
  doc.moveDown(0.4)
}

function drawTermsTable(doc: Doc, block: Extract<DocBlock, { type: 'terms' }>): void {
  const w = contentWidth(doc)
  const labelW = Math.round(w * 0.4)
  const valueW = w - labelW
  doc.moveDown(0.2)
  for (const row of block.rows) {
    const labelText = runsText(row.label)
    const valueText = runsText(row.value)
    doc.font('Helvetica-Bold').fontSize(10)
    const hL = doc.heightOfString(labelText, { width: labelW - 16 })
    doc.font('Helvetica').fontSize(10)
    const hV = doc.heightOfString(valueText, { width: valueW - 16 })
    const rowH = Math.max(hL, hV, 14) + 12
    ensure(doc, rowH)
    const y = doc.y
    doc.lineWidth(0.5).strokeColor(RULE)
    doc.rect(MARGIN.left, y, labelW, rowH).stroke()
    doc.rect(MARGIN.left + labelW, y, valueW, rowH).stroke()
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(labelText, MARGIN.left + 8, y + 6, { width: labelW - 16 })
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(valueText, MARGIN.left + labelW + 8, y + 6, { width: valueW - 16 })
    doc.y = y + rowH
  }
  doc.x = MARGIN.left
  doc.moveDown(0.6)
}

function drawTable(doc: Doc, block: Extract<DocBlock, { type: 'table' }>): void {
  const w = contentWidth(doc)
  const cols = Math.max(block.header.length, 1)
  const colW = w / cols

  const drawRow = (cells: string[], header: boolean) => {
    doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5)
    const heights = cells.map((c) => doc.heightOfString(c || ' ', { width: colW - 12 }))
    const rowH = Math.max(...heights, 12) + 10
    ensure(doc, rowH)
    const y = doc.y
    if (header) doc.rect(MARGIN.left, y, w, rowH).fill(FAINT)
    doc.lineWidth(0.5).strokeColor(RULE)
    cells.forEach((cell, i) => {
      const x = MARGIN.left + i * colW
      doc.rect(x, y, colW, rowH).stroke()
      doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK).text(cell || '', x + 6, y + 5, { width: colW - 12 })
    })
    doc.y = y + rowH
  }

  doc.moveDown(0.2)
  if (block.header.length) drawRow(block.header, true)
  for (const row of block.rows) drawRow(row, false)
  doc.x = MARGIN.left
  doc.moveDown(0.6)
}

function drawFooters(doc: Doc, meta: ProposalClientDocument['meta']): void {
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i)
    // Writing text inside the bottom margin makes pdfkit think the page
    // overflowed and append a blank page — zero the bottom margin for the pass.
    const savedBottom = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    const y = doc.page.height - 50
    doc.lineWidth(0.5).strokeColor(RULE).moveTo(MARGIN.left, y).lineTo(doc.page.width - MARGIN.right, y).stroke()
    doc.font('Helvetica').fontSize(8).fillColor(MUTE)
    doc.text(`${meta.preparedBy}  |  Partnership Proposal`, MARGIN.left, y + 8, { width: contentWidth(doc) / 2, lineBreak: false })
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width / 2, y + 8, { width: contentWidth(doc) / 2, align: 'right', lineBreak: false })
    doc.page.margins.bottom = savedBottom
  }
}

export async function renderProposalPdf(document: ProposalClientDocument): Promise<Buffer> {
  // Load pdfkit lazily at call time (it's an external package) so it never
  // enters the build/dev module graph unnecessarily — avoids dev-server
  // bundling issues, matching Living OS's own approach.
  const { default: PDFDocument } = await import('pdfkit')
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: MARGIN, bufferPages: true, info: { Title: `Partnership Proposal — ${document.meta.partnerName}`, Author: document.meta.preparedBy } })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      drawCover(doc, document.meta)
      for (const block of document.blocks) {
        switch (block.type) {
          case 'heading': drawHeading(doc, block); break
          case 'paragraph': drawParagraph(doc, block.runs); break
          case 'list': drawList(doc, block); break
          case 'terms': drawTermsTable(doc, block); break
          case 'table': drawTable(doc, block); break
          case 'rule':
            doc.moveDown(0.3)
            doc.lineWidth(0.5).strokeColor(RULE).moveTo(MARGIN.left, doc.y).lineTo(doc.page.width - MARGIN.right, doc.y).stroke()
            doc.moveDown(0.5)
            break
        }
      }

      drawFooters(doc, document.meta)
      doc.end()
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
