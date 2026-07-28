import type { StatusTone } from '@/components/freehold/ui'

/**
 * ONE truth for status → colour across the whole app (7 semantic tones):
 *   green  = on / positive     (live, active, connected, paid, done, won)
 *   neutral= resting           (draft, paused, cold, lost, archived)
 *   amber  = needs attention   (warm, pending, review, at-risk)
 *   red    = urgent / negative (hot, error, overdue, failed)
 *   blue   = informational/new (renders as brand teal)
 *   violet = mid-process stage (qualified, viewing, negotiation)
 *   gold   = BRAND only        (featured / priority) — never a lifecycle state
 * Render via <StatusPill tone={...}> — surfaces must not invent local palettes.
 */
export const LEAD_STAGE_TONES: Record<string, StatusTone> = {
  new: 'blue', contacted: 'amber', qualified: 'violet', viewing: 'violet',
  negotiation: 'violet', closed: 'green', won: 'green', lost: 'neutral',
}

export const TEMPERATURE_TONES: Record<string, StatusTone> = {
  priority: 'gold', hot: 'red', warm: 'amber', cold: 'neutral',
}

export const CAMPAIGN_STATUS_TONES: Record<string, StatusTone> = {
  active: 'green', live: 'green', paused: 'neutral', draft: 'neutral',
  review: 'amber', pending_review: 'amber', scheduled: 'blue',
  error: 'red', failed: 'red', ended: 'neutral', missing: 'red',
}

export const CONNECTION_TONES: Record<string, StatusTone> = {
  connected: 'green', ok: 'green', disconnected: 'neutral',
  pending: 'amber', error: 'red',
}
