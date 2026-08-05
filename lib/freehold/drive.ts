// Drive — client-safe helpers shared by the asset browser and (later) the
// editors. Pure logic only: NO server imports (so it is safe in client
// components). The Library data layer lives in lib/freehold/library.ts.

export type DriveKind = 'report' | 'note' | 'creative' | 'image' | 'video' | 'pdf'

// The editor "tenants" behind the one universal Editor shell.
export type EditorType = 'landing' | 'doc' | 'image' | 'video' | 'pdf'

// Honesty as a code construct, rendered as a badge on every asset + editor.
//   real  = fully-functional editor
//   scoped = genuinely useful but honestly limited (labeled in-UI)
//   view  = view / extract / regenerate (not in-place edit)
export type EditorStatus = 'real' | 'scoped' | 'view'
export const EDITOR_STATUS: Record<EditorType, EditorStatus> = {
  landing: 'real',
  doc:     'real',
  image:   'real',
  video:   'scoped',
  pdf:     'scoped', // view + AI extract + real page edits (stamp/rotate/delete/merge) via pdf-lib
}

// Which editor opens a given Library asset. A text-only creative (no url)
// edits as a doc; a creative with a url edits on the image canvas.
export function editorTypeForKind(kind: DriveKind, hasUrl: boolean): EditorType {
  switch (kind) {
    case 'image':    return 'image'
    case 'creative': return hasUrl ? 'image' : 'doc'
    case 'video':    return 'video'
    case 'pdf':      return 'pdf'
    case 'report':
    case 'note':     return 'doc'
    default:         return 'doc'
  }
}

const DRIVE_BASE = '/freehold-intelligence/drive'

export function editorHrefForItem(item: { id: string; kind: DriveKind; url?: string | null }): string {
  const type = editorTypeForKind(item.kind, !!item.url)
  return `${DRIVE_BASE}/editor/${type}/${item.id}`
}

// Landing pages are not Library rows — they open in their own existing editor.
export function landingEditHref(slug: string): string {
  return `/freehold-intelligence/inventory/landings/${encodeURIComponent(slug)}/edit`
}

// Presentation metadata per kind. i18nKey reuses the existing nb.lib.kind.*
// dictionary so we never duplicate translations.
export const KIND_META: Record<DriveKind, { i18nKey: string; accent: string; media: boolean }> = {
  report:   { i18nKey: 'nb.lib.kind.report',   accent: '#F472B6', media: false },
  note:     { i18nKey: 'nb.lib.kind.note',     accent: '#A78BFA', media: false },
  creative: { i18nKey: 'nb.lib.kind.creative', accent: '#60A5FA', media: false },
  image:    { i18nKey: 'nb.lib.kind.image',    accent: '#34D399', media: true },
  video:    { i18nKey: 'nb.lib.kind.video',    accent: '#FBBF24', media: true },
  pdf:      { i18nKey: 'nb.lib.kind.pdf',       accent: '#F87171', media: true },
}
