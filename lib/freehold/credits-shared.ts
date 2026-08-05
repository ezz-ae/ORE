/**
 * Credit economy vocabulary shared by server (credits-db.ts) and client pages.
 * Kept free of server-only imports so 'use client' components can import it.
 */

/** Real tier vocabulary — matches broker_credit_accounts.tier. */
export const CREDIT_TIERS = ['Starter', 'Growth', 'Pro', 'Elite'] as const
export type CreditTier = (typeof CREDIT_TIERS)[number]

/** Monthly credit quota per tier — the single source of truth for UI + server. */
export const TIER_MONTHLY_QUOTA: Record<CreditTier, number> = {
  Starter: 12,
  Growth: 18,
  Pro: 25,
  Elite: 40,
}

export const isCreditTier = (value: unknown): value is CreditTier =>
  typeof value === 'string' && (CREDIT_TIERS as readonly string[]).includes(value)

/** 1 credit = AED 10 of funded ad spend (matches the Meta launch deduction:
 *  creditsToSpend = dailyBudgetAED / 10). */
export const CREDIT_VALUE_AED = 10

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
