/**
 * THE WARM AUDIENCES THAT BUILD THEMSELVES.
 *
 * Retargeting has been half of this product's audience doctrine from the
 * start: `warmArms` knows the rungs (visited, engaged, started_form), knows
 * their weights, and `selectWarmArms` refuses to launch a rung before it has
 * enough people. What never existed was the PRODUCER — the actual Meta
 * custom audiences those rungs describe. The advisor recommended retargeting
 * in prose while no audience existed to retarget.
 *
 * This module is the producer. Three rule audiences, created once and then
 * filled by Meta continuously from behaviour:
 *
 *   visited       — pixel PageView, last 30 days. A property site visit is a
 *                   fresh signal; at 90 days it is nostalgia.
 *   engaged       — anyone who engaged the Facebook Page or its ads, last
 *                   365 days. Wide and shallow, priced accordingly by its
 *                   rung weight.
 *   started_form  — opened a lead form without submitting, last 90 days.
 *                   The warmest people money can reach: they read the ad,
 *                   tapped it, saw the questions, and stopped one field
 *                   short. `RETARGET_WEIGHT` already prices this rung above
 *                   every cold level.
 *
 * WHY CREATION IS IDEMPOTENT BY NAME: Meta holds the audience; we hold
 * nothing but the convention. Re-running ensure() finds the three names and
 * creates only what is missing, so a wiped local database cannot duplicate
 * them and a deleted audience heals on the next ensure.
 *
 * The sizes come back from Meta's own approximate counts, and the readiness
 * verdict comes from `selectWarmArms` — the same floor that has always
 * guarded the launch. Nothing here invents a number.
 */
import {
  listCustomAudiences, createRuleAudience, getConfiguredPixelId, getAdIdentity,
  type CustomAudienceSummary,
} from '@/lib/meta/client'
import { selectWarmArms, type RetargetRung } from '@/lib/freehold/level-arms'

export interface WarmAudienceDef {
  rung: RetargetRung
  /** The Meta audience name — the identity key, never renamed casually. */
  name: string
  /** Sentence for the audience description field on Meta. */
  description: string
  days: number
  needs: 'pixel' | 'page'
}

export const WARM_AUDIENCES: WarmAudienceDef[] = [
  {
    rung: 'visited',
    name: 'FH Warm — Site visitors 30d',
    description: 'Visited the website in the last 30 days (pixel PageView). Auto-built by Freehold Intelligence.',
    days: 30,
    needs: 'pixel',
  },
  {
    rung: 'engaged',
    name: 'FH Warm — Page engagers 365d',
    description: 'Engaged with the Facebook Page or its ads in the last 365 days. Auto-built by Freehold Intelligence.',
    days: 365,
    needs: 'page',
  },
  {
    rung: 'started_form',
    name: 'FH Warm — Form openers 90d',
    description: 'Opened an instant form without submitting, last 90 days. Auto-built by Freehold Intelligence.',
    days: 90,
    needs: 'page',
  },
]

const DAY = 86_400

/** Meta's rule vocabulary for each rung. Validated by Meta at creation — a
 *  refused rule surfaces as its error, never as a silently empty audience. */
function ruleFor(def: WarmAudienceDef, sourceId: string): { subtype: 'WEBSITE' | 'ENGAGEMENT'; rule: Record<string, unknown> } {
  if (def.rung === 'visited') {
    return {
      subtype: 'WEBSITE',
      rule: {
        inclusions: {
          operator: 'or',
          rules: [{
            event_sources: [{ id: sourceId, type: 'pixel' }],
            retention_seconds: def.days * DAY,
            filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'PageView' }] },
          }],
        },
      },
    }
  }
  const event = def.rung === 'started_form' ? 'lead_generation_opened' : 'page_engaged'
  return {
    subtype: 'ENGAGEMENT',
    rule: {
      inclusions: {
        operator: 'or',
        rules: [{
          event_sources: [{ id: sourceId, type: 'page' }],
          retention_seconds: def.days * DAY,
          filter: { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: event }] },
        }],
      },
    },
  }
}

export interface WarmStatus {
  rung: RetargetRung
  name: string
  audienceId: string | null
  /** Meta's approximate count midpoint; null while Meta is still filling. */
  size: number | null
  /** Missing prerequisite, when one blocks creation. */
  blocked: 'pixel' | 'page' | null
}

const mid = (a: CustomAudienceSummary): number | null =>
  a.approxLower !== null || a.approxUpper !== null
    ? Math.round(((a.approxLower ?? a.approxUpper ?? 0) + (a.approxUpper ?? a.approxLower ?? 0)) / 2)
    : null

/**
 * Create whatever is missing, then report every rung with its live size and
 * the launch verdict from the SAME floor the arm planner enforces.
 */
export async function ensureWarmAudiences(): Promise<{
  statuses: WarmStatus[]
  created: string[]
  /** selectWarmArms' own reading of the rungs that have audiences. */
  readiness: ReturnType<typeof selectWarmArms>
  errors: string[]
}> {
  const [existing, pixelId, identity] = await Promise.all([
    listCustomAudiences().catch(() => [] as CustomAudienceSummary[]),
    getConfiguredPixelId().catch(() => null),
    getAdIdentity().catch(() => null),
  ])
  const pageId = identity?.pageId ?? null
  const byName = new Map(existing.map((a) => [a.name, a]))

  const statuses: WarmStatus[] = []
  const created: string[] = []
  const errors: string[] = []

  for (const def of WARM_AUDIENCES) {
    const sourceId = def.needs === 'pixel' ? pixelId : pageId
    let found = byName.get(def.name) ?? null
    if (!found) {
      if (!sourceId) {
        statuses.push({ rung: def.rung, name: def.name, audienceId: null, size: null, blocked: def.needs })
        continue
      }
      try {
        const { subtype, rule } = ruleFor(def, sourceId)
        const made = await createRuleAudience(def.name, def.description, subtype, rule)
        created.push(def.name)
        found = { id: made.id, name: def.name, subtype, approxLower: null, approxUpper: null, timeUpdated: null }
      } catch (e) {
        errors.push(`${def.name}: ${e instanceof Error ? e.message : 'creation failed'}`)
        statuses.push({ rung: def.rung, name: def.name, audienceId: null, size: null, blocked: null })
        continue
      }
    }
    statuses.push({ rung: def.rung, name: def.name, audienceId: found.id, size: mid(found), blocked: null })
  }

  const readiness = selectWarmArms(
    statuses
      .filter((s) => s.audienceId)
      .map((s) => ({ rung: s.rung, size: s.size ?? 0 })),
  )
  return { statuses, created, readiness, errors }
}
