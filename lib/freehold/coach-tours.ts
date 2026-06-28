/**
 * Role-aware coach-mark tours.
 *
 * Each role gets an ordered list of steps. A step optionally points at a
 * `[data-coach="<anchor>"]` element on the page; the engine spotlights that
 * element and pins a tooltip beside it. Steps with no anchor (or whose anchor
 * is not on the current page) render as a centred card, so a tour never breaks
 * just because a surface isn't mounted.
 *
 * Copy lives in the i18n dictionary under `coach.*` — here we only reference the
 * key prefix (we resolve `<prefix>.title` and `<prefix>.body` at render time).
 *
 * Anchors are defined in:
 *   - components/freehold/spaces-nav.tsx   (nav-spine, nav-<appId>, nav-home, user-menu)
 *   - components/freehold/expert-chat.tsx  (expert-chat)
 *   - app/freehold-intelligence/dashboard-client.tsx (hub-briefing, hub-ai)
 *   - app/freehold-intelligence/agent/page.tsx       (agent-apps)
 */

import type { Role } from './session-types'

export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface CoachStep {
  /** dictionary key prefix — `<prefix>.title` and `<prefix>.body` */
  key: string
  /** `data-coach` anchor to spotlight; omit for a centred step */
  anchor?: string
  /** preferred tooltip placement relative to the anchor */
  placement?: Placement
}

/** Bump when tour content changes enough to re-show it to returning users. */
export const COACH_VERSION = 'v2'

const COMMON_TAIL: CoachStep[] = [
  { key: 'coach.common.expert', anchor: 'expert-chat', placement: 'left' },
  { key: 'coach.common.account', anchor: 'user-menu', placement: 'bottom' },
  { key: 'coach.common.done', placement: 'center' },
]

export const TOURS: Record<Role, CoachStep[]> = {
  broker: [
    { key: 'coach.broker.welcome', placement: 'center' },
    { key: 'coach.broker.workspace', anchor: 'nav-agent', placement: 'bottom' },
    { key: 'coach.broker.apps', anchor: 'agent-apps', placement: 'top' },
    ...COMMON_TAIL,
  ],
  admin: [
    { key: 'coach.admin.welcome', placement: 'center' },
    { key: 'coach.common.nav', anchor: 'nav-spine', placement: 'bottom' },
    { key: 'coach.admin.settings', anchor: 'nav-settings', placement: 'bottom' },
    { key: 'coach.common.serverai', anchor: 'hub-ai', placement: 'top' },
    ...COMMON_TAIL,
  ],
  sales_manager: [
    { key: 'coach.manager.welcome', placement: 'center' },
    { key: 'coach.manager.crm', anchor: 'nav-crm', placement: 'bottom' },
    { key: 'coach.manager.management', anchor: 'nav-management', placement: 'bottom' },
    { key: 'coach.common.serverai', anchor: 'hub-ai', placement: 'top' },
    ...COMMON_TAIL,
  ],
  director: [
    { key: 'coach.director.welcome', placement: 'center' },
    { key: 'coach.director.management', anchor: 'nav-management', placement: 'bottom' },
    { key: 'coach.director.finance', anchor: 'nav-finance', placement: 'bottom' },
    ...COMMON_TAIL,
  ],
  ceo: [
    { key: 'coach.ceo.welcome', placement: 'center' },
    { key: 'coach.ceo.briefing', anchor: 'hub-briefing', placement: 'bottom' },
    { key: 'coach.ceo.management', anchor: 'nav-management', placement: 'bottom' },
    { key: 'coach.ceo.finance', anchor: 'nav-finance', placement: 'bottom' },
    ...COMMON_TAIL,
  ],
  marketing: [
    { key: 'coach.marketing.welcome', placement: 'center' },
    { key: 'coach.marketing.ads', anchor: 'nav-ads', placement: 'bottom' },
    { key: 'coach.marketing.studio', anchor: 'nav-ai-manager', placement: 'bottom' },
    { key: 'coach.marketing.analytics', anchor: 'nav-analytics', placement: 'bottom' },
    ...COMMON_TAIL,
  ],
}

/** Storage key that records a role's tour has been seen at this version. */
export function coachSeenKey(role: Role): string {
  return `fh_coach_seen_${role}_${COACH_VERSION}`
}

export function tourForRole(role: Role | undefined): CoachStep[] {
  if (!role) return []
  return TOURS[role] ?? []
}
