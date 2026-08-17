/**
 * THE SYSTEM STOPS NARRATING AND STARTS ASKING.
 *
 * Every surface in this product describes what it found. "This placement is
 * draining your budget." True, and useless: the reader still has to work out
 * what to do, whether it is worth doing, and how to do it — so mostly they do
 * nothing, and the finding scrolls away. A system that only explains has
 * quietly moved the whole job back onto the person.
 *
 * A proposal is the same knowledge shaped as a decision:
 *
 *     Instagram Feed is producing leads at roughly half the cost of Facebook
 *     Feed on this campaign. Move the budget to it?
 *     [ Accept ]  [ Later ]  [ Recheck ]
 *
 * ── WHY THE EVIDENCE BAR IS HIGHER HERE THAN FOR TEXT ────────────────────
 *
 * An ACCEPT button makes a claim actionable. A wrong sentence wastes
 * attention; a wrong proposal moves real money, with the person's consent
 * borrowed on the strength of our arithmetic. So a proposal is only OFFERED
 * when the difference clears the evidence gate — the cost ranges must not
 * overlap, per min-evidence.ts. Two placements at "AED 90 vs AED 140" whose
 * ranges are 40–210 and 60–260 are not different; they are the same placement
 * measured twice, and asking "shall I move your budget?" about them is the
 * most expensive kind of confident nonsense.
 *
 * When the evidence is thin the proposal still appears — silence is its own
 * lie — but with no Accept. It says it is not decidable yet, and offers only
 * Recheck.
 *
 * ── AND WHY THERE ARE EXACTLY THREE ANSWERS ──────────────────────────────
 *
 *   ACCEPT  — do it. Only ever shown when the system can actually perform it;
 *             a button that turns out to be a suggestion is worse than a
 *             sentence, because it spends trust as well as time.
 *   LATER   — not now. A SNOOZE, never a dismiss: it comes back, and it is
 *             re-measured before it does, because the reason may have expired
 *             while it waited.
 *   RECHECK — measure again now. The honest answer to "I don't believe you",
 *             and the only answer available when the evidence is thin.
 *
 * There is deliberately no "Dismiss". A finding that a person can delete
 * without changing anything is a finding the product will stop making, and
 * then the one that mattered is gone too. Disagreement is expressed by
 * rechecking and watching it withdraw itself.
 *
 * Pure — no database, no network, no clock of its own. Runs in `pnpm guards`.
 */
import { costRange, MIN_ATTRIBUTED_FOR_QUALITY } from './min-evidence'

/** The three answers. Walkable — the i18n audit enumerates them. */
export const PROPOSAL_RESPONSES = ['accept', 'later', 'recheck'] as const
export type ProposalResponse = (typeof PROPOSAL_RESPONSES)[number]

/** Where a proposal has got to. */
export const PROPOSAL_STATES = [
  'open',       // waiting for an answer
  'deferred',   // Later — asleep, and it will be re-measured before it returns
  'accepted',   // answered yes; the doing is somebody else's job to report
  'done',       // performed and confirmed
  'failed',     // accepted, attempted, did not work — never silently dropped
  'withdrawn',  // the reason stopped being true. Said out loud, not vanished.
] as const
export type ProposalState = (typeof PROPOSAL_STATES)[number]

/** Every proposal this product can make. Walkable, so none ships wordless. */
export const PROPOSAL_KINDS = [
  'placementShift',   // one placement is cheaper per lead than another
  'placementStop',    // one placement is spending and returning nothing
  'notYet',           // we can see a difference but cannot yet call it real
] as const
export type ProposalKind = (typeof PROPOSAL_KINDS)[number]

export interface Proposal {
  kind: ProposalKind
  /** What the proposal is about — campaign id, ad set id, placement key. */
  subject: string
  /**
   * Which buttons to show. Accept is present only when the evidence supports
   * the claim AND the system can perform the act; the other two always are.
   */
  responses: ProposalResponse[]
  /** Filled into the sentence. This module holds no words. */
  vars: Record<string, string | number>
  /** Why Accept is missing, when it is. Shown, never swallowed. */
  blocked?: 'thin_evidence' | 'not_executable'
}

/** One placement's measured performance. */
export interface PlacementResult {
  /** "Instagram Feed", "Facebook Feed" — already a label, not an enum. */
  label: string
  spendAed: number
  leads: number
}

/**
 * Is the gap between these two real, or are we looking at noise?
 *
 * The test is non-overlapping cost ranges: the BEST case for the expensive one
 * must still be worse than the WORST case for the cheap one. Comparing point
 * estimates instead — "AED 90 beats AED 140" — is how a system ends up
 * proposing a budget move on four conversions.
 */
export function differenceIsReal(cheap: PlacementResult, dear: PlacementResult): boolean {
  // Below the attribution floor there is no comparison to make, whatever the
  // arithmetic says. Two leads against five is not a trend.
  if (cheap.leads < MIN_ATTRIBUTED_FOR_QUALITY || dear.leads < MIN_ATTRIBUTED_FOR_QUALITY) return false
  const c = costRange(cheap.spendAed, cheap.leads)
  const d = costRange(dear.spendAed, dear.leads)
  return c.hi < d.lo
}

/** Cost per lead, or null when nothing has been attributed to it yet. */
export const cplOf = (p: PlacementResult): number | null =>
  p.leads > 0 ? p.spendAed / p.leads : null

/**
 * The proposal to make about a pair of placements, if any.
 *
 * `executable` says whether this product can perform the change itself. When
 * it cannot, Accept is withheld rather than shown as a wish — a button that
 * turns out to be advice spends the reader's trust as well as their time.
 */
export function placementProposal(
  subject: string,
  results: PlacementResult[],
  executable: boolean,
): Proposal | null {
  const scored = results.filter((r) => r.spendAed > 0)
  if (scored.length < 2) return null

  // A placement that has spent real money and returned nothing is its own
  // proposal, and it does not need a comparison to be worth making. The floor
  // matters: at AED 30 spent, zero leads is a normal morning.
  const spentNothingBack = scored.find(
    (r) => r.leads === 0 && r.spendAed >= MIN_ATTRIBUTED_FOR_QUALITY * 50,
  )

  const withLeads = scored.filter((r) => r.leads > 0)
  if (withLeads.length < 2) {
    return spentNothingBack
      ? {
          kind: 'placementStop',
          subject,
          responses: executable ? ['accept', 'later', 'recheck'] : ['later', 'recheck'],
          vars: { placement: spentNothingBack.label, spend: Math.round(spentNothingBack.spendAed) },
          ...(executable ? {} : { blocked: 'not_executable' as const }),
        }
      : null
  }

  const sorted = [...withLeads].sort((a, b) => (cplOf(a) ?? 0) - (cplOf(b) ?? 0))
  const cheap = sorted[0]
  const dear = sorted[sorted.length - 1]

  const vars = {
    best: cheap.label,
    worst: dear.label,
    bestCpl: Math.round(cplOf(cheap) ?? 0),
    worstCpl: Math.round(cplOf(dear) ?? 0),
    spend: Math.round(dear.spendAed),
  }

  // NOT YET DECIDABLE. Said out loud rather than hidden: a difference we can
  // see but cannot stand behind is worth knowing about, and the person may
  // choose to wait for it deliberately. Recheck only — no Accept on noise.
  if (!differenceIsReal(cheap, dear)) {
    return { kind: 'notYet', subject, responses: ['recheck'], vars, blocked: 'thin_evidence' }
  }

  return {
    kind: 'placementShift',
    subject,
    responses: executable ? ['accept', 'later', 'recheck'] : ['later', 'recheck'],
    vars,
    ...(executable ? {} : { blocked: 'not_executable' as const }),
  }
}

/**
 * How long a "Later" sleeps.
 *
 * Long enough that answering it again is not nagging, short enough that a
 * budget leak does not run for a week behind a snooze. A day of delivery is
 * also roughly the time it takes for the evidence to be worth re-reading.
 */
export const DEFER_MS = 24 * 60 * 60 * 1000

export const deferUntil = (nowMs: number): number => nowMs + DEFER_MS

/**
 * What happens when a deferred proposal's time is up.
 *
 * It does NOT simply reappear. The world moved while it slept — the placement
 * may have recovered, the campaign may have stopped — so it is re-measured
 * first, and if the reason has gone it withdraws instead of returning. A
 * proposal that comes back after the problem fixed itself is how people learn
 * to ignore the whole queue.
 */
export function wake(
  deferredAt: number, nowMs: number, stillTrue: boolean,
): ProposalState {
  if (nowMs - deferredAt < DEFER_MS) return 'deferred'
  return stillTrue ? 'open' : 'withdrawn'
}

/** Accept is offered only when the system can honour it. */
export const canAccept = (p: Proposal): boolean => p.responses.includes('accept')

/**
 * Recheck is always available — including on a proposal that has no Accept.
 * It is the only answer to "I do not believe you" that does not require the
 * product to be right, and withholding it is how a disputed finding becomes a
 * dismissed one.
 */
export const canRecheck = (p: Proposal): boolean => p.responses.includes('recheck')
