import { inflateRawSync } from 'zlib'

// Minimal .xlsx reader for OTA reports (GetYourGuide, Viator). Reads the
// first worksheet into rows of cell text. No dependency: an .xlsx is a zip
// of XML files, and Node's zlib handles the compressed entries.

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  // End of central directory: signature 0x06054b50, within the last 64 KB.
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const lNameLen = buf.readUInt16LE(localOffset + 26)
    const lExtraLen = buf.readUInt16LE(localOffset + 28)
    const start = localOffset + 30 + lNameLen + lExtraLen
    const data = buf.subarray(start, start + compSize)
    files.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data))
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

function allMatches(re: RegExp, s: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = []
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let m: RegExpExecArray | null
  while ((m = g.exec(s))) out.push(m)
  return out
}

function textOf(xml: string): string {
  return decode(allMatches(/<t[^>]*>([\s\S]*?)<\/t>/g, xml).map((m) => m[1]).join(''))
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64)
  return n - 1
}

/** Rows of the first sheet; each row is an array of cell strings ('' for blanks). */
export function readFirstSheet(buf: Buffer): string[][] {
  const files = unzip(buf)
  const shared: string[] = []
  const ss = files.get('xl/sharedStrings.xml')?.toString('utf8')
  if (ss) allMatches(/<si>([\s\S]*?)<\/si>/g, ss).forEach((m) => shared.push(textOf(m[1])))

  const sheetName = Array.from(files.keys())
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]))[0]
  if (!sheetName) throw new Error('No worksheet found in the file')
  const xml = files.get(sheetName)!.toString('utf8')

  const rows: string[][] = []
  for (const r of allMatches(/<row\b[^>]*>([\s\S]*?)<\/row>/g, xml)) {
    const row: string[] = []
    for (const c of allMatches(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, r[1])) {
      const attrs = c[1]
      const body = c[2] ?? ''
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]
      const type = attrs.match(/\bt="(\w+)"/)?.[1]
      let val = ''
      if (type === 'inlineStr') val = textOf(body)
      else {
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        if (v !== undefined) val = type === 's' ? shared[Number(v)] ?? '' : decode(v)
      }
      const idx = ref ? colIndex(ref) : row.length
      while (row.length < idx) row.push('')
      row[idx] = val.trim()
    }
    rows.push(row)
  }
  return rows
}
