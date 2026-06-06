/**
 * Broker Credit Economy
 * ─────────────────────
 * Freehold does not buy ads or hand out leads directly. Instead the company
 * funds each broker with a CREDIT budget. The broker self-serves AI-generated
 * ads (pick a project → next → next → live), and every impression/lead is
 * billed against their credit balance. Leads land in the broker's own CRM on
 * the server; WhatsApp runs through the server (WhatsApp-Web style) so the AI
 * can scan every conversation — but the ads always run from the company account.
 *
 * When credits run low, the AI computes the ROI of the company's investment in
 * that broker's ads, and refills based on the broker's strength (closing rate +
 * CRM attention). Strong brokers get bigger, better-targeted budgets; weak ones
 * get coaching instead of cash. This replaces the classic 50/50, no-salary model
 * with a measurable, self-funding performance loop.
 *
 * All credit figures map to real money via CREDIT_VALUE_AED, which is what makes
 * the Credits dashboard a true finance instrument.
 */

/** 1 credit = AED of ad spend the company has funded. */
export const CREDIT_VALUE_AED = 10

export type BrokerTier = 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

export interface BrokerCredit {
  id: string
  name: string
  initials: string
  phone: string
  tier: BrokerTier
  /** Project the broker has "studied" inside the server and advertises. */
  focusProject: string

  // ── credit economy (this cycle) ──
  allocated: number          // credits funded by the company this cycle
  spent: number              // credits consumed by live ads

  // ── performance (attributed to this broker's self-served ads) ──
  leads: number              // leads generated into the broker's CRM
  conversations: number      // WhatsApp threads the AI scanned
  deals: number              // deals closed
  revenue: number            // AED commission/revenue from those deals
  crmAttention: number       // 0–100: response speed + follow-up discipline
  activeAds: number
  whatsappConnected: boolean
  lastActive: string         // ISO

  cycleStart: string         // ISO
  cycleEnd: string           // ISO
}

// ─── Mock roster — varied performance so the analytics are meaningful ──────────

export const brokerCredits: BrokerCredit[] = [
  {
    id: 'bc_ahmed', name: 'Ahmad Khalil', initials: 'AK', phone: '+971 50 118 2204',
    tier: 'Gold', focusProject: 'Dubai Hills Estate',
    allocated: 2000, spent: 1640, leads: 41, conversations: 128, deals: 4, revenue: 312000,
    crmAttention: 88, activeAds: 3, whatsappConnected: true, lastActive: '2026-06-06T08:15:00Z',
    cycleStart: '2026-06-01', cycleEnd: '2026-06-30',
  },
  {
    id: 'bc_sara', name: 'Sara Al Mansoori', initials: 'SA', phone: '+971 52 904 7781',
    tier: 'Platinum', focusProject: 'Palm Jumeirah',
    allocated: 3000, spent: 2210, leads: 53, conversations: 174, deals: 6, revenue: 540000,
    crmAttention: 94, activeAds: 4, whatsappConnected: true, lastActive: '2026-06-06T09:02:00Z',
    cycleStart: '2026-06-01', cycleEnd: '2026-06-30',
  },
  {
    id: 'bc_fatima', name: 'Fatima Hassan', initials: 'FH', phone: '+971 55 612 3390',
    tier: 'Silver', focusProject: 'Business Bay',
    allocated: 1500, spent: 1180, leads: 34, conversations: 96, deals: 2, revenue: 156000,
    crmAttention: 72, activeAds: 2, whatsappConnected: true, lastActive: '2026-06-05T17:40:00Z',
    cycleStart: '2026-06-01', cycleEnd: '2026-06-30',
  },
  {
    id: 'bc_omar', name: 'Omar Al Rashid', initials: 'OR', phone: '+971 50 778 1142',
    tier: 'Silver', focusProject: 'Dubai Marina',
    allocated: 1500, spent: 1490, leads: 38, conversations: 71, deals: 1, revenue: 64000,
    crmAttention: 51, activeAds: 2, whatsappConnected: false, lastActive: '2026-06-04T12:10:00Z',
    cycleStart: '2026-06-01', cycleEnd: '2026-06-30',
  },
  {
    id: 'bc_layla', name: 'Layla Nasser', initials: 'LN', phone: '+971 56 220 9985',
    tier: 'Bronze', focusProject: 'JVC',
    allocated: 1000, spent: 430, leads: 12, conversations: 28, deals: 1, revenue: 58000,
    crmAttention: 80, activeAds: 1, whatsappConnected: true, lastActive: '2026-06-06T07:30:00Z',
    cycleStart: '2026-06-01', cycleEnd: '2026-06-30',
  },
  {
    id: 'bc_hassan', name: 'Hassan Al Ali', initials: 'HA', phone: '+971 54 331 6620',
    tier: 'Starter', focusProject: 'Arjan',
    allocated: 600, spent: 590, leads: 19, conversations: 22, deals: 0, revenue: 0,
    crmAttention: 38, activeAds: 1, whatsappConnected: false, lastActive: '2026-06-03T15:05:00Z',
    cycleStart: '2026-06-01', cycleEnd: '2026-06-30',
  },
]

// ─── Derived finance metrics ───────────────────────────────────────────────────

export interface BrokerCreditMetrics extends BrokerCredit {
  remaining: number
  spentPct: number          // % of allocation consumed
  investedAed: number       // company money spent on this broker's ads
  costPerLead: number       // AED
  costPerDeal: number       // AED (0 if no deals)
  closingRate: number       // % deals / leads
  roi: number               // revenue / investedAed (× multiplier)
  roiPct: number            // ((revenue - invested) / invested) × 100
  efficiency: number        // 0–100 composite (ROI + closing + CRM attention)
  status: 'thriving' | 'healthy' | 'watch' | 'underfunded' | 'at_risk'
  recommendedRefill: number // AI-suggested next allocation
  recommendation: string    // short human reason
}

function clamp(n: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)) }

export function computeMetrics(b: BrokerCredit): BrokerCreditMetrics {
  const remaining   = Math.max(0, b.allocated - b.spent)
  const spentPct    = b.allocated > 0 ? (b.spent / b.allocated) * 100 : 0
  const investedAed = b.spent * CREDIT_VALUE_AED
  const costPerLead = b.leads > 0 ? investedAed / b.leads : 0
  const costPerDeal = b.deals > 0 ? investedAed / b.deals : 0
  const closingRate = b.leads > 0 ? (b.deals / b.leads) * 100 : 0
  const roi         = investedAed > 0 ? b.revenue / investedAed : 0
  const roiPct      = investedAed > 0 ? ((b.revenue - investedAed) / investedAed) * 100 : 0

  // Composite efficiency: weight ROI, closing rate, and CRM attention.
  const roiScore   = clamp((roi / 20) * 100)          // 20× ROI ≈ full marks
  const closeScore = clamp(closingRate * 8)           // ~12.5% close ≈ full marks
  const efficiency = Math.round(clamp(roiScore * 0.45 + closeScore * 0.3 + b.crmAttention * 0.25))

  // Status from efficiency + how depleted the budget is.
  let status: BrokerCreditMetrics['status']
  if (efficiency >= 75) status = spentPct >= 85 ? 'underfunded' : 'thriving'
  else if (efficiency >= 55) status = 'healthy'
  else if (efficiency >= 38) status = 'watch'
  else status = 'at_risk'

  // AI refill: scale the next budget by efficiency. Strong → more, weak → coaching.
  let recommendedRefill: number
  let recommendation: string
  if (efficiency >= 75) {
    recommendedRefill = Math.round((b.allocated * 1.5) / 100) * 100
    recommendation = `Top performer — ${roi.toFixed(1)}× ROI. Increase budget and widen targeting to lookalikes of closed buyers.`
  } else if (efficiency >= 55) {
    recommendedRefill = Math.round(b.allocated / 100) * 100
    recommendation = `Solid and profitable. Maintain budget; nudge follow-up speed to lift closing rate.`
  } else if (efficiency >= 38) {
    recommendedRefill = Math.round((b.allocated * 0.6) / 100) * 100
    recommendation = `Leads are coming but not closing. Reduce budget, tighten audience, add a WhatsApp script.`
  } else {
    recommendedRefill = b.whatsappConnected ? Math.round((b.allocated * 0.3) / 100) * 100 : 0
    recommendation = b.whatsappConnected
      ? `Burning credits with weak return. Pause new spend; coaching before next refill.`
      : `No WhatsApp connected and zero deals — hold refill until the server WhatsApp link is active.`
  }

  return {
    ...b, remaining, spentPct, investedAed, costPerLead, costPerDeal,
    closingRate, roi, roiPct, efficiency, status, recommendedRefill, recommendation,
  }
}

export const brokerMetrics: BrokerCreditMetrics[] = brokerCredits.map(computeMetrics)

// ─── Portfolio-level rollup (the finance view) ─────────────────────────────────

export interface CreditPortfolio {
  brokers: number
  allocated: number
  spent: number
  remaining: number
  investedAed: number
  revenue: number
  leads: number
  deals: number
  conversations: number
  blendedRoi: number        // total revenue / total invested
  blendedRoiPct: number
  avgCostPerLead: number
  avgCostPerDeal: number
  recommendedNextCycle: number // sum of AI refills (credits)
}

export function creditPortfolio(metrics = brokerMetrics): CreditPortfolio {
  const allocated   = metrics.reduce((s, m) => s + m.allocated, 0)
  const spent       = metrics.reduce((s, m) => s + m.spent, 0)
  const investedAed = metrics.reduce((s, m) => s + m.investedAed, 0)
  const revenue     = metrics.reduce((s, m) => s + m.revenue, 0)
  const leads       = metrics.reduce((s, m) => s + m.leads, 0)
  const deals       = metrics.reduce((s, m) => s + m.deals, 0)
  const conversations = metrics.reduce((s, m) => s + m.conversations, 0)
  const recommendedNextCycle = metrics.reduce((s, m) => s + m.recommendedRefill, 0)

  return {
    brokers: metrics.length,
    allocated,
    spent,
    remaining: allocated - spent,
    investedAed,
    revenue,
    leads,
    deals,
    conversations,
    blendedRoi: investedAed > 0 ? revenue / investedAed : 0,
    blendedRoiPct: investedAed > 0 ? ((revenue - investedAed) / investedAed) * 100 : 0,
    avgCostPerLead: leads > 0 ? investedAed / leads : 0,
    avgCostPerDeal: deals > 0 ? investedAed / deals : 0,
    recommendedNextCycle,
  }
}

export const TIER_CREDIT: Record<BrokerTier, string> = {
  Starter:  'text-slate-300   bg-slate-800/50   border-slate-600',
  Bronze:   'text-orange-400  bg-orange-400/10  border-orange-400/25',
  Silver:   'text-slate-200   bg-slate-700/40   border-slate-500',
  Gold:     'text-[#D4AF37]   bg-[#D4AF37]/10   border-[#D4AF37]/25',
  Platinum: 'text-violet-300  bg-violet-400/10  border-violet-400/25',
}

export const STATUS_CREDIT: Record<BrokerCreditMetrics['status'], { label: string; cls: string }> = {
  thriving:    { label: 'Thriving',    cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25' },
  healthy:     { label: 'Healthy',     cls: 'text-sky-400 bg-sky-400/10 border-sky-400/25' },
  watch:       { label: 'Watch',       cls: 'text-amber-400 bg-amber-400/10 border-amber-400/25' },
  underfunded: { label: 'Underfunded', cls: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/25' },
  at_risk:     { label: 'At risk',     cls: 'text-red-400 bg-red-400/10 border-red-400/25' },
}
