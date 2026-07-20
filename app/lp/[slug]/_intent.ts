// Layer 4 — intent-differentiated landing experience.
//
// ONE page per project that ADAPTS per ?intent= (click-carried from the ad):
// the adaptation only REORDERS and REFRAMES sections and facts that already
// exist on the page. NOTHING-FAKE: no section is added, none is hidden, and a
// hero subline variant only renders when every real fact it cites is present —
// otherwise the page's own default subline stays.
//
// Server-side module (pure) — the page is already fully dynamic (it awaits
// searchParams and reads cookies), so reading the intent here changes nothing
// about caching.

import type { LandingPageData, LandingSection, LandingSectionType } from '@/lib/landing-pages'
import { lpFill } from '@/lib/landing-i18n'
import type { BuyerIntent } from '@/lib/meta/intent'

type Dict = Record<string, string>

// ─── Section order + emphasis map ────────────────────────────────────────────
// Per intent: the section TYPES pulled to the front (in this order), directly
// after the hero. Every section the page has that is NOT listed keeps its
// original relative order after the boosted block — so nothing disappears and
// the per-section zero-hiding rules (self-hiding empty sections) are untouched.
// A type listed here that the page doesn't have is simply skipped: a page with
// no ROI data shows no ROI section for investors either.
export const INTENT_SECTION_ORDER: Record<BuyerIntent, LandingSectionType[]> = {
  // Returns first: yield, plan, unit pricing, headline facts, market signal.
  investor:      ['roi', 'payment-plan', 'units', 'key-facts', 'market-intelligence'],
  // Income first: yield/income cards, then what actually rents (units), plan.
  rental_income: ['roi', 'units', 'payment-plan', 'key-facts'],
  // Affordability first: how to pay, what it costs, the headline facts.
  end_user:      ['payment-plan', 'units', 'key-facts', 'amenities'],
  first_time:    ['payment-plan', 'units', 'key-facts', 'why-dubai'],
  // Lifestyle first: amenities, the area, the neighbourhood, the visuals.
  family:        ['amenities', 'location', 'neighborhood', 'gallery'],
  // The product itself first: visuals, amenities, the narrative.
  luxury:        ['gallery', 'amenities', 'description'],
  // The place first: location, visuals, amenities.
  holiday:       ['location', 'gallery', 'amenities'],
  // Buying from abroad: plan, the Golden Visa fact (when the page has it),
  // and the Dubai case.
  international: ['payment-plan', 'golden-visa', 'why-dubai'],
}

const hidden = (s: LandingSection): boolean =>
  !!s.data && (s.data as Record<string, unknown>)._hidden === true

/** Stable reorder: hero stays first; boosted types (that exist) follow in map
    order; everything else keeps its original relative order. */
export function orderSectionsForIntent(
  sections: LandingSection[],
  intent: BuyerIntent,
): LandingSection[] {
  const rank = new Map(INTENT_SECTION_ORDER[intent].map((t, i) => [t, i]))
  const hero: LandingSection[] = []
  const boosted: Array<{ s: LandingSection; r: number; i: number }> = []
  const rest: LandingSection[] = []
  sections.forEach((s, i) => {
    if (s.type === 'hero') hero.push(s)
    else if (rank.has(s.type) && !hidden(s)) boosted.push({ s, r: rank.get(s.type)!, i })
    else rest.push(s)
  })
  boosted.sort((a, b) => a.r - b.r || a.i - b.i)
  return [...hero, ...boosted.map((b) => b.s), ...rest]
}

// ─── Hero subline variants ───────────────────────────────────────────────────
// Each intent has an ordered list of chrome-dict templates (richest facts
// first). A template is only usable when every fact it interpolates is REAL on
// this listing; when none qualifies, the page's current default subline stays.

interface IntentFacts {
  name: string
  area: string
  price: string // formatted "AED x.xM" — '' when unknown
  yield: string // "x.x" — '' when unknown
  hasPlan: boolean
  hasGoldenVisa: boolean
}

// Mirrors the page's own AED formatter (positive values only reach here).
function fmtAedShort(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function collectFacts(page: LandingPageData): IntentFacts {
  const proj = page.project
  const pos = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const priceNum = pos(proj?.priceFromAed)
  // Same precedence as the ROI section: live Hex yield first, then the
  // project's rentalYield. (No fallback to frozen section snapshots here —
  // the subline cites only live facts.)
  const yieldNum = pos(proj?.roi?.projectedYield) ?? pos(proj?.rentalYield)
  const planSection = page.sections.find((s) => s.type === 'payment-plan' && !hidden(s))
  const d = (planSection?.data ?? {}) as Record<string, unknown>
  const planTotal =
    (pos(d.downPayment) ?? 0) + (pos(d.duringConstruction) ?? 0) +
    (pos(d.onHandover) ?? 0) + (pos(d.postHandover) ?? 0)
  return {
    name: proj?.name || page.title,
    area: proj?.area || '',
    price: priceNum ? fmtAedShort(priceNum) : '',
    yield: yieldNum ? yieldNum.toFixed(1) : '',
    hasPlan: planTotal > 0,
    hasGoldenVisa: page.sections.some((s) => s.type === 'golden-visa' && !hidden(s)),
  }
}

const SUBLINE_CANDIDATES: Record<
  BuyerIntent,
  Array<{ key: string; has: (f: IntentFacts) => boolean }>
> = {
  investor: [
    { key: 'intent.investor.subline.priceYield', has: (f) => !!(f.price && f.yield && f.area) },
    { key: 'intent.investor.subline.yield', has: (f) => !!(f.yield && f.area) },
  ],
  rental_income: [
    { key: 'intent.rentalIncome.subline.yield', has: (f) => !!(f.yield && f.area) },
  ],
  end_user: [
    { key: 'intent.endUser.subline.plan', has: (f) => !!(f.price && f.area) && f.hasPlan },
    { key: 'intent.endUser.subline.price', has: (f) => !!(f.price && f.area) },
  ],
  first_time: [
    { key: 'intent.firstTime.subline.plan', has: (f) => !!(f.price && f.area) && f.hasPlan },
    { key: 'intent.firstTime.subline.price', has: (f) => !!(f.price && f.area) },
  ],
  family: [
    { key: 'intent.family.subline.price', has: (f) => !!(f.price && f.area) },
  ],
  luxury: [
    { key: 'intent.luxury.subline', has: (f) => !!(f.name && f.area) },
  ],
  holiday: [
    { key: 'intent.holiday.subline.price', has: (f) => !!(f.price && f.area) },
    { key: 'intent.holiday.subline', has: (f) => !!f.area },
  ],
  international: [
    { key: 'intent.international.subline.visa', has: (f) => !!(f.price && f.area) && f.hasGoldenVisa },
    { key: 'intent.international.subline.plan', has: (f) => !!(f.price && f.area) && f.hasPlan },
  ],
}

function resolveSubline(intent: BuyerIntent, facts: IntentFacts, L: Dict): string {
  for (const { key, has } of SUBLINE_CANDIDATES[intent]) {
    const template = L[key]
    if (template && has(facts)) {
      return lpFill(template, {
        name: facts.name, area: facts.area, price: facts.price, yield: facts.yield,
      })
    }
  }
  return '' // no qualifying real facts → keep the page's default subline
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/** Reorders sections and (when real facts back it) reframes the hero subline
    for the clicked buyer intent. No intent → the page untouched. Runs on the
    LOCALIZED page so the subline templates (LP_CHROME) match the visitor's
    language and interpolate localized names. */
export function adaptPageForIntent(
  page: LandingPageData,
  intent: BuyerIntent | null,
  L: Dict,
): LandingPageData {
  if (!intent) return page
  let sections = orderSectionsForIntent(page.sections, intent)
  const subline = resolveSubline(intent, collectFacts(page), L)
  if (subline) {
    sections = sections.map((s) =>
      s.type === 'hero' ? { ...s, data: { ...s.data, subtitle: subline } } : s,
    )
  }
  return { ...page, sections }
}
