/**
 * HIGHER INTENT WAS A SWITCH NOBODY DECIDED.
 *
 * Meta's instant form has two modes. "More volume" submits on one tap; "higher
 * intent" adds a review step the person has to confirm. The trade is real and
 * it is not close on every product: the review step costs perhaps a third of
 * the submissions and removes most of the ones that were a mis-tap.
 *
 * `isOptimizedForQuality` was passed straight through from whatever the wizard
 * had toggled, and the form templates carry it as a hardcoded boolean per
 * template. So the decision was made by the shape of the FORM and never once
 * by the thing being sold — which is the only fact that settles it.
 *
 * WHAT SETTLES IT. A property handing over in six years cannot be bought by
 * somebody who needs somewhere to live; every lead on it is an investor lead,
 * and a form filled in idly by someone who liked a photo of a pool is worth
 * nothing at all, because there is no near-term product to sell them instead.
 * On ready stock the opposite holds — volume is genuinely useful, since a
 * casual enquiry can be shown something this month.
 *
 * THIS FUNCTION ONLY EVER TURNS IT ON. A template that asked for higher intent
 * keeps it: that is a stated intention about a specific form, and a derived
 * default has no business overruling one. The product can EARN higher intent;
 * it can never lose it here.
 *
 * Pure — no I/O, no clock. The caller computes the years, so a guard can prove
 * the rule without pinning a date. Runs in `pnpm guards`.
 */

import { OPERATION_TZ } from '@/lib/freehold/clock'

/** Walkable — the two modes Meta offers. */
export const FORM_INTENTS = ['higher', 'volume'] as const
export type FormIntent = (typeof FORM_INTENTS)[number]

/** Walkable — each renders its own sentence. */
export const FORM_INTENT_REASONS = [
  'farHandover', 'highTicket', 'nearTermStock', 'unknownProduct',
] as const
export type FormIntentReason = (typeof FORM_INTENT_REASONS)[number]

/**
 * Past this, the buyer is an investor and nothing else.
 *
 * Two years is the point where a purchase stops being able to answer "where do
 * I live next" for anybody. A shorter bar would sweep in near-term off-plan,
 * where an end-user genuinely is in the market and volume still pays.
 */
export const INVESTOR_HORIZON_YEARS = 2

/**
 * Past this, one wasted broker call costs more than the leads the review step
 * turns away.
 *
 * AED 2M is the market's own line — it is the Golden Visa threshold, so it is
 * where the buyer pool changes character rather than a number picked here. A
 * DEFAULT, stated as one: an account whose stock sits either side of it should
 * be reading its own closed deals instead, and this is what it gets until it
 * has some.
 */
export const HIGH_TICKET_AED = 2_000_000

export interface FormIntentRead {
  intent: FormIntent
  reason: FormIntentReason
}

/**
 * The default this product deserves.
 *
 * `yearsToHandover` null means the listing does not say when it hands over —
 * an absence of evidence, which never earns the stricter form. It comes back
 * as `unknownProduct` so a screen can say so rather than implying a judgement.
 */
export function chooseFormIntent(input: {
  yearsToHandover: number | null
  startingPriceAed: number | null
}): FormIntentRead {
  const years = typeof input.yearsToHandover === 'number' && Number.isFinite(input.yearsToHandover)
    ? input.yearsToHandover : null
  const price = typeof input.startingPriceAed === 'number' && Number.isFinite(input.startingPriceAed)
    && input.startingPriceAed > 0 ? input.startingPriceAed : null

  if (years !== null && years >= INVESTOR_HORIZON_YEARS) return { intent: 'higher', reason: 'farHandover' }
  if (price !== null && price >= HIGH_TICKET_AED) return { intent: 'higher', reason: 'highTicket' }
  // Known, near, and not expensive: a casual enquiry can be shown something
  // this month, so the volume is worth having.
  if (years !== null) return { intent: 'volume', reason: 'nearTermStock' }
  return { intent: 'volume', reason: 'unknownProduct' }
}

/**
 * What the form should actually be created with.
 *
 * The one-way rule, in one place so no caller can implement it backwards:
 * a template that asked for higher intent keeps it, whatever the product says.
 */
export function higherIntentFor(templateAsks: boolean, product: FormIntentRead): boolean {
  return templateAsks || product.intent === 'higher'
}

/**
 * Years from now until a handover YEAR.
 *
 * A year, not a date, because that is what the listings actually carry — and
 * the horizon test is measured in years, so a month's precision would be
 * spurious. Uses the current year in the operation's own timezone: computing
 * it in UTC is wrong for four hours a day and looks perfectly reasonable.
 */
export function yearsToHandover(handoverYear: number | null | undefined, now: Date = new Date()): number | null {
  if (typeof handoverYear !== 'number' || !Number.isFinite(handoverYear)) return null
  const thisYear = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATION_TZ, year: 'numeric',
  }).format(now))
  if (!Number.isFinite(thisYear)) return null
  return handoverYear - thisYear
}
