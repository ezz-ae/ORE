import type { EditorType } from '@/lib/freehold/drive'

/**
 * Contract for the shared Drive AI co-editor rail (AiEditorRail).
 *
 * The rail is a generic, agentic editing surface: the user types a natural-language
 * instruction, the host ADAPTER performs the real edit on the artifact and returns
 * the post-edit snapshot, and the rail records a reversible turn (undo/redo). The
 * rail never branches on artifact type — every doc/image specific behaviour lives
 * in the adapter closures the host injects. This keeps "edit anything" a single
 * component instead of a per-type bolt-on.
 */

/** Opaque snapshot the rail stores for undo/redo; the host owns the encoding.
 *  `string` for both doc (textarea content) and image (source-layer URL) today. */
export type Snapshot = string

/** Thrown by an adapter when the endpoint reports `{ unavailable: true }` (no API
 *  key configured). Typed so the rail can render the honest "not configured" copy
 *  instead of a raw error message. */
export class AiUnavailable extends Error {
  constructor() {
    super('AI_UNAVAILABLE')
    this.name = 'AiUnavailable'
  }
}

/** Client-side hard cap on doc length. Mirrors the server slice in doc-ai/route.ts. */
export const DOC_LIMIT = 40_000

/** A quick-edit chip: a localized label + a localized instruction that PREFILLS the
 *  composer (never auto-sent — what the user sees is exactly what gets applied). */
export interface PresetChip {
  labelKey: string
  instructionKey: string
}

export interface ApplyArgs<S = Snapshot> {
  instruction: string
  /** Snapshot captured by the rail at submit — folds in any manual edits. */
  before: S
  /** Aborted by the Stop button; the adapter MUST pass it into fetch. */
  signal: AbortSignal
}

export interface TurnResult<S = Snapshot> {
  /** Post-turn snapshot the adapter set (returned directly — no re-snapshot race). */
  after: S
  /** FACTUAL, localized summary (length delta / action). NEVER a quality claim. */
  summary: string
  /** Adapter proved nothing changed → the rail records no undo entry. */
  noop?: boolean
  /** Server processed only part of the input → the rail warns and applies nothing. */
  truncated?: boolean
}

export interface ArtifactAdapter<S = Snapshot> {
  /** For i18n / telemetry only — the rail never branches on it. */
  kind: EditorType
  /** Capture the current artifact synchronously. MUST NOT throw. */
  snapshot: () => S
  /** Undo/redo ONLY. MUST bypass the manual-edit path (MUST NOT bump `revision`).
   *  SHOULD set the host's dirty flag. */
  restore: (snap: S) => void
  /** Calls the REAL endpoint. On success mutates the artifact AND returns
   *  { after, summary }. On provider/quota/key error MUST throw (AiUnavailable, or
   *  Error(realMessage)) and leave the artifact UNTOUCHED. */
  apply: (args: ApplyArgs<S>) => Promise<TurnResult<S>>
  /** Sync, no-network gate. Return a LOCALIZED blocking message, or null to proceed. */
  preflight?: (instruction: string, before: S) => string | null
}

export interface AiEditorRailProps<S = Snapshot> {
  adapter: ArtifactAdapter<S>
  /** Host-owned; ++ on every MANUAL edit, NEVER on restore(). */
  revision: number
  /** [] / undefined hides the chip row. */
  presets?: PresetChip[]
  /** Composer placeholder i18n key (host picks the doc/image example). */
  placeholderKey: string
  /** Host hard-disable (e.g. doc HTML-preview open); image never disables. */
  disabled?: boolean
  /** Localized reason shown when disabled. */
  disabledHintKey?: string
  /** Optional quiet footer note (e.g. the image flatten tradeoff). */
  footNoteKey?: string
}
