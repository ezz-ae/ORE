/**
 * IS THIS CAMPAIGN SET UP RIGHT?
 *
 * Not "is it performing" — that question needs weeks of data and the rest of
 * this system answers it. This answers the question you can answer on day one,
 * before a dirham is wasted: is the money pointed where somebody meant to
 * point it.
 *
 * Every finding here is read from what Meta actually holds RIGHT NOW, not from
 * what the launcher intended to send. Those are different things: a launch can
 * succeed while Meta quietly drops a field, an ad set can be edited in Ads
 * Manager afterwards, and a campaign can sit ACTIVE for a week with no live ad
 * inside it. Reading the intent proves nothing about the account.
 *
 * The findings are ordered worst first, and each one is a sentence a broker can
 * act on. Nothing here is a score.
 *
 * Pure + client-safe — no Meta or DB imports, so the campaign page runs it on
 * the data it already loaded.
 */

export type SetupLevel = 'wrong' | 'watch' | 'ok'

export interface SetupFinding {
  level: SetupLevel
  /** i18n key suffix under `lm.setupCheck.` */
  key: string
  vars?: Record<string, string | number>
  /** Which ad set this is about; absent when it is about the whole campaign. */
  adSet?: string
}

export interface AdSetForCheck {
  id: string
  name: string
  status?: string
  daily_budget?: string | number
  optimization_goal?: string
  targeting?: Record<string, unknown> | null
  ads?: Array<{ id: string; status?: string; effective_status?: string }>
}

export interface CampaignForCheck {
  id: string
  name?: string
  status?: string
  objective?: string
  daily_budget?: string | number
  lifetime_budget?: string | number
}

// ── reading a live targeting spec ────────────────────────────────────────────

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const names = (v: unknown): string[] =>
  arr(v).map((x) => String((x as { name?: unknown })?.name ?? '')).filter(Boolean)

/** Every interest and behaviour named anywhere in the spec, including the
 *  AND-layers (flexible_spec / narrowing) where the property anchor lives. */
function allSignals(t?: Record<string, unknown> | null): string[] {
  const out: string[] = [...names(t?.interests), ...names(t?.behaviors)]
  for (const key of ['flexible_spec', 'narrowing']) {
    for (const g of arr(t?.[key])) {
      const grp = g as Record<string, unknown>
      out.push(...names(grp?.interests), ...names(grp?.behaviors))
    }
  }
  return out
}

/**
 * Does anything in this ad set say "these people are interested in property"?
 *
 * This is the one rule the whole audience side of the product is built on, so
 * it is also the one worth verifying against the live account rather than
 * trusting. Matched on wording, because the ids are re-resolved at launch and
 * an id proves nothing about what it means today.
 */
const PROPERTY_WORDS = ['propert', 'real estate', 'realestate', 'mortgage', 'apartment', 'villa', 'investing', 'investment', 'investor']
function hasPropertyIntent(t?: Record<string, unknown> | null): boolean {
  return allSignals(t).some((n) => {
    const s = n.toLowerCase()
    return PROPERTY_WORDS.some((w) => s.includes(w))
  })
}

function countriesOf(t?: Record<string, unknown> | null): string[] {
  const g = t?.geo_locations as { countries?: unknown } | undefined
  return arr(g?.countries).map(String)
}
function citiesOf(t?: Record<string, unknown> | null): number {
  const g = t?.geo_locations as { cities?: unknown } | undefined
  return arr(g?.cities).length
}

/** The surfaces this ad set buys, as "Instagram Feed"-style labels. */
export function surfaceLabels(t?: Record<string, unknown> | null): string[] {
  const platforms = arr(t?.publisher_platforms).map(String)
  const fb = arr(t?.facebook_positions).map(String)
  const ig = arr(t?.instagram_positions).map(String)
  const label: Record<string, string> = {
    'facebook:feed': 'Facebook Feed',
    'facebook:facebook_reels': 'Facebook Reels',
    'facebook:story': 'Facebook Stories',
    'instagram:stream': 'Instagram Feed',
    'instagram:story': 'Instagram Stories',
    'instagram:reels': 'Instagram Reels',
    'instagram:explore': 'Instagram Explore',
  }
  const out: string[] = []
  for (const p of platforms) {
    const pos = p === 'facebook' ? fb : p === 'instagram' ? ig : []
    if (pos.length === 0) { out.push(p); continue }
    for (const x of pos) out.push(label[`${p}:${x}`] ?? `${p} · ${x}`)
  }
  return out
}

/** Platforms that are not Facebook or Instagram — third-party inventory. */
const OFF_PLATFORM = ['audience_network', 'messenger']

/** Goals that buy attention rather than customers. */
const SOFT_GOALS = ['REACH', 'IMPRESSIONS', 'AD_RECALL_LIFT', 'POST_ENGAGEMENT', 'PAGE_LIKES', 'THRUPLAY']

const RANK: Record<SetupLevel, number> = { wrong: 0, watch: 1, ok: 2 }

export function checkCampaignSetup(
  campaign: CampaignForCheck,
  adSets: AdSetForCheck[],
): SetupFinding[] {
  const out: SetupFinding[] = []
  const live = String(campaign.status ?? '').toUpperCase() === 'ACTIVE'

  if (adSets.length === 0) {
    out.push({ level: 'wrong', key: 'noAdSets' })
    return out
  }

  for (const a of adSets) {
    const t = a.targeting
    const where = a.name
    const paused = String(a.status ?? '').toUpperCase() === 'PAUSED'

    // ── Is it even running? ──────────────────────────────────────────────────
    if (live && paused) out.push({ level: 'watch', key: 'adSetPaused', adSet: where })

    // An ad set with no live ad spends nothing and looks fine from above.
    if (Array.isArray(a.ads)) {
      const liveAds = a.ads.filter((ad) => {
        const s = String(ad.effective_status ?? ad.status ?? '').toUpperCase()
        return s === 'ACTIVE'
      })
      if (a.ads.length === 0) out.push({ level: 'wrong', key: 'noAds', adSet: where })
      else if (liveAds.length === 0 && !paused) out.push({ level: 'wrong', key: 'noLiveAd', adSet: where })
    }

    // ── Who sees it ─────────────────────────────────────────────────────────
    if (!t) {
      out.push({ level: 'wrong', key: 'noTargeting', adSet: where })
      continue
    }

    const countries = countriesOf(t)
    const cities = citiesOf(t)
    if (countries.length === 0 && cities === 0) {
      out.push({ level: 'wrong', key: 'noPlace', adSet: where })
    } else {
      out.push({
        level: countries.length > 8 ? 'watch' : 'ok',
        key: countries.length > 8 ? 'manyCountries' : 'place',
        vars: { places: countries.join(', ') || String(cities), n: countries.length },
        adSet: where,
      })
    }

    if (!hasPropertyIntent(t)) {
      out.push({ level: 'wrong', key: 'noProperty', adSet: where })
    } else {
      out.push({ level: 'ok', key: 'property', adSet: where })
    }

    // Meta going outside the audience that was chosen.
    const auto = t.targeting_automation as Record<string, unknown> | undefined
    if (auto && Number(auto.advantage_audience) === 1) {
      out.push({ level: 'wrong', key: 'expansion', adSet: where })
    }

    const ageMin = Number(t.age_min) || 0
    const ageMax = Number(t.age_max) || 0
    if (ageMin && ageMin < 25) out.push({ level: 'watch', key: 'youngAge', vars: { min: ageMin }, adSet: where })
    if (ageMin && ageMax) out.push({ level: 'ok', key: 'age', vars: { min: ageMin, max: ageMax }, adSet: where })

    // ── Where it runs ───────────────────────────────────────────────────────
    const platforms = arr(t.publisher_platforms).map(String)
    const stray = platforms.filter((p) => OFF_PLATFORM.includes(p))
    if (platforms.length === 0) {
      out.push({ level: 'wrong', key: 'anyPlacement', adSet: where })
    } else if (stray.length > 0) {
      out.push({ level: 'wrong', key: 'offPlatform', vars: { where: stray.join(', ') }, adSet: where })
    } else {
      const surfaces = surfaceLabels(t)
      const loose = platforms.filter((p) =>
        (p === 'facebook' && arr(t.facebook_positions).length === 0) ||
        (p === 'instagram' && arr(t.instagram_positions).length === 0))
      if (loose.length > 0) out.push({ level: 'watch', key: 'loosePlacement', vars: { where: loose.join(', ') }, adSet: where })
      else out.push({ level: 'ok', key: 'placements', vars: { where: surfaces.join(' · ') }, adSet: where })
    }

    // ── What Meta is told to buy ────────────────────────────────────────────
    const goal = String(a.optimization_goal ?? '').toUpperCase()
    if (goal && SOFT_GOALS.includes(goal)) {
      out.push({ level: 'wrong', key: 'softGoal', vars: { goal }, adSet: where })
    }

    const budget = Number(a.daily_budget ?? 0)
    if (!budget && !Number(campaign.daily_budget ?? 0) && !Number(campaign.lifetime_budget ?? 0)) {
      out.push({ level: 'wrong', key: 'noBudget', adSet: where })
    }
  }

  return out.sort((x, y) => RANK[x.level] - RANK[y.level])
}

/** The one-line answer: how many real problems are in there. */
export function setupProblemCount(findings: SetupFinding[]): number {
  return findings.filter((f) => f.level === 'wrong').length
}
