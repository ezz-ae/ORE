import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'

// ─── Broker PDF documents ─────────────────────────────────────────────────────
// One-page, Freehold-branded PDFs a broker generates from a project's real
// facts. The DRAFT OFFER is watermarked and explicitly non-binding — a broker
// sends it to gauge whether a lead is serious before investing real effort.

const GOLD = rgb(0.83, 0.686, 0.216)
const INK = rgb(0.09, 0.11, 0.13)
const MUTE = rgb(0.42, 0.45, 0.5)
const LINE = rgb(0.85, 0.86, 0.88)

export interface OfferData {
  project: string
  developer?: string
  area?: string
  unit?: string
  priceAed?: string
  deposit?: string
  monthly?: string
  onHandover?: string
  handoverDate?: string
  highlights?: string[]
  brokerName?: string
  brokerPhone?: string
  brokerCompany?: string
}

// Greedy word-wrap against a width in points.
function wrap(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function buildDraftOffer(d: OfferData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842]) // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const M = 48
  let y = height

  // ── Header band ──
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: INK })
  page.drawText((d.brokerCompany || 'Freehold').toUpperCase(), { x: M, y: height - 46, size: 20, font: bold, color: GOLD })
  page.drawText('DRAFT SALES OFFER', { x: M, y: height - 74, size: 11, font, color: rgb(0.8, 0.82, 0.85) })
  page.drawText('INDICATIVE — NOT A BINDING OFFER', { x: width - M - bold.widthOfTextAtSize('INDICATIVE — NOT A BINDING OFFER', 8), y: height - 60, size: 8, font: bold, color: rgb(0.8, 0.55, 0.2) })

  // ── Diagonal DRAFT watermark ──
  page.drawText('DRAFT', { x: 110, y: 360, size: 150, font: bold, color: rgb(0.93, 0.93, 0.94), rotate: degrees(45), opacity: 0.5 })

  y = height - 140
  page.drawText(d.project || 'Project', { x: M, y, size: 24, font: bold, color: INK })
  y -= 22
  const sub = [d.area, d.developer].filter(Boolean).join('  ·  ')
  if (sub) { page.drawText(sub, { x: M, y, size: 11, font, color: MUTE }); y -= 8 }
  y -= 24

  // ── Price + payment table ──
  const rows: Array<[string, string]> = []
  if (d.unit) rows.push(['Unit', d.unit])
  if (d.priceAed) rows.push(['Price', d.priceAed])
  if (d.deposit) rows.push(['Booking / Deposit', d.deposit])
  if (d.monthly) rows.push(['Monthly installment', d.monthly])
  if (d.onHandover) rows.push(['On handover', d.onHandover])
  if (d.handoverDate) rows.push(['Handover', d.handoverDate])
  for (const [label, value] of rows) {
    page.drawLine({ start: { x: M, y: y + 16 }, end: { x: width - M, y: y + 16 }, thickness: 0.5, color: LINE })
    page.drawText(label, { x: M, y, size: 11, font, color: MUTE })
    page.drawText(value, { x: width - M - bold.widthOfTextAtSize(value, 12), y: y - 1, size: 12, font: bold, color: INK })
    y -= 26
  }
  page.drawLine({ start: { x: M, y: y + 16 }, end: { x: width - M, y: y + 16 }, thickness: 0.5, color: LINE })
  y -= 18

  // ── Highlights ──
  if (d.highlights && d.highlights.length) {
    page.drawText('HIGHLIGHTS', { x: M, y, size: 9, font: bold, color: GOLD }); y -= 18
    for (const h of d.highlights.slice(0, 6)) {
      for (const ln of wrap(`•  ${h}`, font, 11, width - 2 * M)) {
        page.drawText(ln, { x: M, y, size: 11, font, color: INK }); y -= 16
      }
    }
    y -= 8
  }

  // ── Broker block ──
  const bName = d.brokerName || 'Your Freehold consultant'
  page.drawText('Prepared by', { x: M, y, size: 9, font: bold, color: GOLD }); y -= 16
  page.drawText(bName, { x: M, y, size: 12, font: bold, color: INK }); y -= 15
  if (d.brokerPhone) { page.drawText(d.brokerPhone, { x: M, y, size: 11, font, color: MUTE }); y -= 15 }

  // ── Footer disclaimer ──
  const disc = 'This is a DRAFT indicative offer for discussion only. It is not a reservation, contract, or binding offer. All prices, unit availability, payment terms and dates are subject to written confirmation by the developer. Errors and omissions excepted.'
  let fy = 70
  for (const ln of wrap(disc, font, 7.5, width - 2 * M)) {
    page.drawText(ln, { x: M, y: fy, size: 7.5, font, color: MUTE }); fy -= 11
  }
  page.drawLine({ start: { x: M, y: 78 }, end: { x: width - M, y: 78 }, thickness: 0.5, color: LINE })

  return pdf.save()
}
