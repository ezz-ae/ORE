// Demo data for Meta Ads routes — returned (flagged `demo: true`) when
// credentials are not configured, so the UI renders fully populated.
// Numbers are realistic for a Dubai real-estate agency: AED spend in the
// hundreds-to-thousands, leads in the tens. Budgets/spend are in the smallest
// currency unit handling expected by the UI (spend strings in AED, daily_budget
// in fils where 50000 = AED 500).

import type { MetaCampaign, MetaInsights, MetaLeadForm } from './types'

// The campaigns route returns each campaign with an `insights` field attached
// (MetaInsights | null). Mirror that exact shape here.
export type MetaCampaignWithInsights = MetaCampaign & { insights: MetaInsights | null }

function insights(
  impressions: number,
  clicks: number,
  spend: number,
  leads: number,
): MetaInsights {
  const cpc = clicks ? spend / clicks : 0
  const cpm = impressions ? (spend / impressions) * 1000 : 0
  return {
    impressions: String(impressions),
    clicks: String(clicks),
    spend: spend.toFixed(2),
    actions: [
      { action_type: 'lead', value: String(leads) },
      { action_type: 'link_click', value: String(clicks) },
    ],
    cpc: cpc.toFixed(2),
    cpm: cpm.toFixed(2),
    date_start: '2026-06-01',
    date_stop: '2026-06-07',
  }
}

export const demoCampaigns: MetaCampaignWithInsights[] = [
  {
    id: '120210000000001',
    name: 'Palm Jumeirah — Lead Gen (Investors)',
    status: 'ACTIVE',
    objective: 'LEAD_GENERATION',
    daily_budget: '60000', // AED 600
    created_time: '2026-04-02T08:14:00+0400',
    start_time: '2026-04-03T00:00:00+0400',
    insights: insights(184320, 4210, 11840.5, 96),
  },
  {
    id: '120210000000002',
    name: 'Dubai Hills Villas — Lead Gen',
    status: 'ACTIVE',
    objective: 'LEAD_GENERATION',
    daily_budget: '50000', // AED 500
    created_time: '2026-03-18T10:02:00+0400',
    start_time: '2026-03-19T00:00:00+0400',
    insights: insights(142500, 3380, 9420.0, 74),
  },
  {
    id: '120210000000003',
    name: 'Downtown Off-Plan — Lead Gen',
    status: 'ACTIVE',
    objective: 'LEAD_GENERATION',
    daily_budget: '45000', // AED 450
    created_time: '2026-04-21T09:30:00+0400',
    start_time: '2026-04-22T00:00:00+0400',
    insights: insights(121800, 2890, 7650.75, 61),
  },
  {
    id: '120210000000004',
    name: 'Golden Visa Property — Lead Gen',
    status: 'ACTIVE',
    objective: 'LEAD_GENERATION',
    daily_budget: '40000', // AED 400
    created_time: '2026-05-05T11:45:00+0400',
    start_time: '2026-05-06T00:00:00+0400',
    insights: insights(98600, 2140, 6120.25, 47),
  },
  {
    id: '120210000000005',
    name: 'Business Bay Apartments — Lead Gen',
    status: 'PAUSED',
    objective: 'LEAD_GENERATION',
    daily_budget: '35000', // AED 350
    created_time: '2026-02-10T08:00:00+0400',
    start_time: '2026-02-11T00:00:00+0400',
    stop_time: '2026-05-20T00:00:00+0400',
    insights: null,
  },
  {
    id: '120210000000006',
    name: 'Dubai Marina Luxury — Lead Gen',
    status: 'PAUSED',
    objective: 'LEAD_GENERATION',
    daily_budget: '55000', // AED 550
    created_time: '2026-01-22T14:20:00+0400',
    start_time: '2026-01-23T00:00:00+0400',
    stop_time: '2026-04-30T00:00:00+0400',
    insights: null,
  },
]

export const demoForms: MetaLeadForm[] = [
  {
    id: '610000000000001',
    name: 'Palm Jumeirah — Investor Enquiry',
    status: 'ACTIVE',
    leads_count: 96,
    created_time: '2026-04-02T08:20:00+0400',
    locale: 'en_US',
    follow_up_action_url: 'https://example-realty.ae/palm-jumeirah',
    questions: [
      { type: 'FULL_NAME', label: 'Full name', id: 'full_name' },
      { type: 'EMAIL', label: 'Email', id: 'email' },
      { type: 'PHONE', label: 'Phone number', id: 'phone_number' },
    ],
  },
  {
    id: '610000000000002',
    name: 'Dubai Hills Villas — Brochure Request',
    status: 'ACTIVE',
    leads_count: 74,
    created_time: '2026-03-18T10:10:00+0400',
    locale: 'en_US',
    follow_up_action_url: 'https://example-realty.ae/dubai-hills',
    questions: [
      { type: 'FULL_NAME', label: 'Full name', id: 'full_name' },
      { type: 'EMAIL', label: 'Email', id: 'email' },
      { type: 'PHONE', label: 'Phone number', id: 'phone_number' },
    ],
  },
  {
    id: '610000000000003',
    name: 'Downtown Off-Plan — Price List',
    status: 'ACTIVE',
    leads_count: 61,
    created_time: '2026-04-21T09:40:00+0400',
    locale: 'en_US',
    follow_up_action_url: 'https://example-realty.ae/downtown',
    questions: [
      { type: 'FULL_NAME', label: 'Full name', id: 'full_name' },
      { type: 'PHONE', label: 'Phone number', id: 'phone_number' },
    ],
  },
  {
    id: '610000000000004',
    name: 'Golden Visa — Eligibility Check',
    status: 'ACTIVE',
    leads_count: 47,
    created_time: '2026-05-05T11:55:00+0400',
    locale: 'en_US',
    follow_up_action_url: 'https://example-realty.ae/golden-visa',
    questions: [
      { type: 'FULL_NAME', label: 'Full name', id: 'full_name' },
      { type: 'EMAIL', label: 'Email', id: 'email' },
      { type: 'PHONE', label: 'Phone number', id: 'phone_number' },
    ],
  },
  {
    id: '610000000000005',
    name: 'Business Bay — Investor Enquiry',
    status: 'ARCHIVED',
    leads_count: 38,
    created_time: '2026-02-10T08:10:00+0400',
    locale: 'en_US',
    follow_up_action_url: 'https://example-realty.ae/business-bay',
    questions: [
      { type: 'FULL_NAME', label: 'Full name', id: 'full_name' },
      { type: 'EMAIL', label: 'Email', id: 'email' },
      { type: 'PHONE', label: 'Phone number', id: 'phone_number' },
    ],
  },
]
