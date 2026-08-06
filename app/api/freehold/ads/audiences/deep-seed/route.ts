/**
 * The DEEP seed: who this account should be looked-alike from, computed from
 * the funnel rather than chosen by hand.
 *
 * Distinct from `audiences/seed`, which uploads a contact list the caller
 * supplies. This one derives the cohort server-side from CRM outcomes, weights
 * every member by what they were actually worth, and derives a suppression
 * cohort at the same time — the three things that make a seed deeper rather
 * than merely bigger.
 *
 * GET  — the cohorts and their readiness. No Meta call, no spend.
 * POST — push to Meta. Consequential (hashed identifiers leave the server), so
 *        it needs an explicit confirm, and it REFUSES rather than degrades
 *        when the seed is too small. Building a lookalike Meta cannot make
 *        meaningful and returning an id for it is the exact failure this
 *        codebase keeps closing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { query } from '@/lib/db'
import { splitCohorts, seedReadiness, seedUpload, type SeedLead } from '@/lib/freehold/seed-cohort'
import {
  createCustomAudience, addWeightedBuyers, addHashedBuyers, createLookalikeAudience,
} from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

async function loadLeads(): Promise<SeedLead[]> {
  const base = `id, email, phone, status, blocked,
                value_rating AS "valueRating",
                behaviour_score AS "behaviourScore"`
  try {
    return await query<SeedLead>(
      `SELECT ${base}, deal_value_aed AS "dealValueAed"
         FROM freehold_site_leads WHERE archived IS NOT TRUE`,
    )
  } catch {
    // deal_value_aed is created lazily by the deals feature. Retry without it
    // rather than lose every lead — a seed with no deal weights is still a
    // seed, and returning [] here would read as "you have no buyers".
    try {
      return await query<SeedLead>(
        `SELECT ${base}, NULL::numeric AS "dealValueAed"
           FROM freehold_site_leads WHERE archived IS NOT TRUE`,
      )
    } catch { return [] }
  }
}

export async function GET() {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res

  const cohorts = splitCohorts(await loadLeads())
  const upload = seedUpload(cohorts.seed)
  return NextResponse.json({
    readiness: seedReadiness(upload.length),
    counts: {
      seed: cohorts.seed.length,
      matchable: upload.length,
      exclude: cohorts.exclude.length,
      neutral: cohorts.neutral.length,
    },
    // The top of each cohort so it can be argued with before anything is sent.
    // Identifiers are deliberately NOT returned: this screen decides who is in
    // the cohort, not who each person is.
    topSeed: cohorts.seed.slice(0, 20).map((l) => ({ id: l.id, quality: l.quality, weight: l.weight, reason: l.reason })),
    topExcluded: cohorts.exclude.slice(0, 20).map((l) => ({ id: l.id, reason: l.reason })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as {
    confirm?: boolean; label?: string; country?: string; ratio?: number; buildExclusion?: boolean
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'confirm must be true — this sends hashed customer identifiers to Meta' }, { status: 400 })
  }

  const label = String(body.label ?? 'Freehold').slice(0, 60)
  const country = String(body.country ?? 'AE').toUpperCase().slice(0, 2)
  const ratio = Math.min(0.2, Math.max(0.01, Number(body.ratio) || 0.01))

  const cohorts = splitCohorts(await loadLeads())
  const rows = seedUpload(cohorts.seed)
  const readiness = seedReadiness(rows.length)

  if (readiness.level === 'none' || readiness.level === 'below_meta_minimum') {
    return NextResponse.json({ error: readiness.message, readiness }, { status: 409 })
  }

  try {
    // is_value_based must be set AT CREATION — Meta cannot add it to an
    // existing audience, which is why the weighted seed needs its own.
    const source = await createCustomAudience(
      `${label} — Seed (weighted)`,
      'Seed built from this account’s own qualified and closed leads, weighted by deal value and funnel outcome. Identifiers hashed before leaving the server.',
      { valueBased: true },
    )
    const uploaded = await addWeightedBuyers(source.id, rows)
    const lookalike = await createLookalikeAudience({
      name: `${label} — Lookalike ${Math.round(ratio * 100)}% (${country})`,
      sourceAudienceId: source.id, country, ratio,
    })

    let exclusion: { id: string; uploaded: number } | null = null
    if (body.buildExclusion && cohorts.exclude.length > 0) {
      const ex = await createCustomAudience(
        `${label} — Suppression`,
        'Leads proven unusable: blocked, unreachable, or rated worst by the team.',
      )
      exclusion = {
        id: ex.id,
        uploaded: await addHashedBuyers(ex.id, cohorts.exclude.map((l) => ({ email: l.email, phone: l.phone }))),
      }
    }

    return NextResponse.json({
      ok: true, readiness,
      sourceAudienceId: source.id, uploaded,
      lookalikeAudienceId: lookalike.id, ratio, country,
      exclusion,
      // Said plainly because both are easy to assume and neither is true.
      note: 'Meta populates a lookalike over several hours — it is not usable immediately. The suppression audience must be attached as an exclusion on each ad set; nothing applies it automatically.',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Meta rejected the audience build' },
      { status: 502 },
    )
  }
}
