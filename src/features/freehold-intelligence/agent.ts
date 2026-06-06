// Agent-level universe — data model and Noura's profile

export type PipelineStage = 'new' | 'contacted' | 'qualified' | 'viewing' | 'offer' | 'closed' | 'lost'

export type WalletEntry = {
  id: string
  description: string
  project?: string
  amount: number // positive = owed to agent, negative = agent owes (campaign debit)
  type: 'commission' | 'bonus' | 'showing_fee' | 'campaign_debit'
  status: 'paid' | 'processing' | 'pending'
  date: string
}

export type Achievement = {
  id: string
  icon: string
  title: string
  description: string
  earned: boolean
  earnedAt?: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export type LeadPoolStatus = {
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  monthlyQuota: number
  used: number
  resetAt: string
  tierCriteria: string
}

export type ExpertiseEntry = {
  area: string
  level: 'Expert' | 'Strong' | 'Learning' | 'Untested'
  deals: number
  lastDeal?: string
}

export type AgentPipelineLead = {
  id: string
  name: string
  phone: string
  email?: string
  intentScore: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
  pipelineStage: PipelineStage
  source: string
  property: string
  budget: string
  lastContact: string
  note?: string
  hubspotId?: string
  hasViewingScheduled?: boolean
  viewingDate?: string
  offerAmount?: number
}

export type AgentConnectionStatus = 'connected' | 'needs_setup' | 'error'

export type AgentConnection = {
  id: string
  name: string
  icon: string
  category: 'crm' | 'ads' | 'social' | 'ai' | 'portal' | 'automation' | 'messaging'
  status: AgentConnectionStatus
  lastSync?: string
}

export const PIPELINE_STAGES: { id: PipelineStage; label: string; colorText: string; colorBg: string; border: string }[] = [
  { id: 'new',       label: 'New',       colorText: 'text-sky-400',     colorBg: 'bg-sky-400',     border: 'border-sky-400/20'     },
  { id: 'contacted', label: 'Contacted', colorText: 'text-amber-400',   colorBg: 'bg-amber-400',   border: 'border-amber-400/20'   },
  { id: 'qualified', label: 'Qualified', colorText: 'text-violet-400',  colorBg: 'bg-violet-400',  border: 'border-violet-400/20'  },
  { id: 'viewing',   label: 'Viewing',   colorText: 'text-orange-400',  colorBg: 'bg-orange-400',  border: 'border-orange-400/20'  },
  { id: 'offer',     label: 'Offer',     colorText: 'text-[#D4AF37]',   colorBg: 'bg-[#D4AF37]',   border: 'border-[#D4AF37]/20'   },
  { id: 'closed',    label: 'Closed',    colorText: 'text-emerald-400', colorBg: 'bg-emerald-400', border: 'border-emerald-400/20' },
]

export const agentPipelineLeads: AgentPipelineLead[] = [
  { id: 'al_001', name: 'Yasmin Al Rashid', phone: '+971501111001', email: 'yasmin@example.com',  intentScore: 71, urgency: 'medium',   pipelineStage: 'new',       source: 'Meta',                  property: 'Palm Jumeirah',                  budget: 'AED 2.5–4M',   lastContact: '2026-06-05T09:00:00+04:00', note: 'Comparing Palm vs Downtown. Investor angle.',   hubspotId: 'hs_1201' },
  { id: 'al_002', name: 'Marco Ferrari',    phone: '+971501111002', email: 'marco@example.com',   intentScore: 68, urgency: 'low',      pipelineStage: 'new',       source: 'PropertyFinder',        property: 'Dubai Hills',                    budget: 'AED 1.8–2.2M', lastContact: '2026-06-04T14:30:00+04:00', note: 'Family villa, golf-facing preferred.',          hubspotId: 'hs_1202' },
  { id: 'al_003', name: 'Rami Haddad',      phone: '+971500000001', email: 'rami@example.com',   intentScore: 92, urgency: 'critical', pipelineStage: 'contacted', source: 'Palm investor landing', property: 'Palm Jumeirah, 3BR',              budget: 'AED 3.2M',     lastContact: '2026-05-21T16:20:00+04:00', note: 'Payment plan sent. Waiting on decision.',       hubspotId: 'hs_901'  },
  { id: 'al_004', name: 'Nadia Petrov',     phone: '+971501111004',                               intentScore: 79, urgency: 'high',     pipelineStage: 'contacted', source: 'WhatsApp',              property: 'Palm Jumeirah, Beachfront',       budget: 'AED 2.8M',     lastContact: '2026-06-03T11:00:00+04:00', note: 'Schedule video call. Moving fast.',             hubspotId: 'hs_1203' },
  { id: 'al_005', name: 'David Tan',        phone: '+971501111005', email: 'david@example.com',  intentScore: 85, urgency: 'high',     pipelineStage: 'qualified', source: 'Google Search',         property: 'Palm Jumeirah, Signature Villa',  budget: 'AED 5–7M',     lastContact: '2026-06-01T10:00:00+04:00', note: 'Singapore-based. Confirm unit before flight.',  hubspotId: 'hs_1204' },
  { id: 'al_006', name: 'Sofia Hassan',     phone: '+971501111006', email: 'sofia@example.com',  intentScore: 88, urgency: 'high',     pipelineStage: 'viewing',   source: 'Meta',                  property: 'Dubai Hills, TH-12',              budget: 'AED 2.2M',     lastContact: '2026-06-04T15:00:00+04:00', note: 'Viewing June 8. Pre-approval ready.',           hubspotId: 'hs_1205', hasViewingScheduled: true, viewingDate: '2026-06-08' },
  { id: 'al_007', name: 'George Lawson',    phone: '+971501111007', email: 'george@example.com', intentScore: 94, urgency: 'critical', pipelineStage: 'offer',     source: 'Referral',              property: 'Palm Jumeirah, Frond K',          budget: 'AED 4.5M',     lastContact: '2026-06-04T18:00:00+04:00', note: 'Counter at AED 4.4M. Decision deadline today.', hubspotId: 'hs_1206', offerAmount: 4_400_000 },
  { id: 'al_008', name: 'Aiko Nakamura',    phone: '+971501111008', email: 'aiko@example.com',   intentScore: 100,urgency: 'low',     pipelineStage: 'closed',    source: 'Meta',                  property: 'Palm Jumeirah, Unit 14B',         budget: 'AED 3.2M',     lastContact: '2026-05-28T12:00:00+04:00', note: 'CLOSED — AED 3.2M. Commission processing.',    hubspotId: 'hs_1207' },
]

export const agentWallet: WalletEntry[] = [
  { id: 'w1', description: 'Palm Jumeirah — Unit 14B Commission',       project: 'Palm Jumeirah',     amount:  32_000, type: 'commission',     status: 'processing', date: '2026-05-28' },
  { id: 'w2', description: 'Q1 2026 Performance Bonus',                                               amount:   8_500, type: 'bonus',          status: 'paid',       date: '2026-04-01' },
  { id: 'w3', description: 'Dubai Hills — Viewing Coordination Fee',    project: 'Dubai Hills',       amount:   1_200, type: 'showing_fee',    status: 'pending',    date: '2026-06-01' },
  { id: 'w4', description: 'Campaign Spend — Palm Q2 (Personal)',       project: 'Palm Jumeirah',     amount:    -500, type: 'campaign_debit', status: 'processing', date: '2026-05-31' },
]

export const agentAchievements: Achievement[] = [
  { id: 'a1', icon: '⚡', title: 'Speed Response',    description: 'Average response time under 2 hours for 30 consecutive days.',  earned: true,  tier: 'gold',     earnedAt: '2026-05-01' },
  { id: 'a2', icon: '🏆', title: 'Top Closer',        description: 'Closed 3 deals in a single calendar month.',                    earned: true,  tier: 'gold',     earnedAt: '2026-04-15' },
  { id: 'a3', icon: '🌴', title: 'Palm Expert',        description: 'Closed 2+ Palm Jumeirah transactions.',                         earned: true,  tier: 'silver',   earnedAt: '2026-03-10' },
  { id: 'a4', icon: '📞', title: 'First Contact',      description: 'Called a new lead within 5 minutes of assignment.',             earned: true,  tier: 'bronze',   earnedAt: '2026-02-20' },
  { id: 'a5', icon: '💎', title: 'Platinum Month',     description: 'Achieve AED 20M+ revenue in a single month.',                  earned: false, tier: 'platinum' },
  { id: 'a6', icon: '🎯', title: 'Investor Whisperer', description: 'Convert 5 high-net-worth investor leads to closed deals.',      earned: false, tier: 'gold'     },
  { id: 'a7', icon: '🔥', title: '30-Day Streak',      description: 'Active deal movement every day for 30 days straight.',         earned: false, tier: 'silver'   },
  { id: 'a8', icon: '🌟', title: 'Golden Visa Closer', description: 'Close 3 Golden Visa-eligible properties in a quarter.',        earned: false, tier: 'gold'     },
]

export const agentLeadPool: LeadPoolStatus = {
  tier: 'Gold',
  monthlyQuota: 25,
  used: 18,
  resetAt: '2026-07-01',
  tierCriteria: 'Gold: avg response < 2h · lead-to-viewing > 40% · MTD revenue > AED 8M',
}

export const agentExpertise: ExpertiseEntry[] = [
  { area: 'Palm Jumeirah',      level: 'Expert',   deals: 4, lastDeal: '2026-05-28' },
  { area: 'Dubai Hills Estate', level: 'Strong',   deals: 2, lastDeal: '2026-04-12' },
  { area: 'Creek Harbour',      level: 'Learning', deals: 1, lastDeal: '2026-03-20' },
  { area: 'Business Bay',       level: 'Learning', deals: 1, lastDeal: '2026-02-08' },
  { area: 'Emaar Beachfront',   level: 'Untested', deals: 0 },
  { area: 'JVC',                level: 'Untested', deals: 0 },
]

export const agentConnections: AgentConnection[] = [
  { id: 'c1',  name: 'HubSpot CRM',       icon: '🔶', category: 'crm',        status: 'connected',   lastSync: '2026-06-05T10:00:00+04:00' },
  { id: 'c2',  name: 'WhatsApp Business', icon: '💬', category: 'messaging',  status: 'connected',   lastSync: '2026-06-05T09:45:00+04:00' },
  { id: 'c3',  name: 'Meta Ads',          icon: '🔵', category: 'ads',        status: 'connected',   lastSync: '2026-06-05T08:00:00+04:00' },
  { id: 'c4',  name: 'Property Finder',   icon: '🏠', category: 'portal',     status: 'connected',   lastSync: '2026-06-04T18:00:00+04:00' },
  { id: 'c5',  name: 'Bayut',             icon: '🏡', category: 'portal',     status: 'needs_setup' },
  { id: 'c6',  name: 'Dubizzle',          icon: '🏘', category: 'portal',     status: 'needs_setup' },
  { id: 'c7',  name: 'Instagram',         icon: '📸', category: 'social',     status: 'connected',   lastSync: '2026-06-05T07:00:00+04:00' },
  { id: 'c8',  name: 'Canva',             icon: '🎨', category: 'ai',         status: 'needs_setup' },
  { id: 'c9',  name: 'Claude AI',         icon: '🤖', category: 'ai',         status: 'connected',   lastSync: '2026-06-05T10:00:00+04:00' },
  { id: 'c10', name: 'Zapier',            icon: '⚡', category: 'automation', status: 'connected',   lastSync: '2026-06-04T12:00:00+04:00' },
  { id: 'c11', name: 'Gmail',             icon: '📧', category: 'messaging',  status: 'needs_setup' },
  { id: 'c12', name: 'GPT-4',             icon: '🧠', category: 'ai',         status: 'connected',   lastSync: '2026-06-05T09:00:00+04:00' },
]

export const agentProfile = {
  id:               'agent_noura',
  name:             'Noura Al Hassan',
  initials:         'NA',
  title:            'Senior Investment Advisor',
  tier:             'Gold' as 'Gold' | 'Silver' | 'Bronze' | 'Platinum',
  joinedAt:         '2024-09-01',
  avgResponseH:     1.2,
  leadToViewingPct: 52,
  viewingToOfferPct:38,
  revMTD:           11_200_000,
  wins:             3,
  adSpendOnLeads:   3_200,
  cplForLeads:      178,
}
