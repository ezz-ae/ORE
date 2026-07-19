/**
 * Ads Machine — planner (stage 1: engine, no UI).
 *
 * buildMachinePlan turns "these projects + this hard daily cap" into a
 * persisted, launchable plan: 2–3 Meta audience trials per project — each from
 * a DISTINCT real source (the company's own buyer-match profile, an existing
 * saved audience/lookalike, and an Advantage+ broad baseline) — plus ONE
 * Google SEARCH trial per project. Google is a LIVE channel: its trial takes a
 * share of the same budget split as the Meta trials and ONE combined daily cap
 * governs both channels. When the per-project share funds the Meta trials but
 * not the Google one, the Google trial is dropped for that project (noted on
 * the plan as googleSkipped) instead of failing the whole plan.
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
import type { ListingFacts } from '@/lib/meta/form-templates'

/** Minimum viable daily trial budget (Meta's ad-set floor; the machine holds
 * Google search trials to the same AED 50/day floor). */
export const META_MIN_TRIAL_BUDGET_AED = 50

export type TrialSource = 'buyer-match' | 'saved-audience' | 'lookalike' | 'advantage-broad' | 'google-search'

export interface MachineTrialPlan {
  /** Stable id within the plan — the engine matches launched campaigns to it. */
  id: string
  /** Human-readable trial label; unique per project (one per source). */
  label: string
  source: TrialSource
  /** Launch channel. Absent on plans persisted before Google went live = 'meta'. */
  channel?: 'meta' | 'google'
  projectSlug: string
  campaignName: string
  listingName: string
  dailyBudgetAed: number
  /** Meta trials only. */
  targeting?: CampaignTargeting
  creative?: CampaignCreative
  /** Google search trials only — the full real launch payload (RSA + keywords). */
  google?: LaunchGoogleCampaignPayload
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
  /** Legacy (pre-live-Google plans only): ONE Google SEARCH draft payload.
   * New plans carry the Google search campaign as a real trial instead. */
  googleDraft?: LaunchGoogleCampaignPayload
  /** Honest note when the split funds the Meta trials but not the Google one. */
  googleSkipped?: string
  /** Learning-loop targeting note — ADVISORY only, absent when unavailable. */
  advisory?: string
  /** Real listing facts captured at plan time — the engine materializes the
   * project's Meta instant lead form from these. Absent on older plans (the
   * engine then falls back to the fields above). */
  facts?: ListingFacts
  /** Meta instant form the engine created for this project's lead trials —
   * written back by the engine on first launch so every later trial reuses
   * the SAME form (one qualification form per project per machine). */
  leadFormId?: string
}

export type MachinePlan =
  | { viable: true; builtAt: string; dailyCapAed: number; projects: MachineProjectPlan[] }
  | { viable: false; reason: string }

const SITE_BASE = 'https://www.freeholdproperty.ae'

/** Meta trial sources only — the google-search trial builds RSA copy directly
 * from listing fields and never uses these angles. */
type MetaTrialSource = Exclude<TrialSource, 'google-search'>
const ANGLE_FOR_SOURCE: Record<MetaTrialSource, CreativeAngle> = {
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
function buildGoogleSearchPayload(params: {
  slug: string
  listingName: string
  area: string
  developer: string
  landingUrl: string
  dailyBudgetAed: number
  price: number | null
  campaignName: string
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
    campaignName: params.campaignName,
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
    type Candidate = { source: MetaTrialSource; label: string; targeting: CampaignTargeting; rationale: string; savedAudienceId?: string; savedAudienceName?: string }
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
    // AED 50 floor (perProject >= 50 was already guaranteed above). The Meta
    // trials are the backbone and are funded first; the Google SEARCH trial
    // takes the NEXT floor-sized slot of the SAME split. If the share funds
    // the Meta trials but not the Google one, the Google trial is dropped for
    // this project — noted on the plan, never a failure of the whole plan.
    const fundable = Math.max(1, Math.floor(perProject / META_MIN_TRIAL_BUDGET_AED))
    const chosen = candidates.slice(0, Math.min(candidates.length, fundable))
    const includeGoogle = fundable >= chosen.length + 1
    const trialCount = chosen.length + (includeGoogle ? 1 : 0)
    const perTrial = Math.floor(perProject / trialCount)
    const googleSkipped = includeGoogle
      ? undefined
      : `AED ${perProject}/day funds ${chosen.length} Meta trial(s) at the AED ${META_MIN_TRIAL_BUDGET_AED}/day floor but not an additional Google Search trial — it was dropped for this project. Raise the cap to fund it.`

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

    const namePrefix = opts?.machineName ? `${opts.machineName} — ` : 'Ads Machine — '
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
        channel: 'meta' as const,
        projectSlug: slug,
        campaignName: `${namePrefix}${listingName} — ${c.label}`,
        listingName,
        dailyBudgetAed: perTrial,
        targeting: c.targeting,
        creative: variantToCreative(variant, landingUrl, heroImage),
        ...(c.savedAudienceId ? { savedAudienceId: c.savedAudienceId, savedAudienceName: c.savedAudienceName } : {}),
        copySource,
        rationale: c.rationale,
      }
    })

    // The Google SEARCH trial — a REAL trial in the same pool: same split,
    // same cap, launched live by the engine. RSA copy + keywords are derived
    // deterministically from the listing's real fields (template, never
    // pretend-AI).
    if (includeGoogle) {
      const googlePayload = buildGoogleSearchPayload({
        slug, listingName, area, developer, landingUrl,
        dailyBudgetAed: perTrial,
        price,
        campaignName: `${namePrefix}${listingName} — Google Search`,
      })
      trials.push({
        id: `trial-${randomUUID()}`,
        label: 'Google Search',
        source: 'google-search',
        channel: 'google',
        projectSlug: slug,
        campaignName: googlePayload.campaignName,
        listingName,
        dailyBudgetAed: perTrial,
        google: googlePayload,
        copySource: 'template',
        rationale: `Search-intent trial: real keywords from the listing and area (${(googlePayload.keywords ?? []).map((k) => `"${k.text}"`).join(', ')}), RSA copy from the listing's real fields.`,
      })
    }

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
      ...(googleSkipped ? { googleSkipped } : {}),
      ...(advisory ? { advisory } : {}),
      facts: {
        name: listingName,
        area,
        priceAED: price,
        paymentPlan: listing?.paymentPlan ?? null,
        landingUrl,
        brochureUrl: listing?.brochureUrl ?? null,
      },
    })
  }

  return { viable: true, builtAt: new Date().toISOString(), dailyCapAed: cap, projects }
}
