'use client'

/**
 * Lightweight client event bus that lets any on-page "AI box" push a message
 * into the single docked Expert conversation (the right-side panel).
 *
 * This keeps ONE AI conversation for the whole workspace instead of many
 * disconnected inline chats — clearer for the user.
 */

export const EXPERT_SEND = 'freehold:expert-send'
export const EXPERT_OPEN = 'freehold:expert-open'

/**
 * A specific system record "pinned" to a chat turn — e.g. the campaign, lead,
 * or project a detail page's "Ask the Expert" strip was opened from. Lets the
 * server hand the model a real id instead of the model having to infer one
 * from a name mentioned in prose (two records can share a name; only one has
 * this id).
 */
export interface ExpertContextRef {
  kind: 'campaign' | 'lead' | 'project' | 'unit'
  id: string
  /** Display label for the chip shown on the user's message bubble. */
  label: string
  href?: string
}

/** Open the Expert panel and send a message into the shared conversation.
 * `ref` optionally pins a specific record as this turn's subject. */
export function sendToExpert(message: string, ref?: ExpertContextRef) {
  if (typeof window === 'undefined') return
  const text = message.trim()
  if (!text) return
  window.dispatchEvent(new CustomEvent(EXPERT_SEND, { detail: { message: text, ref } }))
}

/** Just open the Expert panel without sending anything. */
export function openExpert() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EXPERT_OPEN))
}

// ─── Editor surface registry ─────────────────────────────────────────────────
// When a Drive editor is open it registers itself here, and the ONE Expert
// side chat becomes its instruction box — no second chat rail next to it.
// The editor keeps ownership of the artifact + undo history; the chat only
// forwards instructions and reports factual summaries.

export const EXPERT_EDITOR_CHANGED = 'freehold:expert-editor-changed'

export interface ExpertEditorSurface {
  /** 'doc' | 'image' | … — display only. */
  kind: string
  /** Localized artifact label for the chat chip. */
  title: string
  /** Localized quick-edit chips (label + the instruction it prefills). */
  presets: () => { label: string; instruction: string }[]
  /** Apply an instruction to the OPEN artifact. Returns a factual summary. */
  apply: (instruction: string) => Promise<{ ok: boolean; summary: string }>
  canUndo: () => boolean
  /** Undo the last AI edit. False = blocked (manual edits since — use the
   *  editor's own undo button, which asks for confirmation). */
  undo: () => boolean
}

let activeEditor: ExpertEditorSurface | null = null

export function registerExpertEditor(surface: ExpertEditorSurface) {
  activeEditor = surface
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EXPERT_EDITOR_CHANGED))
}

export function unregisterExpertEditor(surface: ExpertEditorSurface) {
  if (activeEditor === surface) {
    activeEditor = null
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EXPERT_EDITOR_CHANGED))
  }
}

export function getExpertEditor(): ExpertEditorSurface | null {
  return activeEditor
}
