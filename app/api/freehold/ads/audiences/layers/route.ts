/**
 * Probe a targeting stack layer by layer, BEFORE it launches.
 *
 * Asks Meta for the audience size of the full stack, then again with each
 * layer removed, and reports which layers are actually narrowing anything.
 * Read-only and free: it spends nothing and changes nothing, which is exactly
 * why it belongs on a draft rather than on a post-mortem.
 *
 * The probes run in parallel and each one is independently fail-soft — one
 * unavailable estimate costs that layer's reading, never the whole audit.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getReachEstimate } from '@/lib/meta/client'
import { normalizeSpec } from '@/lib/freehold/audiences'
import {
  auditStack, assessLevelOrder, auditGroupBalance, levels,
  type LayerProbe, type OrderedLevel, type SizedEntity, type AudienceLevel,
} from '@/lib/freehold/layer-audit'
import type { CampaignTargeting } from '@/lib/meta/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Midpoint of Meta's estimate band. A band is not a number, and picking the
 *  lower bound would systematically understate every layer's power. */
const mid = (e: { lower: number; upper: number } | null): number =>
  e ? Math.round((e.lower + e.upper) / 2) : 0

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as {
    spec?: unknown
    /** Optional level assignment per layer id, from the schema (+1..+5/-1..-5). */
    levelsByLayerId?: Record<string, number>
  }
  const spec = normalizeSpec(body.spec)

  // The baseline: geo and age only. Everything the stack does is measured
  // against this, because it is the widest the account would ever run.
  const baseline: CampaignTargeting = {
    ...spec, interests: [], behaviors: [], narrowing: [],
    exclusions: undefined, customAudienceIds: [], locales: undefined, leadLanguages: undefined,
  }

  // One probe per layer: the full stack MINUS that layer.
  const probes: Array<{ meta: Omit<LayerProbe, 'reachWithout'>; spec: CampaignTargeting }> = []

  spec.interests.forEach((i) => probes.push({
    meta: { id: i.id, name: i.name, kind: 'interest' },
    spec: { ...spec, interests: spec.interests.filter((x) => x.id !== i.id) },
  }))
  ;(spec.behaviors ?? []).forEach((b) => probes.push({
    meta: { id: b.id, name: b.name, kind: 'behavior' },
    spec: { ...spec, behaviors: (spec.behaviors ?? []).filter((x) => x.id !== b.id) },
  }))
  ;(spec.narrowing ?? []).forEach((g, gi) => {
    const label = [...(g.interests ?? []), ...(g.behaviors ?? [])].map((e) => e.name).join(' / ') || `Narrowing ${gi + 1}`
    probes.push({
      meta: { id: `narrowing:${gi}`, name: label, kind: 'narrowing_group' },
      spec: { ...spec, narrowing: (spec.narrowing ?? []).filter((_, i) => i !== gi) },
    })
  })
  if (spec.exclusions && (spec.exclusions.interests?.length || spec.exclusions.behaviors?.length)) {
    const label = [...(spec.exclusions.interests ?? []), ...(spec.exclusions.behaviors ?? [])].map((e) => e.name).join(', ')
    probes.push({
      meta: { id: 'exclusions', name: label || 'Exclusions', kind: 'exclusion' },
      spec: { ...spec, exclusions: undefined },
    })
  }
  if (spec.leadLanguages?.length) {
    probes.push({
      meta: { id: 'language', name: spec.leadLanguages.join(', ').toUpperCase(), kind: 'language' },
      spec: { ...spec, leadLanguages: undefined, locales: undefined },
    })
  }

  try {
    const [fullEst, baseEst, ...layerEsts] = await Promise.all([
      getReachEstimate(spec).catch(() => null),
      getReachEstimate(baseline).catch(() => null),
      ...probes.map((p) => getReachEstimate(p.spec).catch(() => null)),
    ])

    const layers: LayerProbe[] = probes
      // A layer whose probe failed is DROPPED, not defaulted to zero — a zero
      // here would read as "removing it collapses the audience", the single
      // most misleading thing this endpoint could say.
      .map((p, i) => ({ ...p.meta, reachWithout: mid(layerEsts[i]) }))
      .filter((l) => l.reachWithout > 0)

    const audit = auditStack({ full: mid(fullEst), baseline: mid(baseEst), layers })

    // The level schema, when the caller has assigned levels. Unassigned layers
    // are passed through as null and skipped rather than guessed at.
    const assigned = body.levelsByLayerId ?? {}
    const ordered: OrderedLevel[] = probes.map((p, index) => {
      const raw = assigned[p.meta.id]
      const level = typeof raw === 'number' && raw >= -5 && raw <= 5 && raw !== 0 ? (raw as AudienceLevel) : null
      return { name: p.meta.name, level, index }
    })
    const order = assessLevelOrder(ordered)

    // Scale mismatch inside each OR group — the leak where a mass segment
    // swallows a narrow one. Sizes come from the caller (the vocabulary
    // picker already holds Meta's published bands); absent sizes mean the
    // group is reported as unmeasurable rather than as balanced.
    const sized = (es: Array<{ id: string; name: string; size?: number | null }>): SizedEntity[] =>
      es.map((e) => ({ id: e.id, name: e.name, size: typeof e.size === 'number' ? e.size : null }))
    const groups = auditGroupBalance([
      { label: 'base', entities: sized([...spec.interests, ...(spec.behaviors ?? [])] as never[]) },
      ...(spec.narrowing ?? []).map((g, i) => ({
        label: `narrowing ${i + 1}`,
        entities: sized([...(g.interests ?? []), ...(g.behaviors ?? [])] as never[]),
      })),
    ])

    return NextResponse.json({
      audit,
      order,
      groups,
      // The ordered read: what each level bought given everything before it.
      levels: levels(audit.baseline, layers.map((l) => ({ name: l.name, size: l.reachWithout }))),
      probed: probes.length,
      unavailable: probes.length - layers.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read audience estimates' },
      { status: 502 },
    )
  }
}
