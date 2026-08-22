/**
 * The pixel-event catalogue and the deterministic recommender behind the Pixel
 * tab's "Suggest what to track".
 *
 * Two honesty rules govern this file:
 *
 * 1. `firedByPlatform` is a statement of FACT about this codebase, not a wish.
 *    It is true only for events the platform's own landing pages genuinely
 *    emit today — PageView (app/lp/[slug]/_tracker.tsx injects the base code
 *    and fires it on every landing page) and Lead (trackConversion() on lead
 *    form submit, re-fired server-side through lib/meta/capi.ts with the same
 *    event_id so Meta dedups the pair). Everything else is marked false and
 *    labelled in the UI as "available in Meta; only counts once your pages
 *    send it". Adding an event here does not make it fire.
 *
 * 2. The recommender is a pure function of REAL account state (the live pixel
 *    list, the live custom-conversion list, the saved global pixel id, the
 *    server-side CAPI pixel id). It invents nothing, and every suggestion it
 *    returns carries an action that performs a real Graph / settings call.
 */

import { isQualifiedConversion, QUALIFIED_EVENT_NAME } from '@/lib/meta/qualified-goal'

// ─── Catalogue ────────────────────────────────────────────────────────────────

export interface PixelEventDef {
  /** Stable key used in the UI and in suggestion payloads. */
  key: string
  /** The event name as it appears in the pixel's event stream. */
  metaEvent: string
  /**
   * Meta's `custom_event_type` enum value for a custom conversion built on
   * this event. Note the enum is CONTENT_VIEW (Meta's spelling), even though
   * the browser event is fired as `ViewContent`; PageView has no enum member
   * of its own, so a conversion on it is typed OTHER.
   */
  customEventType: string
  labelKey: string
  descriptionKey: string
  /** True only when THIS platform's pages actually send the event today. */
  firedByPlatform: boolean
}

export const PIXEL_EVENT_CATALOGUE: PixelEventDef[] = [
  {
    key: 'pageView',
    metaEvent: 'PageView',
    customEventType: 'OTHER',
    labelKey: 'lm.pixel.ev.pageView.label',
    descriptionKey: 'lm.pixel.ev.pageView.desc',
    firedByPlatform: true,
  },
  {
    key: 'lead',
    metaEvent: 'Lead',
    customEventType: 'LEAD',
    labelKey: 'lm.pixel.ev.lead.label',
    descriptionKey: 'lm.pixel.ev.lead.desc',
    firedByPlatform: true,
  },
  {
    key: 'viewContent',
    metaEvent: 'ViewContent',
    customEventType: 'CONTENT_VIEW',
    labelKey: 'lm.pixel.ev.viewContent.label',
    descriptionKey: 'lm.pixel.ev.viewContent.desc',
    firedByPlatform: false,
  },
  {
    key: 'contact',
    metaEvent: 'Contact',
    customEventType: 'CONTACT',
    labelKey: 'lm.pixel.ev.contact.label',
    descriptionKey: 'lm.pixel.ev.contact.desc',
    firedByPlatform: false,
  },
  {
    key: 'schedule',
    metaEvent: 'Schedule',
    customEventType: 'SCHEDULE',
    labelKey: 'lm.pixel.ev.schedule.label',
    descriptionKey: 'lm.pixel.ev.schedule.desc',
    firedByPlatform: false,
  },
  {
    key: 'submitApplication',
    metaEvent: 'SubmitApplication',
    customEventType: 'SUBMIT_APPLICATION',
    labelKey: 'lm.pixel.ev.submitApplication.label',
    descriptionKey: 'lm.pixel.ev.submitApplication.desc',
    firedByPlatform: false,
  },
  {
    key: 'completeRegistration',
    metaEvent: 'CompleteRegistration',
    customEventType: 'COMPLETE_REGISTRATION',
    labelKey: 'lm.pixel.ev.completeRegistration.label',
    descriptionKey: 'lm.pixel.ev.completeRegistration.desc',
    firedByPlatform: false,
  },
  {
    key: 'search',
    metaEvent: 'Search',
    customEventType: 'SEARCH',
    labelKey: 'lm.pixel.ev.search.label',
    descriptionKey: 'lm.pixel.ev.search.desc',
    firedByPlatform: false,
  },
]

export const findPixelEvent = (key: string): PixelEventDef | undefined =>
  PIXEL_EVENT_CATALOGUE.find((e) => e.key === key)

// ─── Rule builders ────────────────────────────────────────────────────────────
// Graph wants `rule` as a JSON STRING, not a nested object.

/** Every hit of a standard event, e.g. {"and":[{"event":{"eq":"Lead"}}]}. */
export const standardEventRule = (metaEvent: string): string =>
  JSON.stringify({ and: [{ event: { eq: metaEvent } }] })

/** Any page whose URL contains a fragment, e.g. every /lp/ landing page. */
export const urlContainsRule = (fragment: string): string =>
  JSON.stringify({ and: [{ url: { i_contains: fragment } }] })

/** The URL fragment every platform-hosted landing page shares. */
export const LANDING_PAGE_URL_FRAGMENT = '/lp/'

// ─── Deterministic recommender ────────────────────────────────────────────────

export interface RecommenderPixel {
  id: string
  name: string
  lastFiredTime?: string | null
}

export interface RecommenderConversion {
  id: string
  name: string
  customEventType: string | null
  rule: string | null
  eventSourceId: string | null
  isArchived: boolean
}

export interface RecommenderInput {
  /** The account's real pixels, straight from Graph. */
  pixels: RecommenderPixel[]
  /** The pixel id saved as the global landing-page pixel ('' when unset). */
  globalPixelId: string
  /** The pixel the server-side Conversions API fires at, if configured. */
  capiPixelId: string | null
  /** The account's real custom conversions, straight from Graph. */
  conversions: RecommenderConversion[]
}

export type PixelSuggestionAction =
  | { type: 'create-pixel' }
  | { type: 'deploy'; pixelId: string }
  | { type: 'create-conversion'; pixelId: string; customEventType: string; rule: string }

export interface PixelSuggestion {
  key: string
  severity: 'critical' | 'recommended' | 'improvement'
  titleKey: string
  bodyKey: string
  actionLabelKey: string
  /** i18n key for the name to give the object the action creates. */
  nameKey: string
  action: PixelSuggestionAction
}

/** Most recently fired first; a pixel that never fired sorts last. */
function byRecency(a: RecommenderPixel, b: RecommenderPixel): number {
  const ta = a.lastFiredTime ? Date.parse(a.lastFiredTime) : 0
  const tb = b.lastFiredTime ? Date.parse(b.lastFiredTime) : 0
  return tb - ta
}

const liveConversions = (cs: RecommenderConversion[]) => cs.filter((c) => !c.isArchived)

/**
 * Recommendations derived ENTIRELY from the state passed in. No model call, no
 * invented numbers — each branch is a fact about the account plus the fixed
 * fact that this platform's pages fire PageView and Lead.
 */
export function recommendPixelActions(input: RecommenderInput): PixelSuggestion[] {
  const out: PixelSuggestion[] = []
  const pixels = [...input.pixels].sort(byRecency)
  const live = liveConversions(input.conversions)

  // 1. Nothing to track with at all.
  if (pixels.length === 0) {
    out.push({
      key: 'create-pixel',
      severity: 'critical',
      titleKey: 'lm.pixel.sug.createPixel.title',
      bodyKey: 'lm.pixel.sug.createPixel.body',
      actionLabelKey: 'lm.pixel.sug.createPixel.action',
      nameKey: 'lm.pixel.sug.createPixel.name',
      action: { type: 'create-pixel' },
    })
    // Every later suggestion needs a pixel to attach to.
    return out
  }

  const deployed = pixels.find((p) => p.id === input.globalPixelId) ?? null

  // 2. Pixels exist, but the landing pages carry none of them (or carry an id
  //    that isn't on this ad account).
  if (!deployed) {
    out.push({
      key: 'deploy-pixel',
      severity: 'critical',
      titleKey: input.globalPixelId
        ? 'lm.pixel.sug.deployForeign.title'
        : 'lm.pixel.sug.deploy.title',
      bodyKey: input.globalPixelId
        ? 'lm.pixel.sug.deployForeign.body'
        : 'lm.pixel.sug.deploy.body',
      actionLabelKey: 'lm.pixel.sug.deploy.action',
      nameKey: 'lm.pixel.sug.deploy.name',
      action: { type: 'deploy', pixelId: pixels[0].id },
    })
  }

  // 3. Browser pixel and server (Conversions API) pixel are different objects —
  //    Meta then counts one lead twice and matches neither well. Aligning the
  //    landing pages onto the CAPI pixel is a real one-click fix.
  if (deployed && input.capiPixelId && input.capiPixelId !== deployed.id) {
    out.push({
      key: 'align-capi',
      severity: 'critical',
      titleKey: 'lm.pixel.sug.alignCapi.title',
      bodyKey: 'lm.pixel.sug.alignCapi.body',
      actionLabelKey: 'lm.pixel.sug.alignCapi.action',
      nameKey: 'lm.pixel.sug.alignCapi.name',
      action: { type: 'deploy', pixelId: input.capiPixelId },
    })
  }

  // The pixel later suggestions build on: the deployed one when there is one,
  // otherwise the one step 2 offers to deploy.
  const target = deployed ?? pixels[0]

  // 4. The pages already fire Lead, but nothing turns it into an optimizable
  //    conversion on this pixel.
  const hasLeadConversion = live.some(
    (c) => c.customEventType === 'LEAD' && (c.eventSourceId === null || c.eventSourceId === target.id),
  )
  if (!hasLeadConversion) {
    out.push({
      key: 'lead-conversion',
      severity: 'recommended',
      titleKey: 'lm.pixel.sug.leadConversion.title',
      bodyKey: 'lm.pixel.sug.leadConversion.body',
      actionLabelKey: 'lm.pixel.sug.leadConversion.action',
      nameKey: 'lm.pixel.sug.leadConversion.name',
      action: {
        type: 'create-conversion',
        pixelId: target.id,
        customEventType: 'LEAD',
        rule: standardEventRule('Lead'),
      },
    })
  }

  // 5. The CRM reports QualifiedLead through the Conversions API, and the
  //    launch gate (lib/meta/qualified-goal.ts) can point ad sets at it — but
  //    only at a conversion OBJECT, which it finds and deliberately never
  //    creates. This is the one place that offers to create it, and only when
  //    a CAPI pixel is configured: the event arrives server-side at THAT
  //    pixel, so a conversion built anywhere else would listen on a stream
  //    the event never reaches.
  const hasQualifiedConversion = live.some(isQualifiedConversion)
  if (input.capiPixelId && !hasQualifiedConversion) {
    out.push({
      key: 'qualified-conversion',
      severity: 'recommended',
      titleKey: 'lm.pixel.sug.qualifiedConversion.title',
      bodyKey: 'lm.pixel.sug.qualifiedConversion.body',
      actionLabelKey: 'lm.pixel.sug.qualifiedConversion.action',
      nameKey: 'lm.pixel.sug.qualifiedConversion.name',
      action: {
        type: 'create-conversion',
        pixelId: input.capiPixelId,
        // Meta's category enum for the conversion; the RULE is what selects
        // the custom event. LEAD is the honest category — it is a lead event,
        // just a later rung of one.
        customEventType: 'LEAD',
        rule: standardEventRule(QUALIFIED_EVENT_NAME),
      },
    })
  }

  // 6. No URL-scoped conversion exists, so landing-page traffic can't be
  //    measured or retargeted separately from the rest of the site.
  const hasLandingConversion = live.some(
    (c) => (c.rule ?? '').includes(LANDING_PAGE_URL_FRAGMENT),
  )
  if (!hasLandingConversion) {
    out.push({
      key: 'landing-conversion',
      severity: 'improvement',
      titleKey: 'lm.pixel.sug.landingConversion.title',
      bodyKey: 'lm.pixel.sug.landingConversion.body',
      actionLabelKey: 'lm.pixel.sug.landingConversion.action',
      nameKey: 'lm.pixel.sug.landingConversion.name',
      action: {
        type: 'create-conversion',
        pixelId: target.id,
        customEventType: 'OTHER',
        rule: urlContainsRule(LANDING_PAGE_URL_FRAGMENT),
      },
    })
  }

  return out
}
