import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib'

export interface ExplainerData {
  title?: string
  subtitle?: string
  keyFacts?: Array<{ label?: string; value?: string }>
  sections?: Array<{ heading?: string; body?: string }>
  highlights?: string[]
}

// pdf-lib's standard fonts are WinAnsi-only and THROW on characters they can't
// encode. The AI is asked to write English, but we still normalise typography
// and drop anything outside printable ASCII so a stray glyph never crashes the
// export. (A full Unicode/Arabic explainer needs an embedded font — a follow-up.)
function safe(s: string | undefined): string {
  return (s || '')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim()
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(test, size) > maxW && line) { out.push(line); line = w }
      else line = test
    }
    if (line) out.push(line)
  }
  return out
}

/**
 * Render an AI-organised project explanation into a clean, branded, client-ready
 * PDF (Freehold gold accents + logo, A4, auto-paginated). Pure client-side via
 * pdf-lib. `logo` is optional PNG/JPG bytes (e.g. the brand icon).
 */
export async function buildExplainerPdf(data: ExplainerData, logo?: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let logoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null
  if (logo && logo.length) {
    try { logoImg = await doc.embedPng(logo) } catch { try { logoImg = await doc.embedJpg(logo) } catch { logoImg = null } }
  }

  const W = 595.28, H = 841.89, M = 48
  const gold = rgb(0.776, 0.631, 0.357)
  const ink = rgb(0.082, 0.180, 0.141)
  const dark = rgb(0.12, 0.14, 0.16)
  const gray = rgb(0.42, 0.45, 0.5)
  const line = rgb(0.90, 0.91, 0.93)
  const contentW = W - M * 2
  type Col = ReturnType<typeof rgb>

  let page!: PDFPage
  let y = 0

  const footer = (p: PDFPage) => {
    p.drawLine({ start: { x: M, y: 44 }, end: { x: W - M, y: 44 }, thickness: 0.5, color: line })
    p.drawText('Freehold — prepared for you', { x: M, y: 32, size: 8, font, color: gray })
    const site = 'freeholdproperty.ae'
    p.drawText(site, { x: W - M - font.widthOfTextAtSize(site, 8), y: 32, size: 8, font, color: gray })
  }
  const newPage = () => {
    if (page) footer(page)
    page = doc.addPage([W, H])
    page.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: gold }) // top brand rule
    y = H - M
    if (logoImg) {
      const lw = 42, lh = lw * (logoImg.height / logoImg.width)
      page.drawImage(logoImg, { x: W - M - lw, y: y - lh + 8, width: lw, height: lh })
    }
  }
  const ensure = (need: number) => { if (y - need < 60) newPage() }
  const drawWrapped = (text: string, f: PDFFont, size: number, color: Col, leading: number, indent = 0) => {
    for (const ln of wrapText(safe(text), f, size, contentW - indent)) {
      ensure(leading)
      page.drawText(ln, { x: M + indent, y: y - size, size, font: f, color })
      y -= leading
    }
  }

  newPage()

  // Title + subtitle
  ensure(40)
  page.drawText(safe(data.title || 'Project overview').slice(0, 60), { x: M, y: y - 24, size: 24, font: bold, color: ink })
  y -= 34
  if (data.subtitle) {
    page.drawText(safe(data.subtitle).slice(0, 96), { x: M, y: y - 12, size: 11, font, color: gray })
    y -= 22
  }
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: gold })
  y -= 24

  // Key facts — two columns
  const facts = (data.keyFacts || []).filter((f) => f && f.value)
  if (facts.length) {
    const colW = contentW / 2
    for (let i = 0; i < facts.length; i += 2) {
      ensure(36)
      for (let c = 0; c < 2; c++) {
        const f = facts[i + c]
        if (!f) continue
        const x = M + c * colW
        page.drawText(safe(f.label).toUpperCase().slice(0, 30), { x, y: y - 8, size: 7.5, font: bold, color: gray })
        page.drawText(safe(f.value).slice(0, 42), { x, y: y - 22, size: 11, font: bold, color: dark })
      }
      y -= 36
    }
    y -= 8
  }

  // Sections
  for (const s of data.sections || []) {
    if (!s || (!s.body && !s.heading)) continue
    ensure(32)
    if (s.heading) {
      page.drawText(safe(s.heading).slice(0, 64), { x: M, y: y - 13, size: 13, font: bold, color: gold })
      y -= 22
    }
    if (s.body) drawWrapped(s.body, font, 10.5, dark, 15)
    y -= 12
  }

  // Highlights
  const highlights = (data.highlights || []).filter(Boolean)
  if (highlights.length) {
    ensure(30)
    page.drawText('Highlights', { x: M, y: y - 13, size: 13, font: bold, color: gold })
    y -= 22
    for (const h of highlights) {
      const lines = wrapText(safe(h), font, 10.5, contentW - 16)
      ensure(15 * lines.length + 4)
      page.drawCircle({ x: M + 3, y: y - 7, size: 2, color: gold })
      for (const ln of lines) {
        page.drawText(ln, { x: M + 14, y: y - 10, size: 10.5, font, color: dark })
        y -= 15
      }
      y -= 3
    }
  }

  footer(page)
  return doc.save()
}
