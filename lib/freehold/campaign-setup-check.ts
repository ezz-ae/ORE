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
  /** COST_CAP when a hard bid ceiling was set at launch. */
  bid_strategy?: string
  /** The cap, in fils (AED x 100). */
  bid_amount?: string | number
  /** Meta's learning state — FAIL is Learning Limited. */
  learning_stage_info?: { status?: string } | null
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
// PROPERTY INTENT IS A PROPERTY WORD, NOT A MONEY WORD.
//
// This list carried `investing`, `investment` and `investor` until a live ad
// set was found qualifying on "Investor (investing)" alone, with no property
// anywhere in it. That is not a near miss: those three substrings match most
// of Meta's finance vocabulary, so the one gate that is supposed to make an
// audience about real estate was being satisfied by an interest in money.
//
// `investing` is not lost by removing it — it still matches inside "Real
// estate investing" on the `real estate` root, which is the whole point. What
// no longer counts is the money word standing on its own.
const PROPERTY_WORDS = ['propert', 'real estate', 'realestate', 'mortgage', 'apartment', 'villa']

// The money words are still worth RECOGNISING, because an ad set carrying only
// these is a different mistake from one carrying nothing. It was aimed — just
// at investors in general instead of at property — and telling its owner they
// targeted nothing would be both wrong and useless. It earns its own sentence.
const MONEY_WORDS = ['investing', 'investment', 'investor']

const matches = (t: Record<string, unknown> | null | undefined, words: string[]): boolean =>
  allSignals(t).some((n) => {
    const s = n.toLowerCase()
    return words.some((w) => s.includes(w))
  })

function hasPropertyIntent(t?: Record<string, unknown> | null): boolean {
  return matches(t, PROPERTY_WORDS)
}
/** Aimed at money, with no property root anywhere to make it about housing. */
function hasMoneyIntentOnly(t?: Record<string, unknown> | null): boolean {
  return !matches(t, PROPERTY_WORDS) && matches(t, MONEY_WORDS)
}

/**
 * Is this ad set's location type the one Meta still SUPPORTS?
 *
 * History, both directions: this product first sent no location_types (Meta's
 * default bought tourists), then pinned ['home'] — which Meta then flagged as
 * a DEPRECATED option. The flag does not stop delivery; it silently blocks
 * every subsequent edit to the ad set until the location type is republished.
 * The only supported value on new ad sets is home+recent, together.
 *
 * So the check flips: the fault is no longer "includes visitors" (that is
 * now the only reality Meta sells) — the fault is a deprecated value holding
 * the ad set's edits hostage.
 */
function deprecatedLocationType(t?: Record<string, unknown> | null): boolean {
  const raw = (t?.geo_locations as { location_types?: unknown } | undefined)?.location_types
  // Absent = Meta's default = the supported pair. Fine.
  if (!Array.isArray(raw) || raw.length === 0) return false
  return raw.map(String).sort().join(',') !== 'home,recent'
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
      // Why many countries in ONE ad set is worth a look: the ad set holds a
      // single budget, and Meta pools it into whichever country's impressions
      // are cheapest — so a wide list quietly becomes a campaign for its
      // cheapest member. The product's own doctrine is each market its own
      // campaign. The line sits at 8: above the biggest bundle this product
      // deliberately builds (whole-GCC, 6), so a chosen Gulf campaign passes
      // clean, while a whole-continent list (Europe is 20 here) gets the watch
      // it deserves. A watch, not a wrong — a multi-market ad set can be a
      // deliberate choice; buying only its cheapest corner cannot be seen from
      // the spec alone.
      out.push({
        level: countries.length > 8 ? 'watch' : 'ok',
        key: countries.length > 8 ? 'manyCountries' : 'place',
        vars: { places: countries.join(', ') || String(cities), n: countries.length },
        adSet: where,
      })
    }

    if (countries.length > 0 || cities > 0) {
      out.push(deprecatedLocationType(t)
        ? { level: 'wrong', key: 'visitors', adSet: where }
        : { level: 'ok', key: 'residents', adSet: where })
    }

    // Both failures are blockers — neither ad set is buying property intent —
    // but they are not the same fault, and a broker can only act on the one
    // that describes what they actually did.
    if (hasPropertyIntent(t)) {
      out.push({ level: 'ok', key: 'property', adSet: where })
    } else if (hasMoneyIntentOnly(t)) {
      out.push({ level: 'wrong', key: 'moneyNotProperty', adSet: where })
    } else {
      out.push({ level: 'wrong', key: 'noProperty', adSet: where })
    }

    // ── Is Meta staying inside the audience that was chosen? ────────────────
    //
    // THE ONE THAT COST A DAY OF LEADS. An ad set built by hand in Ads Manager
    // carries Advantage+ audience by DEFAULT, and in that mode the targeting
    // spec is advisory: Meta reads the narrowing groups as a hint and buys
    // outside them whenever it prefers. Ads Manager says so in small print
    // under the box — "inclusions are always suggestions" — which is easy to
    // read past when every field above it looks right.
    //
    // The tell is the estimate. A real narrowing group takes a UAE audience
    // from millions to hundreds of thousands; the live one moved 2.4M → 2.0M
    // when a property qualifier was made the MUST rule, which is no narrowing
    // at all. Only the location, the language and the excluded custom audience
    // were binding. An hour of interest tuning had changed nothing.
    //
    // So ABSENCE IS NOT OFF. `targeting_automation` is a subfield of
    // `targeting`; a spec that never set it reads back without it, which is
    // indistinguishable from a value we were simply not given. Treating a
    // missing field as "off" is how a check goes permanently quiet on the
    // exact case it exists for — the same fault as a verifier with no verdict
    // for "could not check". The three states are kept apart, and the unknown
    // one is said out loud rather than rendered as silence.
    const auto = t.targeting_automation as Record<string, unknown> | undefined
    if (!auto || Object.keys(auto).length === 0) {
      out.push({ level: 'watch', key: 'expansionUnknown', adSet: where })
    } else {
      // Every `advantage_*` switch, not only advantage_audience. Meta adds
      // these over time and each new one arrives ON by default, so a check that
      // names them one at a time is blind to the next one by construction.
      // `no-advantage.ts` applies the same rule to outbound payloads.
      const on = Object.entries(auto)
        .filter(([k, v]) => k.startsWith('advantage') && Number(v) === 1)
        .map(([k]) => k)
      if (on.length > 0) {
        out.push({ level: 'wrong', key: 'expansion', vars: { fields: on.join(', ') }, adSet: where })
      } else {
        out.push({ level: 'ok', key: 'noExpansion', adSet: where })
      }
    }

    const ageMin = Number(t.age_min) || 0
    const ageMax = Number(t.age_max) || 0
    // 25 is the youngest floor this product ever sets on its own: the fallback
    // spec starts at 25 and pattern-built audiences never go below 30 ("under
    // 30 barely buys here" — the market rule on the ready-buyers card). So a
    // live ad set below 25 was widened OUTSIDE the product, usually an Ads
    // Manager edit, into an age band the product never chooses to spend on.
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
    //
    // A COST_CAP is permanent for the life of the ad set: updateAdSet carries
    // no bid fields, so this product can never raise or remove one after
    // launch. That makes it worth naming on every read — and when the ad set
    // is also stuck in Learning Limited, the cap is the usual reason: a
    // ceiling below what the auction clears does not save money, it silently
    // strangles delivery until the ad set buys only the leftovers nobody else
    // bid for.
    if (String(a.bid_strategy ?? '').toUpperCase() === 'COST_CAP') {
      const capAed = Math.round((Number(a.bid_amount) || 0) / 100)
      const limited = String(a.learning_stage_info?.status ?? '').toUpperCase() === 'FAIL'
      out.push(limited
        ? { level: 'wrong', key: 'capChoking', vars: { cap: capAed }, adSet: where }
        : { level: 'watch', key: 'capped', vars: { cap: capAed }, adSet: where })
    }

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
