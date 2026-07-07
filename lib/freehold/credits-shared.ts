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

export const creditsEarnedForCommission = (brokerTotalAED: number): number =>
  Math.max(1, Math.round(brokerTotalAED / EARN_AED_PER_CREDIT))
