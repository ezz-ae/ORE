/**
 * DESTINATION — the biggest lever in the account, and the one nothing tested.
 *
 * Where an ad sends someone was decided by a single expression, in three
 * places in the machine:
 *
 *     destination: leadFormId ? 'form' : 'landing'
 *
 * That is not a decision. It is an accident of configuration: whoever
 * connected a lead form to the page settled the destination for every campaign
 * afterwards, permanently, without a comparison ever being run.
 *
 * It matters more than the targeting does. An instant form and a landing page
 * typically differ by 2–5× on cost per lead, and they differ in the OPPOSITE
 * direction on quality. A form is one tap inside Facebook with the name and
 * number pre-filled; it is cheap and it collects people who were not really
 * asking. A landing page costs a click, a page load and a typed phone number,
 * and each of those is friction that a browser drops out of and a buyer does
 * not. You are not choosing a mechanism. You are choosing where on the
 * volume-versus-intent curve you want to sit.
 *
 * WHY COST PER LEAD IS THE WRONG BASIS HERE — and this is the whole module.
 * Cost per lead flatters the form by construction, because a form's "lead" is
 * a lower bar than a landing page's. Comparing them on it is comparing a
 * kilometre to a mile because both are called a distance. The comparison has
 * to be made on an event that means the same thing on both sides, and there
 * are exactly two:
 *
 *   · QUALIFIED leads — the CRM decides, and it applies the same standard to
 *     both. This is the honest basis and it is the slow one.
 *   · Leads per million IMPRESSIONS — both sides buy impressions, and there
 *     are hundreds of thousands of them. Fast, but it still counts a form's
 *     easier lead as equal, so it answers volume rather than value.
 *
 * The right read uses the second to move early and the first to decide.
 *
 * ONE COST THAT NEVER APPEARS IN THE NUMBERS. An instant form has no landing
 * URL, so Meta's {{placement}} macro has nowhere to ride and no click event
 * exists. A form-only account is structurally blind to placement and to
 * landing behaviour — it cannot run the placement audit, cannot see junk
 * inventory, and cannot score how anyone read the page. That is a real price
 * for the cheaper lead, it is invisible in every dashboard, and it is stated
 * here so it can be weighed.
 *
 * Pure — no I/O.
 */
import { samePace, SIGNIFICANT_P } from '@/lib/freehold/inventory-quality'
import { fisherExact } from '@/lib/freehold/relevance'
import { costRange } from '@/lib/freehold/min-evidence'

export type Destination = 'form' | 'landing' | 'whatsapp' | 'phone'

export const DESTINATION_LABEL: Record<Destination, string> = {
  form: 'Instant form',
  landing: 'Landing page',
  whatsapp: 'WhatsApp',
  phone: 'Call',
}

/** What each destination can tell us about itself. Not a ranking — a list of
 *  the measurements each one makes possible, so the choice is made knowing
 *  what it forecloses. */
export const DESTINATION_VISIBILITY: Record<Destination, { placement: boolean; landingBehaviour: boolean; clickEvent: boolean }> = {
  form:     { placement: false, landingBehaviour: false, clickEvent: false },
  landing:  { placement: true,  landingBehaviour: true,  clickEvent: true },
  whatsapp: { placement: false, landingBehaviour: false, clickEvent: true },
  phone:    { placement: false, landingBehaviour: false, clickEvent: true },
}

export interface DestinationArm {
  destination: Destination
  spend: number
  impressions: number
  /** Every lead, however easily obtained. */
  leads: number
  /** Leads the CRM has judged qualified or deeper — the basis that means the
   *  same thing on both sides. */
  qualified: number
}

export interface DestinationReading extends DestinationArm {
  cpl: number | null
  /** Cost per QUALIFIED lead. The number that should drive the decision. */
  cpql: number | null
  cpqlRange: { lo: number; hi: number } | null
  /** Leads per million impressions — volume, available early. */
  lpm: number | null
  /** Share of leads that survive first contact. The quality axis. */
  qualifyRate: number | null
}

export function readArm(a: DestinationArm): DestinationReading {
  return {
    ...a,
    cpl: a.leads > 0 ? a.spend / a.leads : null,
    cpql: a.qualified > 0 ? a.spend / a.qualified : null,
    cpqlRange: a.spend > 0 ? costRange(a.spend, a.qualified) : null,
    lpm: a.impressions > 0 ? (a.leads / a.impressions) * 1_000_000 : null,
    qualifyRate: a.leads > 0 ? a.qualified / a.leads : null,
  }
}

export type DestinationVerdict = 'form' | 'landing' | 'whatsapp' | 'phone' | 'undecided'

export interface DestinationComparison {
  arms: DestinationReading[]
  /** Which destination wins on QUALIFIED cost, when the evidence supports one. */
  winner: DestinationVerdict
  /** p for "these convert qualified leads at the same rate per dirham". */
  pQualified: number
  /** p for "these produce raw leads at the same rate per impression". The
   *  early signal — moves first, means less. */
  pVolume: number
  /** True when the raw lead counts say one thing and the qualified counts say
   *  the other. The single most useful output of this whole module. */
  cplIsMisleading: boolean
  headline: string
  recommendation: string
  /** Measurements the winning destination makes impossible, if any. */
  blindSpots: string[]
}

const money = (n: number | null) => (n === null ? '—' : `AED ${n.toFixed(0)}`)
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)

/**
 * Compare two destinations honestly.
 *
 * Decided on cost per QUALIFIED lead, because that is the only event both
 * sides define identically. The raw-lead comparison is computed too, and when
 * the two disagree that disagreement is the finding — it is the exact shape of
 * the mistake this module exists to prevent, and it is invisible in Ads
 * Manager, which only ever shows the raw one.
 */
export function compareDestinations(arms: DestinationArm[]): DestinationComparison {
  const readings = arms.map(readArm)
  if (readings.length < 2) {
    return {
      arms: readings, winner: 'undecided', pQualified: 1, pVolume: 1, cplIsMisleading: false,
      headline: readings.length === 0
        ? 'No destination has delivered yet.'
        : `Only ${DESTINATION_LABEL[readings[0].destination].toLowerCase()} has run — there is nothing to compare it against.`,
      recommendation: readings.length === 1
        ? `Run the same audience and creative to a second destination. Until then this account has never tested the variable that usually moves cost per lead more than targeting does.`
        : 'Nothing to compare.',
      blindSpots: [],
    }
  }

  // Rank on qualified cost; fall back to raw leads only to break a tie where
  // neither side has qualified anyone yet.
  const sorted = [...readings].sort((a, b) => {
    const av = a.cpql ?? Infinity, bv = b.cpql ?? Infinity
    if (av !== bv) return av - bv
    return (b.lpm ?? 0) - (a.lpm ?? 0)
  })
  const best = sorted[0], worst = sorted[sorted.length - 1]

  // Qualified leads over SPEND — the decision basis.
  const pQualified = samePace(best.qualified, best.spend, worst.qualified, worst.spend)
  // Raw leads over IMPRESSIONS — the early basis.
  const pVolume = samePace(best.leads, best.impressions, worst.leads, worst.impressions)

  // Do the two bases disagree about who is winning?
  const rawWinner = readings.reduce((a, b) => ((a.cpl ?? Infinity) <= (b.cpl ?? Infinity) ? a : b))
  const cplIsMisleading =
    best.cpql !== null && rawWinner.destination !== best.destination && pQualified < SIGNIFICANT_P

  const decided = pQualified < SIGNIFICANT_P && best.cpql !== null
  const winner: DestinationVerdict = decided ? best.destination : 'undecided'

  const blindSpots: string[] = []
  if (decided) {
    const v = DESTINATION_VISIBILITY[best.destination]
    if (!v.placement) blindSpots.push('placement — no landing URL means Meta\'s placement macro has nowhere to ride, so the placement audit cannot run on it')
    if (!v.landingBehaviour) blindSpots.push('landing behaviour — nobody reaches a page, so there is no reading of how thoroughly they engaged')
  }

  const headline = decided
    ? `${DESTINATION_LABEL[best.destination]} wins on qualified cost: ${money(best.cpql)} against ${money(worst.cpql)} (p=${pQualified.toFixed(3)}).`
    : `${DESTINATION_LABEL[best.destination]} reads better at ${money(best.cpql)} against ${money(worst.cpql)}, but the gap is not established yet (p=${pQualified.toFixed(3)}).`

  let recommendation: string
  if (cplIsMisleading) {
    recommendation =
      `COST PER LEAD IS POINTING THE WRONG WAY HERE. ${DESTINATION_LABEL[rawWinner.destination]} looks cheaper per lead ` +
      `(${money(rawWinner.cpl)} against ${money(best.cpl)}), and ${DESTINATION_LABEL[best.destination].toLowerCase()} is cheaper per lead that survives ` +
      `first contact (${money(best.cpql)} against ${money(rawWinner.cpql)}) — ${pct(best.qualifyRate)} of its leads qualify against ` +
      `${pct(rawWinner.qualifyRate)}. Ads Manager only shows the first number. Move budget on the second.`
  } else if (decided) {
    recommendation = `Move budget to ${DESTINATION_LABEL[best.destination].toLowerCase()}.` +
      (blindSpots.length ? ` Knowing what it costs you: ${blindSpots.join('; ')}.` : '')
  } else if (pVolume < SIGNIFICANT_P) {
    recommendation =
      `On raw volume the two have already separated (p=${pVolume.toFixed(3)}), but volume counts a form's easier lead ` +
      `as equal to a landing page's. Keep both running until the qualified counts settle it — that is the basis that means ` +
      `the same thing on both sides.`
  } else {
    recommendation = 'Neither basis has separated. Keep both running; this is the comparison worth being patient about, because it is usually larger than anything targeting will find.'
  }

  return { arms: readings, winner, pQualified, pVolume, cplIsMisleading, headline, recommendation, blindSpots }
}

/**
 * Is the qualify-rate difference between two destinations real?
 *
 * A proportion comparison rather than a rate-over-exposure one — of the leads
 * each destination produced, what share survived. Exposed separately because
 * "the form is cheaper AND worse" is two findings, and an operator deciding
 * where to send money is entitled to see both established independently.
 */
export function qualifyRateDiffers(a: DestinationArm, b: DestinationArm): { p: number; established: boolean } {
  const p = fisherExact(a.qualified, a.leads - a.qualified, b.qualified, b.leads - b.qualified)
  return { p, established: p < SIGNIFICANT_P }
}
