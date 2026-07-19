/**
 * Ads Machine — planner (stage 1: engine, no UI).
 *
 * buildMachinePlan turns "these projects + this hard daily cap" into a
 * persisted, launchable plan: 2–3 Meta audience trials per project — each from
 * a DISTINCT real source (the company's own buyer-match profile, an existing
 * saved audience/lookalike, and an Advantage+ broad baseline) — plus ONE
 * Google SEARCH draft payload per project (drafts only; the machine has no
 * autonomous Google spend authority).
 *
 * NOTHING-FAKE rules applied throughout:
 *  - a saved-audience trial exists only when a saved audience actually exists;
 *  - copy is generated from the listing's real fields (Gemini when available,
 *    deterministic template otherwise) — never invented facts;
 *  - the learning-loop recommendation is advisory only and fail-soft;
 *  - a cap that can't fund the minimum honest structure returns
 *    { viable: false, reason } instead of a pretend plan.
 *
 * The plan is DATA: it is persisted on the machine row (plan jsonb) before
 * anything launches, and the engine executes it verbatim.
 */
import { randomUUID } from 'node:crypto'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { getBuyerMatchProfile } from '@/lib/freehold/buyer-match'
import { listAudiences, type SavedAudience } from '@/lib/freehold/audiences'
import { recommendTargeting } from '@/lib/freehold/targeting-recommend'
import { buildVariants, geminiCreatives } from '@/lib/meta/creative-gen'
import type {
  CampaignCreative,
  CampaignTargeting,
  CreativeAngle,
  GenerateCreativePayload,
  GeneratedCreativeVariant,
} from '@/lib/meta/types'
import type { LaunchGoogleCampaignPayload } from '@/lib/google/types'

/** Meta's minimum viable daily ad-set budget — a trial below this can't run. */
export const META_MIN_TRIAL_BUDGET_AED = 50

export type TrialSource = 'buyer-match' | 'saved-audience' | 'lookalike' | 'advantage-broad'

export interface MachineTrialPlan {
  /** Stable id within the plan — the engine matches launched campaigns to it. */
  id: string
  /** Human-readable trial label; unique per project (one per source). */
  label: string
  source: TrialSource
  projectSlug: string
  campaignName: string
  listingName: string
  dailyBudgetAed: number
  targeting: CampaignTargeting
  creative: CampaignCreative
  /** Set only for saved-audience / lookalike trials — the REAL saved audience used. */
  savedAudienceId?: string
  savedAudienceName?: string
  /** Where the copy came from — never pretend template output was AI. */
  copySource: 'gemini' | 'template'
  /** Why this trial exists, grounded in the real inputs used to build it. */
  rationale: string
}

export interface MachineProjectPlan {
  slug: string
  listingName: string
  area: string
  landingUrl: string
  dailyBudgetAed: number
  trials: MachineTrialPlan[]
  /** ONE Google SEARCH draft per project — createLocalCampaign payload, PAUSED. */
  googleDraft: LaunchGoogleCampaignPayload
  /** Learning-loop targeting note — ADVISORY only, absent when unavailable. */
  advisory?: string
}

export type MachinePlan =
  | { viable: true; builtAt: string; dailyCapAed: number; projects: MachineProjectPlan[] }
  | { viable: false; reason: string }

const SITE_BASE = 'https://www.freeholdproperty.ae'

const ANGLE_FOR_SOURCE: Record<TrialSource, CreativeAngle> = {
  'buyer-match': 'investor',
  'saved-audience': 'yield',
  'lookalike': 'yield',
  'advantage-broad': 'end_user',
}

function variantToCreative(v: GeneratedCreativeVariant, landingUrl: string, imageUrl?: string | null): CampaignCreative {
  return {
    primaryText: v.primaryText,
    headline: v.headline.slice(0, 40),
    description: v.description.slice(0, 30),
    landingUrl,
    cta: v.cta,
    ...(imageUrl ? { imageUrl } : {}),
  }
}

/** Google RSA fields have hard length limits (headline 30, description 90).
 * Everything here is derived from real listing fields, then truncated. */
function buildGoogleDraft(params: {
  slug: string
  listingName: string
  area: string
  developer: string
  landingUrl: string
  dailyBudgetAed: number
  price: number | null
}): LaunchGoogleCampaignPayload {
  const h = (s: string) => s.trim().slice(0, 30)
  const d = (s: string) => s.trim().slice(0, 90)
  const priceText = params.price && params.price > 0
    ? (params.price >= 1_000_000 ? `AED ${(params.price / 1_000_000).toFixed(1).replace('.0', '')}M` : `AED ${Math.round(params.price / 1000)}K`)
    : null
  const headlines = [
    h(params.listingName),
    h(`${params.area} Property`),
    ...(priceText ? [h(`From ${priceText}`)] : []),
    ...(params.developer ? [h(`By ${params.developer}`)] : []),
    h('Freehold in Dubai'),
  ].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 8)
  const descriptions = [
    d(`${params.listingName} in ${params.area}, Dubai${priceText ? ` — from ${priceText}` : ''}. Request the full brochure and payment plan.`),
    d(`Freehold ownership in ${params.area}. Speak to an advisor about ${params.listingName} today.`),
  ]
  const kw = (text: string) => ({ text: text.toLowerCase(), matchType: 'PHRASE' as const })
  const keywords = [
    kw(params.listingName),
    kw(`${params.area} property for sale`),
    kw(`${params.area} apartments`),
    kw(`buy property ${params.area} dubai`),
  ].filter((k, i, a) => k.text.trim() && a.findIndex((x) => x.text === k.text) === i)
  return {
    listingId: params.slug,
    listingName: params.listingName,
    area: params.area,
    campaignName: `Ads Machine — ${params.listingName} — Google Search (draft)`,
    type: 'SEARCH',
    biddingStrategy: 'MAXIMIZE_CONVERSIONS',
    dailyBudgetAED: params.dailyBudgetAed,
    keywords,
    finalUrl: params.landingUrl,
    headlines,
    descriptions,
  }
}

/**
 * Build the full machine plan. Pure planning — persists nothing, launches
 * nothing; the caller stores the result on the machine row.
 */
export async function buildMachinePlan(
  projectSlugs: string[],
  dailyCapAed: number,
  opts?: { machineName?: string },
): Promise<MachinePlan> {
  const slugs = Array.from(new Set(projectSlugs.map((s) => String(s).trim()).filter(Boolean)))
  if (slugs.length === 0) {
    return { viable: false, reason: 'No projects selected — pick at least one project.' }
  }
  const cap = Math.floor(dailyCapAed)
  if (!Number.isFinite(cap) || cap <= 0) {
    return { viable: false, reason: 'The daily cap must be a positive amount in AED.' }
  }

  // Budget: equal split per project, then per trial, floor AED 50/day (Meta's
  // minimum). If even ONE trial per project at the floor doesn't fit, the
  // machine cannot honestly run — say so instead of planning a fiction.
  const perProject = Math.floor(cap / slugs.length)
  if (perProject < META_MIN_TRIAL_BUDGET_AED) {
    return {
      viable: false,
      reason: `A daily cap of AED ${cap} across ${slugs.length} project(s) leaves AED ${perProject}/project — below Meta's AED ${META_MIN_TRIAL_BUDGET_AED}/day minimum for even one trial each. Raise the cap or pick fewer projects.`,
    }
  }

  // Saved audiences are shared assets — use the freshest one when it exists;
  // NEVER invent one when the list is empty.
  let savedAudience: SavedAudience | null = null
  try {
    const audiences = await listAudiences()
    savedAudience = audiences.find((a) => a.kind === 'lookalike') ?? audiences[0] ?? null
  } catch { /* audiences unavailable → plan proceeds without that trial */ }

  const projects: MachineProjectPlan[] = []
  for (const slug of slugs) {
    const listing = await getInventoryPropertyBySlug(slug).catch(() => null)
    const listingName = listing?.name || slug
    const area = listing?.area || 'Dubai'
    const developer = listing?.developer || ''
    const price = listing?.startingPriceAED ?? null
    // Meta needs an absolute image URL; a relative hero path is served from
    // the public site. No hero → no imageUrl (never a placeholder image).
    const heroImage = listing?.heroImage
      ? (listing.heroImage.startsWith('http') ? listing.heroImage : `${SITE_BASE}${listing.heroImage}`)
      : null
    // Destination: the project's real landing page when it is published,
    // otherwise the always-real public project page.
    const landingUrl = listing?.landingUrl
      ? `${SITE_BASE}${listing.landingUrl}`
      : `${SITE_BASE}/projects/${slug}`

    // Buyer-match profile: real deals/leads in this listing's price band plus
    // a band-anchored age/interest recommendation (real Meta catalog ids).
    const buyerMatch = await getBuyerMatchProfile({ listingSlug: slug, price: price ?? undefined })
      .catch(() => null)

    // ── Trial candidates: 2–3 DISTINCT real sources ──
    type Candidate = { source: TrialSource; label: string; targeting: CampaignTargeting; rationale: string; savedAudienceId?: string; savedAudienceName?: string }
    const candidates: Candidate[] = []

    if (buyerMatch) {
      const rec = buyerMatch.recommendation
      candidates.push({
        source: 'buyer-match',
        label: 'Buyer Match',
        targeting: {
          countries: ['AE'],
          cityKeys: [],
          ageMin: rec.ageMin,
          ageMax: rec.ageMax,
          publisherPlatforms: ['facebook', 'instagram'],
          interests: rec.interestIds.map((id, i) => ({ id, name: rec.interestNames[i] ?? id })),
        },
        rationale: buyerMatch.buyers.hasData
          ? `${buyerMatch.band.label} band (${buyerMatch.buyers.deals} closed deals, ${buyerMatch.buyers.leads} leads in band): ages ${rec.ageMin}–${rec.ageMax}, interests ${rec.interestNames.join(', ') || 'none'}.`
          : `${buyerMatch.band.label} band recommendation (no deal/lead history in this band yet): ages ${rec.ageMin}–${rec.ageMax}, interests ${rec.interestNames.join(', ') || 'none'}.`,
      })
    }

    if (savedAudience) {
      candidates.push({
        source: savedAudience.kind === 'lookalike' ? 'lookalike' : 'saved-audience',
        label: savedAudience.kind === 'lookalike' ? 'Lookalike' : 'Saved Audience',
        targeting: savedAudience.metaLookalikeId
          ? {
              ...savedAudience.spec,
              customAudienceIds: Array.from(new Set([...(savedAudience.spec.customAudienceIds ?? []), savedAudience.metaLookalikeId])),
            }
          : savedAudience.spec,
        savedAudienceId: savedAudience.id,
        savedAudienceName: savedAudience.name,
        rationale: `Existing saved audience "${savedAudience.name}" (${savedAudience.kind})${savedAudience.uploadedCount ? `, seeded from ${savedAudience.uploadedCount} uploaded contacts` : ''}.`,
      })
    }

    candidates.push({
      source: 'advantage-broad',
      label: 'Advantage Broad',
      targeting: {
        countries: ['AE'],
        cityKeys: [],
        ageMin: 25,
        ageMax: 65,
        // Empty platform list = Advantage+ placements; no interests = Meta's
        // Advantage audience expands on our conversion signals.
        publisherPlatforms: [],
        interests: [],
      },
      rationale: 'Advantage+ baseline: broad delivery lets Meta’s algorithm hunt on our conversion signals — the control arm every trial set needs.',
    })

    // Fund as many distinct trials as the per-project share allows at the
    // AED 50 floor (perProject >= 50 was already guaranteed above).
    const fundable = Math.max(1, Math.floor(perProject / META_MIN_TRIAL_BUDGET_AED))
    const chosen = candidates.slice(0, Math.min(candidates.length, fundable))
    const perTrial = Math.floor(perProject / chosen.length)

    // ── Copy: one grounded generation per project (Gemini when live), the
    // deterministic template per angle otherwise. ──
    const basePayload: Omit<GenerateCreativePayload, 'angle'> = {
      listingId: slug,
      listingName,
      area,
      developer: developer || '—',
      startingPrice: price,
      paymentPlan: listing?.paymentPlan ?? null,
      tone: 'direct',
      cta: 'LEARN_MORE',
    }
    const aiVariants = await geminiCreatives({ ...basePayload, angle: 'investor' }).catch(() => null)

    const trials: MachineTrialPlan[] = chosen.map((c, i) => {
      let variant: GeneratedCreativeVariant
      let copySource: 'gemini' | 'template'
      if (aiVariants && aiVariants.length > 0) {
        variant = aiVariants[i % aiVariants.length]
        copySource = 'gemini'
      } else {
        const templ = buildVariants({ ...basePayload, angle: ANGLE_FOR_SOURCE[c.source] })
        variant = templ[i % templ.length]
        copySource = 'template'
      }
      return {
        id: `trial-${randomUUID()}`,
        label: c.label,
        source: c.source,
        projectSlug: slug,
        campaignName: `${opts?.machineName ? `${opts.machineName} — ` : 'Ads Machine — '}${listingName} — ${c.label}`,
        listingName,
        dailyBudgetAed: perTrial,
        targeting: c.targeting,
        creative: variantToCreative(variant, landingUrl, heroImage),
        ...(c.savedAudienceId ? { savedAudienceId: c.savedAudienceId, savedAudienceName: c.savedAudienceName } : {}),
        copySource,
        rationale: c.rationale,
      }
    })

    // Learning-loop targeting — strictly ADVISORY and fail-soft: a note for
    // the operator, never a mutation of the trials above. Bounded so plan
    // creation stays responsive when the AI backend is slow.
    let advisory: string | undefined
    try {
      const rec = await Promise.race([
        recommendTargeting({ name: listingName, area, price: price ?? undefined }, `ads-machine-plan-${slug}`),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ])
      if (rec) {
        advisory = `Learning loop suggests "${rec.recommendation.strategy}": ${rec.recommendation.rationale}`.slice(0, 600)
      }
    } catch { /* advisory only — absence is honest */ }

    projects.push({
      slug,
      listingName,
      area,
      landingUrl,
      dailyBudgetAed: perProject,
      trials,
      googleDraft: buildGoogleDraft({
        slug, listingName, area, developer, landingUrl,
        // The draft carries the same per-project figure as an honest suggested
        // budget — it never spends (PAUSED local draft, operator-launched only).
        dailyBudgetAed: perProject,
        price,
      }),
      ...(advisory ? { advisory } : {}),
    })
  }

  return { viable: true, builtAt: new Date().toISOString(), dailyCapAed: cap, projects }
}
