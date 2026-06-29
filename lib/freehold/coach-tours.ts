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
export const COACH_VERSION = 'v4'

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
    { key: 'coach.broker.depth', anchor: 'expert-depth', placement: 'bottom' },
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

/**
 * Per-app contextual tours. These auto-start once the first time a user opens
 * each app surface (independent of the role welcome), and back the "Take a tour"
 * button on every app page. Step 1 spotlights the app header
 * (`data-coach="app-<id>"`, added in each app layout); step 2 is a centred tip
 * so it always renders even on surfaces without the header anchor.
 */
export const APP_TOURS: Record<string, CoachStep[]> = {
  crm: [
    { key: 'coach.app.crm.intro', anchor: 'app-crm', placement: 'bottom' },
    { key: 'coach.app.crm.tip', placement: 'center' },
  ],
  ads: [
    { key: 'coach.app.ads.intro', anchor: 'app-ads', placement: 'bottom' },
    { key: 'coach.app.ads.tip', placement: 'center' },
  ],
  'lead-machine': [
    { key: 'coach.app.leadMachine.intro', anchor: 'app-lead-machine', placement: 'bottom' },
    { key: 'coach.app.leadMachine.tip', placement: 'center' },
  ],
  inventory: [
    { key: 'coach.app.inventory.intro', anchor: 'app-inventory', placement: 'bottom' },
    { key: 'coach.app.inventory.tip', placement: 'center' },
  ],
  finance: [
    { key: 'coach.app.finance.intro', anchor: 'app-finance', placement: 'bottom' },
    { key: 'coach.app.finance.tip', placement: 'center' },
  ],
  'ai-manager': [
    { key: 'coach.app.studio.intro', anchor: 'app-ai-manager', placement: 'bottom' },
    { key: 'coach.app.studio.tip', placement: 'center' },
  ],
  analytics: [
    { key: 'coach.app.analytics.intro', anchor: 'app-analytics', placement: 'bottom' },
    { key: 'coach.app.analytics.tip', placement: 'center' },
  ],
  notebook: [
    { key: 'coach.app.notebook.intro', anchor: 'app-notebook', placement: 'bottom' },
    { key: 'coach.app.notebook.tip', placement: 'center' },
  ],
  integrations: [
    { key: 'coach.app.integrations.intro', anchor: 'app-integrations', placement: 'bottom' },
    { key: 'coach.app.integrations.tip', placement: 'center' },
  ],
  settings: [
    { key: 'coach.app.settings.intro', anchor: 'app-settings', placement: 'bottom' },
    { key: 'coach.app.settings.tip', placement: 'center' },
  ],
  management: [
    { key: 'coach.app.management.intro', anchor: 'app-management', placement: 'bottom' },
    { key: 'coach.app.management.tip', placement: 'center' },
  ],
}

// Some routes share an app's tour (e.g. the live ads dashboard is part of Ads).
const PATH_ALIAS: Record<string, string> = {
  'ads-live': 'ads',
}

/** Resolve the app id whose tour applies to a pathname, or null. */
export function appIdForPath(pathname: string): string | null {
  const m = pathname.match(/^\/freehold-intelligence\/([^/?#]+)/)
  if (!m) return null
  const id = PATH_ALIAS[m[1]] ?? m[1]
  return APP_TOURS[id] ? id : null
}

export function tourForApp(appId: string | null): CoachStep[] {
  return appId ? (APP_TOURS[appId] ?? []) : []
}

/** Storage key that records a role's tour has been seen at this version. */
export function coachSeenKey(role: Role): string {
  return `fh_coach_seen_${role}_${COACH_VERSION}`
}

/** Storage key that records an app's contextual tour has been seen. */
export function appCoachSeenKey(appId: string): string {
  return `fh_coach_app_${appId}_${COACH_VERSION}`
}

export function tourForRole(role: Role | undefined): CoachStep[] {
  if (!role) return []
  return TOURS[role] ?? []
}
