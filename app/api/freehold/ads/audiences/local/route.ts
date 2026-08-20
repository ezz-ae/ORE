/**
 * BUILD THE THREE LOCAL AUDIENCES.
 *
 * GET  — resolve, measure and report. Stores nothing.
 * POST — the same, and saves the ones that came in under the reach ceiling.
 *
 * The split is deliberate. An audience that appeared in somebody's list without
 * them pressing anything is an audience nobody feels responsible for, and this
 * product already has three of those carrying a gate that reached the whole
 * market. Look first, then choose.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MGMT_ROLES } from '@/lib/freehold/apps'
import { buildLocalAudiences } from '@/lib/freehold/local-audiences-db'
import {
  LOCAL_AUDIENCES, PROPERTY_SIGNALS, REACH_CEILING, REACH_FLOOR,
} from '@/lib/freehold/local-audiences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * The audience's stored NAME.
 *
 * English and not translated, on purpose: it is an identifier that will be read
 * back months later next to a campaign, and a name that changes with the
 * reader's language setting cannot be matched against anything.
 */
const NAMES: Record<string, string> = {
  localArabic:  'UAE residents · Arabic · property',
  localEnglish: 'UAE residents · English · property',
  localRussian: 'UAE residents · Russian · property',
}

async function run(req: NextRequest, dryRun: boolean) {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res

  // Signals the operator added deliberately — a developer's name, say, which
  // is left out of the default set on purpose. Forbidden segments are dropped
  // by the resolver whatever is passed in.
  let extra: string[] = []
  if (!dryRun) {
    const body = await req.json().catch(() => ({})) as { extraSignals?: unknown }
    if (Array.isArray(body.extraSignals)) {
      extra = body.extraSignals.map(String).filter(Boolean).slice(0, 6)
    }
  }

  try {
    const out = await buildLocalAudiences({
      createdBy: auth.user.email,
      dryRun,
      extraSignals: extra,
      nameFor: (key) => NAMES[key] ?? key,
    })
    return NextResponse.json({
      ...out,
      // Published so the screen can say what the thresholds ARE rather than
      // just that something failed one.
      ceiling: REACH_CEILING,
      floor: REACH_FLOOR,
      signals: PROPERTY_SIGNALS,
      count: LOCAL_AUDIENCES.length,
    })
  } catch (e) {
    return NextResponse.json(
      { connected: true, error: e instanceof Error ? e.message : 'Could not build the audiences' },
      { status: 502 },
    )
  }
}

export const GET = (req: NextRequest) => run(req, true)
export const POST = (req: NextRequest) => run(req, false)
