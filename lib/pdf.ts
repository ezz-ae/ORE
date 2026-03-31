import fs from "node:fs"
import path from "node:path"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { Project } from "@/lib/types/project"

const GOLD = rgb(0.05, 0.43, 0.43) // ORE Teal

const loadLogo = () => {
  const logoPath = path.join(process.cwd(), "public", "logo-light.png")
  return fs.readFileSync(logoPath)
}

const formatAed = (value: number) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(value)

const getPriceRange = (project: Project) => {
  const prices = project.units.flatMap((unit) => [unit.priceFrom, unit.priceTo])
  if (!prices.length) return "Pricing on request"
  return `${formatAed(Math.min(...prices))} - ${formatAed(Math.max(...prices))}`
}

export async function generateProjectPdf(project: Project) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const logoBytes = loadLogo()
  const logo = await pdfDoc.embedPng(logoBytes)
  const logoWidth = 140
  const logoHeight = (logo.height / logo.width) * logoWidth
  page.drawImage(logo, { x: 40, y: height - 60, width: logoWidth, height: logoHeight })

  page.drawText("ORE Real Estate", {
    x: 40,
    y: height - 90,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45),
  })

  page.drawText(project.name, { x: 40, y: height - 140, size: 20, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText(project.tagline, { x: 40, y: height - 165, size: 12, font, color: rgb(0.35, 0.35, 0.35) })

  const details = [
    `Location: ${project.location.area}, ${project.location.city}`,
    `Developer: ${project.developer.name}`,
    `Price Range: ${getPriceRange(project)}`,
    `Expected ROI: ${project.investmentHighlights.expectedROI}%`,
    `Rental Yield: ${project.investmentHighlights.rentalYield}%`,
    `Handover: ${project.timeline.handoverDate}`,
  ]

  let y = height - 210
  details.forEach((line) => {
    page.drawText(line, { x: 40, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
    y -= 18
  })

  page.drawRectangle({ x: 40, y: y - 10, width: width - 80, height: 1, color: rgb(0.85, 0.85, 0.85) })
  y -= 30

  page.drawText("Project Highlights", { x: 40, y, size: 12, font: fontBold, color: GOLD })
  y -= 18

  const highlights = project.highlights.slice(0, 6)
  highlights.forEach((item) => {
    page.drawText(`• ${item}`, { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) })
    y -= 14
  })

  page.drawText("Data: ORE Intelligence", {
    x: 40,
    y: 30,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export async function generateComparisonPdf(projects: Project[]) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([612, 792])
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const logoBytes = loadLogo()
  const logo = await pdfDoc.embedPng(logoBytes)
  const logoWidth = 140
  const logoHeight = (logo.height / logo.width) * logoWidth
  page.drawImage(logo, { x: 40, y: height - 60, width: logoWidth, height: logoHeight })

  page.drawText("Project Comparison", { x: 40, y: height - 120, size: 18, font: fontBold, color: rgb(0, 0, 0) })
  page.drawText("ORE Real Estate", {
    x: 40,
    y: height - 140,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45),
  })

  let y = height - 175
  projects.slice(0, 2).forEach((project, index) => {
    page.drawText(`${index + 1}. ${project.name}`, { x: 40, y, size: 12, font: fontBold, color: GOLD })
    y -= 16
    const lines = [
      `Location: ${project.location.area}`,
      `Price Range: ${getPriceRange(project)}`,
      `Expected ROI: ${project.investmentHighlights.expectedROI}%`,
      `Rental Yield: ${project.investmentHighlights.rentalYield}%`,
      `Handover: ${project.timeline.handoverDate}`,
    ]
    lines.forEach((line) => {
      page.drawText(line, { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) })
      y -= 14
    })
    y -= 10
    page.drawRectangle({ x: 40, y, width: width - 80, height: 1, color: rgb(0.9, 0.9, 0.9) })
    y -= 20
  })

  page.drawText("Data: ORE Intelligence", {
    x: 40,
    y: 30,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
