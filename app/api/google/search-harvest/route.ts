/**
 * THE HARVEST — what the account learned from what people actually typed.
 *
 * GET  reads the search-terms report and returns two lists: phrases worth
 *      buying, and phrases worth blocking, each with the numbers behind it.
 *
 * POST applies them. And it does NOT treat the two symmetrically:
 *
 *      NEGATIVES apply without further argument. A negative only ever STOPS
 *      spend; the worst case is a query that might have converted later stops
 *      showing, which is bounded, visible and reversible in one click.
 *
 *      KEYWORDS need `addKeywords: true` in the body. A new keyword STARTS
 *      spend on a term whose future is a forecast, so a person says yes.
 *
 * A tool that automated both equally would not be braver, it would be spending
 * somebody else's money on a guess.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import {
  getReportSummary, listCampaigns, listNegativeKeywords, listKeywords,
  addNegativeKeywords, googleConfiguredAsync,
} from '@/lib/google/client'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { harvest, targetCplFrom, type SearchTerm, type HarvestContext } from '@/lib/google/search-harvest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/**
 * Assemble what the harvest needs to judge.
 *
 * THE TARGET CPL COMES FROM THE ACCOUNT'S OWN NUMBERS — real spend over real
 * conversions in the same window — and is refused on a small sample. Every
 * negative in this run is measured against it, so a target computed from two
 * leads would cut queries that were working.
 *
 * THE BRAND LIST IS THE COMPANY'S OWN INVENTORY: project names and developer
 * names it actually sells. Nothing containing one is ever blocked.
 */
async function context(range: '7d' | '30d' | '90d'): Promise<{
  terms: SearchTerm[]
  ctx: HarvestContext
  campaignId: string | null
}> {
  const [report, campaigns, props] = await Promise.all([
    getReportSummary(range),
    listCampaigns().catch(() => []),
    getInventoryPropertiesFromDB().catch(() => []),
  ])

  const terms: SearchTerm[] = report.searchTerms.map((s) => ({
    term: s.searchTerm,
    status: s.status,
    impressions: s.impressions,
    clicks: s.clicks,
    costAed: s.costMicros / 1_000_000,
    conversions: s.conversions,
    adGroupName: s.adGroupName,
  }))

  // The biggest-spending Search campaign carries the negatives. Campaign
  // level, not ad group: a query that wastes money in one group wastes it in
  // every other group of the same campaign.
  const search = campaigns
    .filter((c) => c.type === 'SEARCH')
    .sort((a, b) => (b.metrics?.costMicros ?? 0) - (a.metrics?.costMicros ?? 0))
  const campaignId = search[0]?.id ?? null

  const brandTerms = props.flatMap((p) => [p.name, p.developer].filter(Boolean) as string[])

  // Already-known phrases, so nothing is re-proposed. Read from the live
  // account rather than from our own record of what we intended to add.
  const [negs, kws] = await Promise.all([
    listNegativeKeywords().catch(() => []),
    listKeywords().catch(() => []),
  ])
  const known = [...negs.map((n) => n.text), ...kws.map((k) => k.text)]

  return {
    terms,
    campaignId,
    ctx: {
      targetCplAed: targetCplFrom(report.totalCostMicros / 1_000_000, report.totalConversions),
      brandTerms,
      known,
    },
  }
}

const rangeOf = (v: string | null): '7d' | '30d' | '90d' =>
  v === '7d' || v === '90d' ? v : '30d'

export async function GET(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  if (!(await googleConfiguredAsync())) {
    return NextResponse.json({ error: 'Connect Google Ads first.', type: 'config' }, { status: 400 })
  }

  const range = rangeOf(req.nextUrl.searchParams.get('range'))
  try {
    const { terms, ctx } = await context(range)
    const h = harvest(terms, ctx)
    return NextResponse.json({
      ...h,
      range,
      // Said plainly rather than left to be inferred from an empty list: with
      // no target CPL nothing can be called too expensive, and the honest
      // answer is that the account needs conversions before it can be judged.
      targetCplAed: ctx.targetCplAed,
      termsRead: terms.length,
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

  const body = (await req.json().catch(() => ({}))) as { range?: string; addKeywords?: boolean }
  const range = rangeOf(body.range ?? null)

  try {
    const { terms, ctx, campaignId } = await context(range)
    const h = harvest(terms, ctx)

    if (!campaignId) {
      return NextResponse.json({ error: 'No Search campaign to attach negatives to.' }, { status: 409 })
    }

    // Negatives: applied. They only ever stop spend.
    const negativesAdded = h.negatives.length > 0
      ? await addNegativeKeywords(campaignId, h.negatives.map((n) => ({ text: n.term, matchType: 'PHRASE' })))
      : 0

    // Keywords: proposed unless a person said yes. Reported either way, so the
    // screen can show what is waiting rather than quietly holding it.
    const keywordsPending = body.addKeywords === true ? 0 : h.adds.length

    return NextResponse.json({
      negativesAdded,
      wasteStoppedAed: h.wasteFoundAed,
      keywordsPending,
      // The adds themselves are NOT applied here. Attaching a keyword needs an
      // ad group chosen deliberately — dropping proven queries into whichever
      // group happened to serve them is how a tidy account becomes a mess.
      adds: h.adds,
      note: body.addKeywords === true
        ? 'Keywords are proposed with their ad group on the plan screen; negatives are applied.'
        : undefined,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Google rejected the change' },
      { status: 502 },
    )
  }
}
