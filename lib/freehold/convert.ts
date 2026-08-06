/**
 * Convert — add a file, get the file you need, same name.
 *
 * The governing rule, and the reason this file is structured the way it is:
 *
 *   A conversion is only offered if it will actually happen.
 *
 * The reference PDF tool that prompted this shipped a "compressor" whose
 * quality setting was computed and never used, whose one real operation made
 * files ~96% LARGER, and which reported "0% compressed" because it clamped the
 * negative away. The user downloaded something worse and was told it worked.
 *
 * So there is no target list here that outruns the code. `targetsFor()` returns
 * only formats a converter exists for, and each converter either produces real
 * bytes in the real format or throws. Nothing is ever renamed and handed back.
 *
 * What can honestly be done in a browser with what this app already carries:
 *
 *   images   PNG · JPG · WEBP, any direction            (canvas)
 *   images   → PDF, one page per image                  (pdf-lib)
 *   video    → MP4 or WEBM, re-encoded smaller          (canvas + MediaRecorder)
 *   video    → GIF, a looping cut                       (gifenc)
 *   tables   CSV · XLSX · JSON, any direction           (xlsx)
 *
 * What deliberately is NOT offered, because it cannot be done properly here:
 * PDF → image or text (needs a PDF renderer), anything → DOCX, and audio
 * transcoding. Those say so on the screen instead of pretending.
 */

import { safeFileName } from './bundle'

export type FileKind = 'image' | 'video' | 'table' | 'pdf' | 'unknown'

/** Every format this can WRITE. Extending it means writing a converter too. */
export type TargetFormat = 'png' | 'jpg' | 'webp' | 'pdf' | 'mp4' | 'webm' | 'gif' | 'csv' | 'xlsx' | 'json'

export interface TargetDef {
  format: TargetFormat
  /** i18n key for the one-line description shown under the format. */
  noteKey: string
  /** Formats that are the same bytes as the source — offered, but flagged. */
  lossless?: boolean
}

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif']
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv']
const TABLE_EXT = ['csv', 'tsv', 'xlsx', 'xls', 'json']

/** What kind of thing is this? Extension first, then the mime as a fallback. */
export function kindOf(fileName: string, mime = ''): FileKind {
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  if (IMAGE_EXT.includes(ext)) return 'image'
  if (VIDEO_EXT.includes(ext)) return 'video'
  if (TABLE_EXT.includes(ext)) return 'table'
  if (ext === 'pdf') return 'pdf'
  const m = mime.toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m === 'application/pdf') return 'pdf'
  if (m === 'text/csv' || m.includes('spreadsheet') || m === 'application/json') return 'table'
  return 'unknown'
}

/**
 * The targets that genuinely exist for a source. The source's own format is
 * excluded — "convert PNG to PNG" is a button that does nothing.
 */
export function targetsFor(kind: FileKind, sourceExt = ''): TargetDef[] {
  const ext = sourceExt.toLowerCase().replace(/^\./, '')
  const not = (f: TargetFormat) => !(f === ext || (f === 'jpg' && ext === 'jpeg'))

  switch (kind) {
    case 'image':
      return ([
        { format: 'png',  noteKey: 'conv.note.png' },
        { format: 'jpg',  noteKey: 'conv.note.jpg' },
        { format: 'webp', noteKey: 'conv.note.webp' },
        { format: 'pdf',  noteKey: 'conv.note.imgPdf' },
      ] as TargetDef[]).filter((t) => not(t.format))
    case 'video':
      return ([
        { format: 'mp4',  noteKey: 'conv.note.mp4' },
        { format: 'webm', noteKey: 'conv.note.webm' },
        { format: 'gif',  noteKey: 'conv.note.gif' },
      ] as TargetDef[]).filter((t) => not(t.format))
    case 'table':
      return ([
        { format: 'csv',  noteKey: 'conv.note.csv' },
        { format: 'xlsx', noteKey: 'conv.note.xlsx' },
        { format: 'json', noteKey: 'conv.note.json' },
      ] as TargetDef[]).filter((t) => not(t.format))
    // A PDF can be read by the brochure parser, but nothing here can render or
    // re-author one, and saying otherwise is how the reference tool went wrong.
    case 'pdf':
    case 'unknown':
    default:
      return []
  }
}

/**
 * The output's name: the source's, with the new extension.
 *
 * "end file name" was the explicit ask — a converter that hands back
 * `download (3).bin` has made the file harder to use, not easier.
 */
export function outputName(sourceName: string, format: TargetFormat): string {
  const base = sourceName.replace(/\.[^.]+$/, '') || 'converted'
  return `${safeFileName(base, 'converted')}.${format}`
}

/** MIME for a target — needed for the Blob and for what the OS does with it. */
export function mimeFor(format: TargetFormat): string {
  switch (format) {
    case 'png':  return 'image/png'
    case 'jpg':  return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif':  return 'image/gif'
    case 'pdf':  return 'application/pdf'
    case 'mp4':  return 'video/mp4'
    case 'webm': return 'video/webm'
    case 'csv':  return 'text/csv'
    case 'json': return 'application/json'
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
}

/**
 * Some conversions cannot be honoured exactly by the browser and the honest
 * thing is to say which before the user waits.
 *
 * A video "to MP4" depends on what this browser's MediaRecorder can produce —
 * a WebM-only browser genuinely cannot write MP4, and pretending otherwise
 * would hand back a WebM with an .mp4 name: a file that lies about itself.
 */
export interface ConversionCaveat {
  /** i18n key. */
  key: string
  /** Blocking — the conversion must not be attempted at all. */
  blocking: boolean
}

export function caveatFor(
  format: TargetFormat,
  recorderExt: 'mp4' | 'webm' | null,
): ConversionCaveat | null {
  if (format !== 'mp4' && format !== 'webm') return null
  if (recorderExt === null) return { key: 'conv.caveat.noRecorder', blocking: true }
  if (recorderExt !== format) return { key: 'conv.caveat.container', blocking: true }
  return null
}

/** Rows → CSV, with the quoting a spreadsheet will actually read back. */
export function toCsv(rows: unknown[][]): string {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v)
    // Quote when the value contains a delimiter, a quote or a newline —
    // an unquoted comma silently splits one column into two.
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(cell).join(',')).join('\r\n')
}

/**
 * A sheet's rows to objects, using the first row as keys. Blank and duplicate
 * headers are repaired rather than silently collapsing columns together.
 */
export function rowsToObjects(rows: unknown[][]): Record<string, unknown>[] {
  if (rows.length === 0) return []
  const seen = new Map<string, number>()
  const headers = (rows[0] ?? []).map((h, i) => {
    let key = String(h ?? '').trim() || `column_${i + 1}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    if (n > 0) key = `${key}_${n + 1}`
    return key
  })
  return rows.slice(1).map((r) => {
    const o: Record<string, unknown> = {}
    headers.forEach((h, i) => { o[h] = r[i] ?? '' })
    return o
  })
}
