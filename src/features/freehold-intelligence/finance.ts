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
  topSpendCampaigns: {
    name: string
    platform: 'meta' | 'google'
    spendAED: number
    leads: number
    cpl: number
    campaignId: string
    projectId: string | null
    landingId: string | null
    status: 'Running' | 'Paused' | 'Blocked'
  }[]
}

// The seed financeSummary/adSpend/invoice data was removed for handover —
// finance surfaces read the live deals/finance APIs. Types only.
