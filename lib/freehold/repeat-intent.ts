/**
 * THE SAME PERSON TWICE IS A QUESTION, NOT A VERDICT.
 *
 * "from now the duplication doesnt mean disqualified — we need to smartly
 *  understand why this person registered 2 times and for which offers. if a
 *  lead register for apartment then tomorrow register for another apartment
 *  same price or same area he is active buyer."
 *
 * That is right, and what was here before resolved the ambiguity in the worst
 * available direction. `scoreLeads` took every repeated phone number, counted
 * all but the first as a duplicate, and put them in the JUNK set — the same
 * bucket as a blocked number and an undialable phone. So the single strongest
 * buying signal a funnel can produce was being subtracted from the campaign
 * that produced it, and the ad machine was taught to buy less of it.
 *
 * ── THE DISCRIMINATOR IS WHAT THEY REGISTERED FOR, AND HOW FAR APART ─────
 *
 * Two submissions on the SAME ad within a few minutes is a form submitted
 * twice — somebody unsure it went through. That costs a second charge and is
 * genuinely worth nothing.
 *
 * The same person on a DIFFERENT project, days later, in the same area or at
 * a similar price, is somebody shopping. Nobody fills in a second form for a
 * second apartment unless they are actually buying an apartment. It is the
 * most expensive thing in this product to have mistaken for junk.
 *
 * Between those sit the ordinary cases, and they are kept separate rather than
 * collapsed, because "re-registered for the same thing a week later" and
 * "came back after four months" mean different things to whoever picks up
 * the phone.
 *
 * ── ONLY ONE OF THE FOUR IS WASTE ────────────────────────────────────────
 *
 * `doubleSubmit` is. The other three are the same person showing more
 * interest, not less, and none of them belongs in a junk count. That is the
 * behaviour change: the verdicts decide, and three of the four now say the
 * campaign did something right.
 *
 * Pure — no I/O, no clock, no catalogue lookups. The caller resolves each
 * registration's area and price from the inventory and passes them in, so the
 * rule can be asserted against literals. Runs in `pnpm guards`.
 */

/** Walkable — every reading of a repeated registration. */
export const REPEAT_VERDICTS = ['doubleSubmit', 'sameOffer', 'comparing', 'returning'] as const
export type RepeatVerdict = (typeof REPEAT_VERDICTS)[number]

/**
 * Two submissions on the same ad inside this window are one intention.
 *
 * Half an hour, because that is the shape of the real behaviour: somebody
 * fills the form, sees no confirmation, and fills it again. A person who comes
 * back to the SAME ad an hour later has thought about it in between, which is
 * a different act — so the window is deliberately short rather than generous.
 */
export const DOUBLE_SUBMIT_MINUTES = 30

/**
 * How far apart two DIFFERENT offers can be and still read as one shopping
 * trip. A month covers the way people actually look at property — a few
 * weekends — without stretching so far that two unrelated enquiries a season
 * apart get called a comparison.
 */
export const SHOPPING_WINDOW_DAYS = 30

/**
 * "Same price" with room to move. A buyer comparing a 1.8M apartment against
 * a 2.1M one is comparing; requiring the numbers to match would make the rule
 * fire almost never, which is the same as not having it.
 */
export const SAME_PRICE_TOLERANCE = 0.25

/** One registration, with whatever the caller could resolve about it. */
export interface Registration {
  /** When it arrived. Epoch ms. */
  atMs: number
  /** The ad and form that produced it — ids are proof, names are labels. */
  adId?: string | null
  formName?: string | null
  campaignId?: string | null
  /** What they registered FOR. */
  projectSlug?: string | null
  /** Resolved from the catalogue by the caller; null when unknown. */
  area?: string | null
  priceAED?: number | null
}

const clean = (v?: string | null) => String(v ?? '').trim().toLowerCase()

/** Did these two registrations come through the same ad, or the same form? */
export const sameAd = (a: Registration, b: Registration): boolean => {
  const ad = clean(a.adId)
  if (ad && ad === clean(b.adId)) return true
  const form = clean(a.formName)
  return !!form && form === clean(b.formName)
}

/** The same property, by slug. Unknown on either side is not a match. */
export const sameOffer = (a: Registration, b: Registration): boolean => {
  const p = clean(a.projectSlug)
  return !!p && p === clean(b.projectSlug)
}

export const sameArea = (a: Registration, b: Registration): boolean => {
  const x = clean(a.area)
  return !!x && x === clean(b.area)
}

/** Within SAME_PRICE_TOLERANCE of each other, measured against the larger. */
export function similarPrice(a: Registration, b: Registration): boolean {
  const x = a.priceAED
  const y = b.priceAED
  if (typeof x !== 'number' || typeof y !== 'number') return false
  if (!(x > 0) || !(y > 0)) return false
  return Math.abs(x - y) / Math.max(x, y) <= SAME_PRICE_TOLERANCE
}

export interface RepeatReading {
  verdict: RepeatVerdict
  /** Hours between the two, rounded — what the card shows. */
  hoursApart: number
  /** Why it reads this way, as ids a screen turns into words. */
  because: Array<'sameAd' | 'sameOffer' | 'sameArea' | 'similarPrice' | 'withinMinutes' | 'longGap'>
  /** True only for the one reading that is genuinely wasted spend. */
  isWaste: boolean
  /** True when this is somebody actively shopping — the signal to buy MORE of. */
  isBuyingSignal: boolean
}

/**
 * Read a pair of registrations by the same person.
 *
 * Order-independent: the caller may pass them either way round and gets the
 * same answer, because "which came first" is a fact about the records and not
 * about what the person was doing.
 */
export function readRepeat(a: Registration, b: Registration): RepeatReading {
  const [first, second] = a.atMs <= b.atMs ? [a, b] : [b, a]
  const msApart = Math.max(0, second.atMs - first.atMs)
  const hoursApart = Math.round(msApart / 3_600_000)
  const because: RepeatReading['because'] = []

  const onSameAd = sameAd(first, second)
  const onSameOffer = sameOffer(first, second)
  if (onSameAd) because.push('sameAd')
  if (onSameOffer) because.push('sameOffer')

  // ── The only waste. Same ad, minutes apart: one intention, charged twice.
  if (onSameAd && msApart <= DOUBLE_SUBMIT_MINUTES * 60_000) {
    because.push('withinMinutes')
    return { verdict: 'doubleSubmit', hoursApart, because, isWaste: true, isBuyingSignal: false }
  }

  // ── Same thing again, later. Interest repeated, not interest doubled.
  if (onSameAd || onSameOffer) {
    return { verdict: 'sameOffer', hoursApart, because, isWaste: false, isBuyingSignal: false }
  }

  // ── UNKNOWN IS NOT DIFFERENT ──────────────────────────────────────────
  //
  // Reaching here means neither the ad nor the project matched. That is only
  // evidence of SHOPPING if we can actually see two different things; when a
  // row carries no project and no ad, we cannot see anything. Reading absence
  // as difference would turn every information-less repeat — including a
  // genuine double submit from a form that never recorded its ad — into a
  // buying signal, which is the old bug pointing the other way.
  const canTell = (r: Registration) => !!clean(r.projectSlug) || !!clean(r.adId)
  if (!canTell(first) || !canTell(second)) {
    return { verdict: 'sameOffer', hoursApart, because, isWaste: false, isBuyingSignal: false }
  }

  // ── DIFFERENT offers. This is the case the old rule threw away.
  const withinWindow = msApart <= SHOPPING_WINDOW_DAYS * 86_400_000
  const area = sameArea(first, second)
  const price = similarPrice(first, second)
  if (area) because.push('sameArea')
  if (price) because.push('similarPrice')

  if (withinWindow) {
    // TWO DIFFERENT PROPERTIES, INSIDE A MONTH. Nobody fills in a second form
    // for a second property unless they are buying a property.
    //
    // Area and price STRENGTHEN this — they are the operator's own example of
    // it — but they are not required, and requiring them was a bug: the score
    // reads leads straight from the CRM, where a row carries its project and
    // its ad but not the catalogue's area or price. A rule that needed those
    // could never fire from the place that matters most, and the buying
    // signal would have gone on being counted as waste while the guard passed.
    return { verdict: 'comparing', hoursApart, because, isWaste: false, isBuyingSignal: true }
  }

  because.push('longGap')
  return { verdict: 'returning', hoursApart, because, isWaste: false, isBuyingSignal: false }
}

/**
 * The reading for a whole cluster of registrations by one person.
 *
 * Takes the STRONGEST signal across every pair rather than only the newest
 * two: somebody who registered for three properties has compared, whichever
 * pair you happen to look at, and a rule that only read the last two would
 * miss it whenever the final pair happened to be the same offer twice.
 */
export function readCluster(regs: readonly Registration[]): RepeatReading | null {
  if (regs.length < 2) return null
  const pairs: RepeatReading[] = []
  for (let i = 0; i < regs.length; i++) {
    for (let j = i + 1; j < regs.length; j++) pairs.push(readRepeat(regs[i], regs[j]))
  }
  // Buying signal outranks everything; waste is only claimed when NO pair says
  // anything better, so one accidental double-submit cannot bury the fact that
  // the same person also shopped two other properties.
  return pairs.find((p) => p.isBuyingSignal)
    ?? pairs.find((p) => p.verdict === 'returning')
    ?? pairs.find((p) => p.verdict === 'sameOffer')
    ?? pairs[0]
}
