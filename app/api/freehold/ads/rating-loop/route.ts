/**
 * IS MY RATING DOING ANYTHING — answered from real counts, never from hope.
 *
 * GET  reports where the loop currently stops: how many leads a person judged,
 *      how many of those Meta was actually TOLD about (the sent column, not
 *      the count that earned an event), how many the audiences MATCHED (what
 *      Meta reported, not what we uploaded), and whether anything is attached
 *      to a live campaign.
 *
 * POST advances it — builds or refreshes both audiences and, once the seed is
 *      genuinely large enough, the lookalike.
 *
 * Every number here is counted, not estimated. A loop screen that guesses is
 * worse than no loop screen: it tells somebody their ten seconds a lead is
 * working when it is not.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { query } from '@/lib/db'
import { isMetaConfigured, listAdSets, listCampaigns } from '@/lib/meta/client'
import { VALUABLE_RATING } from '@/lib/freehold/lead-stages'
import { AVOID_RATING, loopStepsFor, loopHeadline, type RatingLoopFacts } from '@/lib/freehold/rating-loop'
import { ratingAudienceState, syncRatingAudiences } from '@/lib/freehold/rating-audiences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/** The rating counts, in one query. */
async function counts() {
  try {
    const rows = await query<{ total: number; rated: number; valuable: number; avoid: number; sent: number }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(value_rating)::int AS rated,
         COUNT(*) FILTER (WHERE value_rating >= $1)::int AS valuable,
         COUNT(*) FILTER (WHERE value_rating <= $2)::int AS avoid,
         COUNT(*) FILTER (WHERE 'qualified' = ANY(coalesce(meta_reported_stages, '{}')))::int AS sent
       FROM freehold_site_leads
       WHERE archived IS NOT TRUE`,
      [VALUABLE_RATING, AVOID_RATING],
    )
    const r = rows[0]
    return {
      total: Number(r?.total) || 0,
      rated: Number(r?.rated) || 0,
      valuable: Number(r?.valuable) || 0,
      avoid: Number(r?.avoid) || 0,
      sent: Number(r?.sent) || 0,
    }
  } catch {
    // meta_reported_stages is created lazily by the write-back. A database
    // without it has sent nothing, which is a true answer.
    return { total: 0, rated: 0, valuable: 0, avoid: 0, sent: 0 }
  }
}

/**
 * IS ANY OF IT ACTUALLY POINTED AT DELIVERY.
 *
 * The step where a "working" loop is most often idle: the audiences exist,
 * nothing references them, and no delivery changes. Read from the live ad
 * sets' own targeting rather than from our record of what we intended.
 */
async function attachedTo(audienceIds: string[]): Promise<boolean> {
  if (audienceIds.length === 0) return false
  try {
    const campaigns = await listCampaigns()
    const live = campaigns.filter((c) => String(c.status ?? '').toUpperCase() === 'ACTIVE').slice(0, 10)
    for (const c of live) {
      const adSets = await listAdSets(c.id).catch(() => [])
      for (const a of adSets) {
        const t = JSON.stringify((a as { targeting?: unknown }).targeting ?? {})
        if (audienceIds.some((id) => id && t.includes(id))) return true
      }
    }
  } catch { /* unreadable is not attached — never claimed as attached */ }
  return false
}

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const [c, metaConnected, audiences] = await Promise.all([
    counts(), isMetaConfigured(), ratingAudienceState(),
  ])

  const ids = [audiences.seed?.lookalikeId, audiences.avoid?.audienceId].filter(Boolean) as string[]
  const attached = metaConnected ? await attachedTo(ids) : false

  const facts: RatingLoopFacts = {
    ...c,
    seedMatched: audiences.seed?.matched ?? null,
    lookalikeExists: !!audiences.seed?.lookalikeId,
    suppressionMatched: audiences.avoid?.matched ?? null,
    attached,
    metaConnected,
  }
  const steps = loopStepsFor(facts)
  return NextResponse.json({ facts, steps, headline: loopHeadline(steps) })
}

export async function POST() {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const result = await syncRatingAudiences()
  if (!result) {
    return NextResponse.json({ error: 'Connect the Meta ad account first.' }, { status: 400 })
  }
  return NextResponse.json({
    seedMatched: result.seed?.matched ?? 0,
    suppressionMatched: result.avoid?.matched ?? 0,
    lookalikeCreated: result.lookalikeCreated,
  })
}
