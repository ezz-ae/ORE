import type { GoogleReportSummary } from './types'

// The demo campaign/keyword/report arrays that used to live here are gone —
// nothing in the product renders sample Google data anymore. What remains is
// the honest all-zeros report shape used while no account is connected.

export function emptyReport(range: '7d' | '30d' | '90d'): GoogleReportSummary {
  return {
    dateRange: range,
    totalImpressions: 0,
    totalClicks: 0,
    totalCostMicros: 0,
    totalConversions: 0,
    avgCtr: 0,
    avgCpcMicros: 0,
    byDay: [],
    byDevice: [],
    byCampaign: [],
    searchTerms: [],
  }
}
