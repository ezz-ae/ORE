/**
 * CASH — the money vocabulary shared by server (credits-db.ts) and client pages.
 * Kept free of server-only imports so 'use client' components can import it.
 *
 * ── ONE CASH IS ONE DIRHAM ───────────────────────────────────────────────
 *
 * The unit used to be a "credit" worth AED 10, and that was two mistakes in one
 * number. It made every balance a translation exercise — a broker holding 40 of
 * something had to be told what the something was worth before they knew
 * whether they could afford a campaign — and "credit" is arcade vocabulary for
 * a system that moves real company money through real ad accounts.
 *
 * So the unit is CASH and the rate is 1:1. A balance of 400 is AED 400. There
 * is nothing to convert, nothing to explain, and no screen can be wrong about
 * the rate because there is no rate.
 *
 * The rate constant stays (as 1) rather than being deleted: it is the one place
 * that states the identity, the guard suite asserts it, and every arithmetic
 * site keeps a name to point at instead of a bare literal that a later change
 * could not find.
 *
 * WHEN THIS CHANGED, EVERY UNIT-DENOMINATED CONSTANT BELOW MOVED WITH IT
 * (×10), and every stored balance was scaled by a one-off ledger adjustment —
 * see `redenominateToCash` in credits-db.ts. Changing the rate without moving
 * the constants would have silently cut the product's economics to a tenth;
 * changing it without the ledger adjustment would have devalued every account
 * anybody had already earned.
 */

/** Real tier vocabulary — matches broker_credit_accounts.tier. */
export const CREDIT_TIERS = ['Starter', 'Growth', 'Pro', 'Elite'] as const
export type CreditTier = (typeof CREDIT_TIERS)[number]

/**
 * Monthly Cash quota per tier, in dirhams — the single source of truth for UI
 * and server.
 *
 * The numbers are COMMERCIAL TERMS, not derived from any platform constraint:
 * they are what each subscription tier buys, set by whoever owns Freehold's
 * pricing. There is nothing in the code to balance them against — change them
 * only on a pricing decision, and expect brokers to notice: the grant job
 * tops accounts up to these values every month.
 *
 * These are the SAME commercial terms as the 12/18/25/40 credits they replaced —
 * ten times the number because a unit is now a tenth of what it was. AED 120 to
 * AED 400 of monthly ad budget, unchanged in money.
 */
export const TIER_MONTHLY_QUOTA: Record<CreditTier, number> = {
  Starter: 120,
  Growth: 180,
  Pro: 250,
  Elite: 400,
}

export const isCreditTier = (value: unknown): value is CreditTier =>
  typeof value === 'string' && (CREDIT_TIERS as readonly string[]).includes(value)

/**
 * ONE CASH IS ONE DIRHAM.
 *
 * Kept as a named constant rather than deleted so the identity has a place to
 * be stated, asserted (points-test.ts) and pointed at. It is not a knob: moving
 * it re-denominates the whole product, and doing that requires moving every
 * constant in this file and running `redenominateToCash` again with a new
 * reference. See the module header.
 */
export const CREDIT_VALUE_AED = 1

/**
 * A ledger amount in dirhams.
 *
 * The ledger counts whole units because an INTEGER column is what makes the
 * balance safe: no rounding, no drift, no fractional movement Postgres can
 * quietly halve. At 1:1 that also means the stored number IS the dirham figure,
 * which is the whole point of the re-denomination — the storage and the
 * vocabulary finally agree, and there is no translation left to get wrong.
 */
export const aedOf = (units: number): number =>
  Number.isFinite(units) ? Math.round(units * CREDIT_VALUE_AED) : 0

/**
 * A balance as it is written on screen.
 *
 * "Cash", not "AED", and the difference is deliberate: this is company money a
 * person may spend THROUGH the system — on ads, and on what the bank pays out —
 * and writing it as plain AED beside a bank balance invites somebody to read it
 * as money they can withdraw at an ATM. Cash is the word the bank screen, the
 * wallet and the broker's own page all use, and it is worth exactly a dirham.
 */
export const cashText = (units: number): string =>
  `Cash ${aedOf(units).toLocaleString('en-US')}`

/**
 * Cash reserved for a campaign launch, for EVERY ad platform.
 *
 * One derivation, one rate: Meta and Google must charge a broker the same for
 * the same funded budget, so neither route re-derives the conversion of its own.
 * At 1:1 the daily budget IS the charge, which is the answer a broker would
 * give if you asked them — AED 300 a day costs 300. Whole units only (the
 * ledger column is INTEGER), minimum 1 — a funded campaign is never free.
 *
 * Returns 0 for a non-finite budget so a malformed payload can never produce a
 * NaN charge; every caller must still reject a non-numeric budget BEFORE this
 * point (0 = no reservation = a free launch, which is the bug this
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

/**
 * Earn rule: 1 Cash per AED 100 of broker net commission, minimum 1.
 *
 * The same commercial rate as the credit it replaced (1 credit — AED 10 — per
 * AED 1,000). A broker who closes on AED 50,000 of net commission earns 500
 * Cash, which is AED 500 of ad budget: one percent of what they made, back into
 * finding the next buyer.
 */
export const EARN_AED_PER_CREDIT = 100

export const creditsEarnedForCommission = (brokerTotalAED: number): number => {
  if (!Number.isFinite(brokerTotalAED)) return 1
  return Math.max(1, Math.round(brokerTotalAED / EARN_AED_PER_CREDIT))
}

/**
 * Sanity ceiling for a single ledger movement — AED 10,000,000.
 *
 * Not an economic rule and not a permission: a fail-closed guard so a typo or a
 * malformed payload can never write an absurd amount into the ledger. It is ten
 * times the old number because a unit is a tenth of the old unit — the ceiling
 * in MONEY is unchanged, which is the only reading of it that means anything.
 */
export const MAX_CREDIT_AMOUNT = 10_000_000

/**
 * How much bigger the new unit count is than the old one.
 *
 * The old unit was a "credit" worth AED 10; the new unit is Cash worth AED 1.
 * The MONEY did not change — a broker who held 40 credits held AED 400 then and
 * holds 400 Cash now. Ten is that fact and nothing else: it is the old
 * CREDIT_VALUE_AED divided by the new one, and every constant in this file was
 * multiplied by it.
 */
export const REDENOMINATION_FACTOR = 10

/**
 * The idempotency key of the one-off balance migration (`redenominateToCash`).
 *
 * It carries a VERSION because a second re-denomination would need its own key
 * and its own cutoff — reusing this one would silently do nothing, which is the
 * worst outcome available to a money migration: it reports success while every
 * balance stays a tenth of what it should be.
 */
export const REDENOMINATION_REFERENCE = 'redenominate:cash-1aed-v1'

/**
 * Every movement is a WHOLE, POSITIVE, finite number of Cash. The ledger column
 * is INTEGER, so a float would be silently rounded by Postgres and a negative
 * would invert the sign convention (a negative 'spend' ADDS money). Validated
 * at the library boundary, not just in the API routes.
 */
export const isValidCreditAmount = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value > 0 &&
  value <= MAX_CREDIT_AMOUNT
