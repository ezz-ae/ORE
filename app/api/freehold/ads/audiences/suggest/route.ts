import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { recommendTargeting } from '@/lib/freehold/targeting-recommend'
import { listAudiences, normalizeSpec, type SavedAudience } from '@/lib/freehold/audiences'
import {
  isMetaConfigured, searchInterests, searchBehaviors, getReachEstimate,
  type VocabularyEntry, type ReachEstimate,
} from '@/lib/meta/client'
import type { CampaignTargeting, TargetingEntity } from '@/lib/meta/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Suggestion {
  name: string
  description: string
  kind: 'saved' | 'composed'
  audienceId?: string
  spec: CampaignTargeting
  reach: ReachEstimate | null
}

const toEntity = (e: VocabularyEntry): TargetingEntity => ({ id: e.id, name: e.name })
const pick = (entries: VocabularyEntry[], ...needles: string[]): TargetingEntity[] => {
  const out: TargetingEntity[] = []
  for (const n of needles) {
    const hit = entries.find(
      (e) => e.name.toLowerCase().includes(n.toLowerCase()) && !out.some((o) => o.id === e.id),
    )
    if (hit) out.push(toEntity(hit))
  }
  return out
}

// POST {listing?: {name, area, price, type}} — ranked best-match audiences for
// this listing: saved audiences first (lookalikes lead), then compositions
// built ONLY from Meta's live vocabulary (real segment ids, real reach bands).
// Not connected ⇒ saved audiences only, honestly labelled.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  let body: Record<string, unknown> = {}
  try { body = (await req.json()) as Record<string, unknown> } catch { /* optional */ }
  const listingRaw = (body.listing && typeof body.listing === 'object' ? body.listing : null) as
    | { name?: unknown; area?: unknown; price?: unknown; type?: unknown }
    | null
  const listing = listingRaw
    ? {
        name: String(listingRaw.name ?? '').slice(0, 120),
        area: String(listingRaw.area ?? '').slice(0, 80),
        price: Number(listingRaw.price) || 0,
        type: String(listingRaw.type ?? '').slice(0, 40),
      }
    : null

  // The learning loop's recommendation — grounded in OUR lead outcomes and the
  // cross-tenant benchmark signals (with its own honest offline fallback).
  const recommendation = await recommendTargeting(
    listing ? { name: listing.name, area: listing.area, price: listing.price, type: listing.type } : null,
    `audience-suggest:${auth.user.email}`,
  )

  const [saved, connected] = await Promise.all([listAudiences(), isMetaConfigured()])
  const suggestions: Suggestion[] = []

  // 1 — Saved audiences, lookalikes first: a lookalike seeded from real leads
  // beats any interest guesswork.
  const rankedSaved: SavedAudience[] = [...saved].sort((a, b) => {
    const w = (x: SavedAudience) => (x.kind === 'lookalike' ? 0 : x.kind === 'narrow' ? 1 : 2)
    return w(a) - w(b)
  })
  for (const a of rankedSaved.slice(0, 4)) {
    suggestions.push({
      name: a.name,
      description: a.description || (a.kind === 'lookalike'
        ? `Lookalike seeded from ${a.uploadedCount.toLocaleString()} real contacts.`
        : 'Saved audience definition.'),
      kind: 'saved',
      audienceId: a.id,
      spec: a.spec,
      reach: connected ? await getReachEstimate(a.spec) : null,
    })
  }

  // 2 — Compositions from Meta's LIVE vocabulary. Every entity below comes
  // from the search response — nothing hardcoded, nothing invented; a slot
  // that finds no real segments is dropped.
  if (connected && listing) {
    try {
      const [invest, behaviors] = await Promise.all([
        searchInterests('property investment'),
        searchBehaviors('travel'),
      ])
      const [luxury, expat] = await Promise.all([
        searchInterests('luxury real estate'),
        searchBehaviors('expat'),
      ])

      const investInterests = [...pick(invest, 'property investment', 'real estate investing', 'investment'), ...pick(luxury, 'luxury real estate', 'luxury goods')]
      const travelBehaviors = pick(behaviors, 'frequent international travelers', 'frequent travelers')
      const expatBehaviors = pick(expat, 'expats (all)', 'expats')
      const agentExclusion = pick(invest, 'real estate agent', 'estate agent')

      const premium = listing.price >= 2_000_000

      if (investInterests.length && (travelBehaviors.length || expatBehaviors.length)) {
        const spec = normalizeSpec({
          countries: ['AE', 'SA', 'QA', 'KW', 'GB'],
          ageMin: premium ? 30 : 25,
          ageMax: 60,
          interests: investInterests,
          behaviors: expatBehaviors,
          narrowing: travelBehaviors.length ? [{ behaviors: travelBehaviors }] : [],
          exclusions: agentExclusion.length ? { interests: agentExclusion } : undefined,
        } satisfies Partial<CampaignTargeting>)
        suggestions.push({
          name: `${listing.area || 'Dubai'} — International investors (narrow)`,
          description: `Property-investment intent AND frequent-traveller behavior${agentExclusion.length ? ', real-estate agents excluded' : ''} — built from Meta's live vocabulary for ${listing.name || 'this listing'}.`,
          kind: 'composed',
          spec,
          reach: await getReachEstimate(spec),
        })
      }

      if (expatBehaviors.length) {
        const endUserInterests = pick(invest, 'first-time buyer', 'apartments', 'condominium', 'real estate')
        const spec = normalizeSpec({
          countries: ['AE'],
          ageMin: 25,
          ageMax: 50,
          interests: endUserInterests,
          behaviors: expatBehaviors,
          exclusions: agentExclusion.length ? { interests: agentExclusion } : undefined,
        } satisfies Partial<CampaignTargeting>)
        suggestions.push({
          name: `UAE residents — end-user buyers (${listing.type || 'apartments'})`,
          description: 'UAE-based expat residents with real-estate intent — the end-user/upgrader pool for ready and near-handover units.',
          kind: 'composed',
          spec,
          reach: await getReachEstimate(spec),
        })
      }
    } catch (error) {
      console.error('[audiences/suggest] vocabulary composition failed', error)
    }
  }

  return NextResponse.json({
    connected,
    recommendation,
    suggestions,
    note: !connected
      ? 'Meta is not connected — showing saved audiences only. Connect Meta Ads under Integrations to compose live behavioral audiences with real reach numbers.'
      : suggestions.length === 0
        ? 'No saved audiences yet and no composition matched — create one in the builder below.'
        : null,
  })
}
