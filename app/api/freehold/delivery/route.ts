/**
 * THE DELIVERY PROMISE, OVER HTTP.
 *
 * "Nothing is invoiced until fifty good leads have landed" is a commercial
 * obligation, and this route is the one place both sides can read the same
 * number for it. Every bar is returned, always — see
 * lib/freehold/delivery-commitment.ts for why showing one would be worse than
 * showing three.
 *
 * The TARGET and the BAR come from the query string rather than a setting,
 * because they are terms of a deal rather than a preference: a screen that
 * remembered them would let one side change what was agreed and leave no trace
 * of the change. The URL carries them, so the number and the terms it was
 * computed under travel together and can be pasted into an email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCampaigns, getAccountCampaignInsights, isMetaConfigured } from '@/lib/meta/client'
import { readCommitment } from '@/lib/freehold/delivery-commitment-db'
import { DELIVERY_BARS, RECOMMENDED_BAR, type DeliveryBar } from '@/lib/freehold/delivery-commitment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Most campaigns to read.
 *
 * One CRM query each, so this is a real cost. Twelve covers any account this
 * product builds for; past that the response reports the cap rather than
 * describing a subset as though it were everything.
 */
const MAX_CAMPAIGNS = 12

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const p = req.nextUrl.searchParams
  const target = Math.min(1000, Math.max(1, Number(p.get('target')) || 50))
  const asked = String(p.get('bar') ?? '')
  const bar: DeliveryBar = (DELIVERY_BARS as readonly string[]).includes(asked)
    ? (asked as DeliveryBar)
    : RECOMMENDED_BAR

  if (!(await isMetaConfigured())) {
    return NextResponse.json({ connected: false, target, bar })
  }

  try {
    const all = await listCampaigns()
    const insights = await getAccountCampaignInsights()
    const only = (p.get('campaignId') ?? '').trim()
    const chosen = (only ? all.filter((c) => c.id === only) : all).slice(0, MAX_CAMPAIGNS)
    const capped = Math.max(0, (only ? 1 : all.length) - chosen.length)

    const rows = await Promise.all(chosen.map(async (c) => {
      const row = insights.get(c.id)
      // A MISSING INSIGHTS ROW IS NOT ZERO SPEND — the same rule the money card
      // follows. Reported so the forecast can withhold itself rather than
      // divide by a number nobody gave us.
      const spendKnown = row?.spend != null && row.spend !== ''
      const read = await readCommitment({
        campaignId: c.id,
        campaignName: c.name ?? '',
        target,
        spentAed: spendKnown ? Number(row?.spend) || 0 : 0,
        bar,
      })
      return { ...read, spendKnown, status: c.status ?? null, effectiveStatus: (c as { effective_status?: string }).effective_status ?? null }
    }))

    // THE PROMISE IS ABOUT THE ACCOUNT, not about one campaign. A client owed
    // fifty leads does not care which buy they came from, so the totals are
    // summed across every campaign and the per-campaign rows say where they
    // came from.
    const totals = (DELIVERY_BARS).map((b) => {
      const met = rows.reduce((n, r) => n + (r.bars.find((x) => x.bar === b)?.met ?? 0), 0)
      return { bar: b, met, remaining: Math.max(0, target - met), fraction: Math.min(1, met / target), done: met >= target }
    })

    return NextResponse.json({
      connected: true,
      target,
      bar,
      recommendedBar: RECOMMENDED_BAR,
      totals,
      rows,
      unrated: rows.reduce((n, r) => n + r.unrated, 0),
      leadsBought: rows.reduce((n, r) => n + r.leadsBought, 0),
      capped,
    })
  } catch (e) {
    return NextResponse.json(
      { connected: true, error: e instanceof Error ? e.message : 'Could not read the promise' },
      { status: 502 },
    )
  }
}
