'use client'

/**
 * The converters themselves — the half that touches a canvas, a decoder or a
 * worker, and therefore cannot live in the pure module beside it.
 *
 * Every function here either returns real bytes in the requested format or
 * throws. None of them renames a file and hands it back. That is the whole
 * contract, and lib/freehold/convert.ts refuses to offer a target this file
 * cannot honour.
 */

import { PDFDocument } from 'pdf-lib'
import { mimeFor, toCsv, rowsToObjects, type TargetFormat } from './convert'
import { pickRecorderMime } from './video-export'
import { planCompress, probeVideo, compressVideo } from './video-compress'
import { planGif, encodeGif } from './gif-encode'

export interface ConvertProgress { (fraction: number): void }

/** Decode a file into an <img> the canvas can draw. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image')) }
    img.src = url
  })
}

/** PNG · JPG · WEBP. JPEG has no alpha, so transparency is flattened to white
 *  rather than turned into a black box, which is what an un-filled canvas gives. */
async function imageToImage(file: File, format: 'png' | 'jpg' | 'webp'): Promise<Blob> {
  const img = await loadImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0)

  const mime = mimeFor(format)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, format === 'png' ? undefined : 0.92))
  if (!blob) throw new Error('This browser could not write that image format')
  // Chrome silently falls back to PNG for a format it cannot encode. Returning
  // that as a .webp would be a file lying about itself.
  if (blob.type && blob.type !== mime) {
    throw new Error(`This browser cannot write ${format.toUpperCase()} — it produced ${blob.type}`)
  }
  return blob
}

/** One image per page, page sized to the image so nothing is cropped. */
async function imageToPdf(file: File): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdf = await PDFDocument.create()
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name)
  let embedded
  try {
    embedded = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
  } catch {
    // WEBP and the rest are not embeddable directly — go through a canvas.
    const png = await imageToImage(file, 'png')
    embedded = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()))
  }
  const page = pdf.addPage([embedded.width, embedded.height])
  page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
  // Default save — object streams ON. The reference tool disabled them and
  // called the result "compressed"; it nearly doubled the file.
  const out = await pdf.save()
  return new Blob([out as BlobPart], { type: 'application/pdf' })
}

/** Re-encode a clip. The container is whatever this browser truly records. */
async function videoToVideo(file: File, onProgress?: ConvertProgress): Promise<Blob> {
  const meta = await probeVideo(file)
  const plan = planCompress({
    sourceWidth: meta.width, sourceHeight: meta.height,
    durationSecs: meta.duration, sourceBytes: file.size,
  })
  const { blob } = await compressVideo(file, plan, onProgress)
  return blob
}

/** A looping GIF from the first seconds of a clip. */
async function videoToGif(file: File, onProgress?: ConvertProgress): Promise<Blob> {
  const meta = await probeVideo(file)
  if (!meta.width || !meta.height) throw new Error('That clip has no readable dimensions')
  const plan = planGif({
    sourceWidth: meta.width, sourceHeight: meta.height, durationSecs: meta.duration,
  })

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.preload = 'auto'
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('That clip could not be read'))
    })

    /** Seek and wait for the frame to be ready before drawing it. */
    const seekTo = (t: number) => new Promise<void>((resolve) => {
      const done = () => { video.removeEventListener('seeked', done); resolve() }
      video.addEventListener('seeked', done)
      video.currentTime = Math.min(t, Math.max(0, (video.duration || 0) - 0.01))
    })

    return await encodeGif(
      plan,
      async (ctx, t, w, h) => {
        await seekTo(t)
        ctx.drawImage(video, 0, 0, w, h)
      },
      (done, total) => onProgress?.(done / total),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Read any supported table into rows. */
async function readTable(file: File): Promise<unknown[][]> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (ext === 'json') {
    const parsed: unknown = JSON.parse(await file.text())
    if (!Array.isArray(parsed)) throw new Error('That JSON is not a list of rows')
    if (parsed.length === 0) return []
    if (Array.isArray(parsed[0])) return parsed as unknown[][]
    const objs = parsed as Record<string, unknown>[]
    // Union of keys across ALL rows — using only the first would drop a column
    // that appears later, silently.
    const keys = [...new Set(objs.flatMap((o) => Object.keys(o ?? {})))]
    return [keys, ...objs.map((o) => keys.map((k) => o?.[k] ?? ''))]
  }
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('That file has no readable sheet')
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
}

async function tableTo(file: File, format: 'csv' | 'xlsx' | 'json'): Promise<Blob> {
  const rows = await readTable(file)
  if (format === 'csv') return new Blob([toCsv(rows)], { type: mimeFor('csv') })
  if (format === 'json') {
    return new Blob([JSON.stringify(rowsToObjects(rows), null, 2)], { type: mimeFor('json') })
  }
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], { type: mimeFor('xlsx') })
}

/**
 * Run the conversion. Throws with a sentence a person can act on — never
 * returns the input wearing a different extension.
 */
export async function convertFile(
  file: File,
  format: TargetFormat,
  onProgress?: ConvertProgress,
): Promise<Blob> {
  switch (format) {
    case 'png': case 'jpg': case 'webp':
      return imageToImage(file, format)
    case 'pdf':
      return imageToPdf(file)
    case 'mp4': case 'webm': {
      const choice = pickRecorderMime()
      if (!choice) throw new Error('This browser cannot re-encode video')
      if (choice.ext !== format) {
        throw new Error(`This browser records ${choice.ext.toUpperCase()}, not ${format.toUpperCase()}`)
      }
      return videoToVideo(file, onProgress)
    }
    case 'gif':
      return videoToGif(file, onProgress)
    case 'csv': case 'xlsx': case 'json':
      return tableTo(file, format)
  }
}
