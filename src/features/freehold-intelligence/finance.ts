// Finance & billing data for the intelligence platform

export interface AdSpendRecord {
  platform: 'meta' | 'google'
  campaignId: string
  campaignName: string
  date: string
  spendAED: number
  impressions: number
  clicks: number
  leads: number
  cpl: number // cost per lead
}

export interface MonthlyBudget {
  platform: 'meta' | 'google' | 'total'
  month: string
  budgetAED: number
  spentAED: number
  leadsGenerated: number
  avgCpl: number
}

export interface Invoice {
  id: string
  platform: 'meta' | 'google'
  period: string
  amountAED: number
  status: 'paid' | 'pending' | 'overdue' | 'processing'
  dueDate: string
  issuedDate: string
}

export interface FinanceSummary {
  currentMonthSpendMeta: number
  currentMonthSpendGoogle: number
  totalSpend30d: number
  totalLeads30d: number
  avgCpl30d: number
  metaBudgetAED: number
  googleBudgetAED: number
  totalBudgetAED: number
  budgetUtilizationMeta: number  // 0..1
  budgetUtilizationGoogle: number
  monthlyHistory: MonthlyBudget[]
  invoices: Invoice[]
  topSpendCampaigns: { name: string; platform: 'meta' | 'google'; spendAED: number; leads: number; cpl: number }[]
}

export const financeSummary: FinanceSummary = {
  currentMonthSpendMeta:   18_420,
  currentMonthSpendGoogle: 12_870,
  totalSpend30d:           31_290,
  totalLeads30d:           415,
  avgCpl30d:               75.4,
  metaBudgetAED:           25_000,
  googleBudgetAED:         18_000,
  totalBudgetAED:          43_000,
  budgetUtilizationMeta:   0.737,
  budgetUtilizationGoogle: 0.715,

  monthlyHistory: [
    { platform: 'total',  month: 'Jan 2026', budgetAED: 40_000, spentAED: 36_120, leadsGenerated: 398, avgCpl: 90.7 },
    { platform: 'total',  month: 'Feb 2026', budgetAED: 40_000, spentAED: 38_440, leadsGenerated: 421, avgCpl: 91.3 },
    { platform: 'total',  month: 'Mar 2026', budgetAED: 43_000, spentAED: 41_210, leadsGenerated: 449, avgCpl: 91.8 },
    { platform: 'total',  month: 'Apr 2026', budgetAED: 43_000, spentAED: 39_880, leadsGenerated: 462, avgCpl: 86.3 },
    { platform: 'total',  month: 'May 2026', budgetAED: 43_000, spentAED: 31_290, leadsGenerated: 415, avgCpl: 75.4 },
    { platform: 'meta',   month: 'May 2026', budgetAED: 25_000, spentAED: 18_420, leadsGenerated: 248, avgCpl: 74.3 },
    { platform: 'google', month: 'May 2026', budgetAED: 18_000, spentAED: 12_870, leadsGenerated: 167, avgCpl: 77.1 },
  ],

  invoices: [
    { id: 'INV-META-0526', platform: 'meta',   period: 'May 2026',   amountAED: 18_420, status: 'processing', dueDate: '2026-06-05', issuedDate: '2026-06-01' },
    { id: 'INV-GGL-0526',  platform: 'google', period: 'May 2026',   amountAED: 12_870, status: 'processing', dueDate: '2026-06-05', issuedDate: '2026-06-01' },
    { id: 'INV-META-0426', platform: 'meta',   period: 'Apr 2026',   amountAED: 23_210, status: 'paid',       dueDate: '2026-05-05', issuedDate: '2026-05-01' },
    { id: 'INV-GGL-0426',  platform: 'google', period: 'Apr 2026',   amountAED: 16_670, status: 'paid',       dueDate: '2026-05-05', issuedDate: '2026-05-01' },
    { id: 'INV-META-0326', platform: 'meta',   period: 'Mar 2026',   amountAED: 24_100, status: 'paid',       dueDate: '2026-04-05', issuedDate: '2026-04-01' },
    { id: 'INV-GGL-0326',  platform: 'google', period: 'Mar 2026',   amountAED: 17_110, status: 'paid',       dueDate: '2026-04-05', issuedDate: '2026-04-01' },
  ],

  topSpendCampaigns: [
    { name: 'Palm Jumeirah Investor — META',         platform: 'meta',   spendAED: 7_820, leads: 94,  cpl: 83.2 },
    { name: 'Dubai Hills Yield — META',              platform: 'meta',   spendAED: 6_140, leads: 88,  cpl: 69.8 },
    { name: 'Golden Visa Buyers — META',             platform: 'meta',   spendAED: 4_460, leads: 66,  cpl: 67.6 },
    { name: 'Palm Jumeirah Investor — Search',       platform: 'google', spendAED: 5_210, leads: 62,  cpl: 84.0 },
    { name: 'Dubai Property Investment — PMax',      platform: 'google', spendAED: 4_380, leads: 58,  cpl: 75.5 },
    { name: 'Off Plan Dubai 2025 — Search',          platform: 'google', spendAED: 3_280, leads: 47,  cpl: 69.8 },
  ],
}
