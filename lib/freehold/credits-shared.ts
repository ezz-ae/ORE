/**
 * Credit economy vocabulary shared by server (credits-db.ts) and client pages.
 * Kept free of server-only imports so 'use client' components can import it.
 */

/** Real tier vocabulary — matches broker_credit_accounts.tier. */
export const CREDIT_TIERS = ['Starter', 'Growth', 'Pro', 'Elite'] as const
export type CreditTier = (typeof CREDIT_TIERS)[number]

/**
 * Monthly credit quota per tier — the single source of truth for UI + server.
 *
 * The numbers are COMMERCIAL TERMS, not derived from any platform constraint:
 * they are what each subscription tier buys, set by whoever owns Freehold's
 * pricing. There is nothing in the code to balance them against — change them
 * only on a pricing decision, and expect brokers to notice: the grant job
 * tops accounts up to these values every month.
 */
export const TIER_MONTHLY_QUOTA: Record<CreditTier, number> = {
  Starter: 12,
  Growth: 18,
  Pro: 25,
  Elite: 40,
}

export const isCreditTier = (value: unknown): value is CreditTier =>
  typeof value === 'string' && (CREDIT_TIERS as readonly string[]).includes(value)

/** 1 credit = AED 10 of funded ad spend (matches the launch deduction:
 *  creditsToSpend = dailyBudgetAED / CREDIT_VALUE_AED). */
export const CREDIT_VALUE_AED = 10

/**
 * WHAT A LEDGER UNIT IS WORTH, IN THE MONEY PEOPLE THINK IN.
 *
 * The ledger counts whole units because an INTEGER column is what makes the
 * balance safe: no rounding, no drift, no fractional movement Postgres can
 * quietly halve. That is a storage decision and it should never have been a
 * VOCABULARY decision.
 *
 * "You earned 4 points" is a token. "You earned AED 40 of ad spend" is the same
 * fact in the currency the person actually works in, and it is TEN TIMES the
 * number — a unit is AED 10, so calling a unit a dirham would understate every
 * balance in the product by an order of magnitude.
 *
 * So the unit stays the storage and this is the display. Everything a broker
 * reads goes through here.
 */
export const aedOf = (units: number): number =>
  Number.isFinite(units) ? Math.round(units * CREDIT_VALUE_AED) : 0

/**
 * The AED figure as it is written on screen.
 *
 * Always "of ad spend" at the call site, never bare: this is advertising budget
 * a broker has earned the right to spend, not cash they can withdraw, and a
 * bare "AED 400" beside a balance invites exactly that misreading.
 */
export const aedText = (units: number): string =>
  `AED ${aedOf(units).toLocaleString('en-US')}`

/**
 * Credits reserved for a campaign launch, for EVERY ad platform.
 *
 * One derivation, one rate: Meta and Google must charge a broker the same for
 * the same funded budget, so neither route re-derives "/ 10" of its own. Whole
 * credits only (the ledger column is INTEGER), minimum 1 — a funded campaign is
 * never free.
 *
 * Returns 0 for a non-finite budget so a malformed payload can never produce a
 * NaN charge; every caller must still reject a non-numeric budget BEFORE this
 * point (0 credits = no reservation = a free launch, which is the bug this
 * guard exists to make loud rather than to paper over).
 */
export const creditsForDailyBudget = (dailyBudgetAED: number): number =>
  Number.isFinite(dailyBudgetAED)
    ? Math.max(1, Math.round(dailyBudgetAED / CREDIT_VALUE_AED))
    : 0

/**
 * Ledger reference prefix for the monthly tier grant: `cycle:YYYY-MM`.
 *
 * This IS the idempotency key of the monthly quota — combined with the unique
 * index on (broker_id, type, reference), a calendar month can be granted to a
 * broker exactly once, however many times the rollover is attempted.
 */
export const CYCLE_REFERENCE_PREFIX = 'cycle:'

/** True for a ledger row written by the monthly tier grant. */
export const isCycleGrantReference = (reference: string | null | undefined): boolean =>
  typeof reference === 'string' && reference.startsWith(CYCLE_REFERENCE_PREFIX)

/** Earn rule: 1 credit per AED 1,000 of broker net commission, minimum 1. */
export const EARN_AED_PER_CREDIT = 1000

export const creditsEarnedForCommission = (brokerTotalAED: number): number => {
  if (!Number.isFinite(brokerTotalAED)) return 1
  return Math.max(1, Math.round(brokerTotalAED / EARN_AED_PER_CREDIT))
}

/**
 * Sanity ceiling for a single ledger movement (1,000,000 credits = AED 10M of
 * funded ad spend). Not an economic rule — a fail-closed guard so a typo or a
 * malformed payload can never write an absurd amount into the ledger.
 */
export const MAX_CREDIT_AMOUNT = 1_000_000

/**
 * Every credit movement is a WHOLE, POSITIVE, finite number of credits. The
 * ledger column is INTEGER, so a float would be silently rounded by Postgres
 * and a negative would invert the sign convention (a negative 'spend' ADDS
 * credits). Validated at the library boundary, not just in the API routes.
 */
export const isValidCreditAmount = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= MAX_CREDIT_AMOUNT
