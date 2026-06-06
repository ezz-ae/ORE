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

/** Open the Expert panel and send a message into the shared conversation. */
export function sendToExpert(message: string) {
  if (typeof window === 'undefined') return
  const text = message.trim()
  if (!text) return
  window.dispatchEvent(new CustomEvent(EXPERT_SEND, { detail: { message: text } }))
}

/** Just open the Expert panel without sending anything. */
export function openExpert() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EXPERT_OPEN))
}
