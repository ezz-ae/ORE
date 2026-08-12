/**
 * THE KEYWORDS THIS ACCOUNT SHOULD BUY, FROM ITS OWN RECORDS.
 *
 * GET returns the plan: which projects the opportunity layer says are worth
 * Search budget this week, the ad groups each one earns, the landing page each
 * group sends its clicks to, and — as loudly as the plan itself — what could
 * NOT be planned and why.
 *
 * NOTHING IS SENT TO GOOGLE HERE. This route reads the company's own database
 * and returns a proposal. That separation is deliberate: a keyword is a real
 * bid with real money, and a plan that uploaded itself on a GET would spend
 * money because somebody opened a screen.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { readOpportunityScores } from '@/lib/freehold/opportunity'
import {
  planKeywords, selectProjectsToPlan, negativeKeywords, planKeywordCount,
  type PlanProject, type KeywordPlan,
} from '@/lib/google/keyword-plan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const READ_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/**
 * The site origin a landing URL is built on.
 *
 * Google REJECTS a relative final URL, and the inventory reader stores the
 * page as `/lp/<slug>` — so the prefix is not cosmetic, it is the difference
 * between an ad that uploads and one that does not. The fallback is the real
 * production host: a localhost final URL in a live campaign is a paid click
 * into nothing.
 */
function origin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (raw && /^https:\/\//.test(raw)) return raw.replace(/\/$/, '')
  return 'https://www.freeholdproperty.ae'
}

/**
 * Projects in the shape the planner needs.
 *
 * Read through getInventoryPropertiesFromDB rather than with SQL of its own.
 * That reader already resolves the two things this route would otherwise have
 * to re-derive and could get subtly wrong: whether a landing page is published
 * RIGHT NOW (there is a publish_from/publish_to window, so `status = published`
 * is not the same question), and the permit fields. A second copy of either
 * rule would eventually disagree with the first, and the disagreement would
 * show up as a live campaign pointed at an unpublished page.
 */
async function loadProjects(): Promise<PlanProject[]> {
  const base = origin()
  const props = await getInventoryPropertiesFromDB().catch(() => [])
  return props
    .filter((p) => !!p.landingUrl)
    .map((p): PlanProject => ({
      slug: p.slug,
      name: p.name,
      area: p.area?.trim() || null,
      developer: p.developer?.trim() || null,
      type: p.type,
      startingPriceAED: p.startingPriceAED,
      paymentPlan: p.paymentPlan?.trim() || null,
      handoverYear: p.handoverYear,
      landingUrl: `${base}${p.landingUrl}`,
      permitNumber: p.permitNumber ?? null,
      permitExpiry: p.permitExpiry ?? null,
    }))
}

export async function GET() {
  const auth = await requireSession(READ_ROLES)
  if ('res' in auth) return auth.res

  const projects = await loadProjects()
  if (projects.length === 0) {
    return NextResponse.json({
      plans: [], negatives: negativeKeywords(),
      skipped: { belowFloor: [], unscored: [] }, totals: { projects: 0, groups: 0, keywords: 0 },
    })
  }

  // The opportunity layer decides WHO gets bought for. Read, never recomputed
  // here: recomputing on a page load would put a heavy portfolio scan behind
  // somebody's click, and the scores are refreshed on their own schedule.
  const scores = await readOpportunityScores(projects.map((p) => p.slug)).catch(() => [])
  const byslug = new Map<string, number | null>(scores.map((s) => [s.projectSlug, s.score]))

  const { plan, belowFloor, unscored } = selectProjectsToPlan(projects, byslug)
  const plans: KeywordPlan[] = plan.map((p) => planKeywords(p))

  return NextResponse.json({
    plans,
    negatives: negativeKeywords(),
    // Reported, never silently dropped: a project the machine did not plan for
    // is a gap in the buy, and the two reasons have different answers —
    // "score it" and "it scored badly".
    skipped: { belowFloor, unscored },
    totals: {
      projects: plans.length,
      groups: plans.reduce((n, p) => n + p.groups.length, 0),
      keywords: plans.reduce((n, p) => n + planKeywordCount(p), 0),
    },
  })
}
