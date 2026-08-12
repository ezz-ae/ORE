/**
 * THE HARVEST — what the account learned from what people actually typed.
 *
 * GET  reads the search-terms report and returns two lists: phrases worth
 *      buying, and phrases worth blocking, each with the numbers behind it.
 *
 * POST applies the blocking half.
 *
 * THE TWO ARE NOT TREATED SYMMETRICALLY, on purpose:
 *
 *   NEGATIVES apply. A negative only ever STOPS spend; the worst case is a
 *   query that might have converted later stops showing, which is bounded,
 *   visible and reversible in one click. The machine cycle applies these
 *   unattended for exactly that reason.
 *
 *   KEYWORDS are proposed and wait for a person. A new keyword STARTS spend on
 *   a term whose future is a forecast rather than a measurement, and it needs
 *   an ad group chosen deliberately — dropping proven queries into whichever
 *   group happened to serve them is how a tidy account becomes a mess.
 *
 * A tool that automated both equally would not be braver, it would be spending
 * somebody else's money on a guess.
 *
 * The gathering and the apply both live in lib/google/harvest-run.ts, shared
 * with the machine cycle. Two copies would drift, and the drift would be
 * invisible: the button and the nightly run would start blocking different
 * things.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { googleConfiguredAsync } from '@/lib/google/client'
import { gatherHarvest, applyHarvestNegatives, asRange } from '@/lib/google/harvest-run'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  if (!(await googleConfiguredAsync())) {
    return NextResponse.json({ error: 'Connect Google Ads first.', type: 'config' }, { status: 400 })
  }

  const range = asRange(req.nextUrl.searchParams.get('range'))
  try {
    const run = await gatherHarvest(range)
    return NextResponse.json({
      ...run.result,
      range,
      // Said plainly rather than left to be inferred from an empty list: with
      // no target cost per lead nothing can be called too expensive, and the
      // honest answer is that the account needs conversions before it can be
      // judged at all.
      targetCplAed: run.ctx.targetCplAed,
      termsRead: run.termsRead,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Google would not return the search-terms report' },
      { status: 502 },
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  if (!(await googleConfiguredAsync())) {
    return NextResponse.json({ error: 'Connect Google Ads first.', type: 'config' }, { status: 400 })
  }

  const body = (await req.json().catch(() => ({}))) as { range?: string }

  try {
    const run = await gatherHarvest(asRange(body.range))
    if (!run.campaignId) {
      return NextResponse.json({ error: 'No Search campaign to attach negatives to.' }, { status: 409 })
    }
    const { blocked, wasteStoppedAed } = await applyHarvestNegatives(run)
    return NextResponse.json({
      negativesAdded: blocked,
      wasteStoppedAed,
      // Reported either way, so the screen shows what is waiting rather than
      // quietly holding it.
      keywordsPending: run.result.adds.length,
      adds: run.result.adds,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Google rejected the change' },
      { status: 502 },
    )
  }
}
