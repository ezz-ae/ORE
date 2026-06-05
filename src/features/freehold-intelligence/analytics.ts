// Analytics / visitor data for the intelligence platform

export interface DailyTrafficRow {
  date: string
  pageViews: number
  uniqueVisitors: number
  sessions: number
  bounceRate: number
  avgSessionDuration: number // seconds
  conversions: number
}

export interface TrafficSource {
  name: string
  type: 'organic' | 'paid' | 'direct' | 'referral' | 'social' | 'email'
  sessions: number
  users: number
  bounceRate: number
  conversions: number
  convRate: number
}

export interface TopPage {
  path: string
  title: string
  pageViews: number
  uniqueViews: number
  avgTimeOnPage: number
  bounceRate: number
  exits: number
}

export interface DeviceBreakdown {
  device: 'desktop' | 'mobile' | 'tablet'
  sessions: number
  bounceRate: number
  conversions: number
  avgDuration: number
}

export interface CountryRow {
  country: string
  code: string
  sessions: number
  conversions: number
}

export interface FunnelStep {
  step: string
  users: number
  dropRate: number
}

export interface AnalyticsSummary {
  period: '7d' | '30d' | '90d'
  totalPageViews: number
  totalUniqueSessions: number
  totalUsers: number
  avgBounceRate: number
  avgSessionDuration: number
  totalConversions: number
  conversionRate: number
  daily: DailyTrafficRow[]
  sources: TrafficSource[]
  topPages: TopPage[]
  devices: DeviceBreakdown[]
  countries: CountryRow[]
  funnel: FunnelStep[]
}

function d(daysAgo: number): string {
  const dt = new Date()
  dt.setDate(dt.getDate() - daysAgo)
  return dt.toISOString().slice(0, 10)
}

const daily30: DailyTrafficRow[] = Array.from({ length: 30 }, (_, i) => {
  const base = 420 + Math.round(Math.sin(i / 4) * 80) + Math.round(Math.random() * 60)
  return {
    date: d(29 - i),
    pageViews: base * 3,
    uniqueVisitors: base,
    sessions: Math.round(base * 1.4),
    bounceRate: 0.52 + Math.random() * 0.1,
    avgSessionDuration: 155 + Math.round(Math.random() * 60),
    conversions: Math.round(base * 0.028),
  }
})

export const siteAnalytics: AnalyticsSummary = {
  period: '30d',
  totalPageViews: daily30.reduce((s, d) => s + d.pageViews, 0),
  totalUniqueSessions: daily30.reduce((s, d) => s + d.uniqueVisitors, 0),
  totalUsers: 11_240,
  avgBounceRate: 0.57,
  avgSessionDuration: 178,
  totalConversions: daily30.reduce((s, d) => s + d.conversions, 0),
  conversionRate: 0.028,
  daily: daily30,
  sources: [
    { name: 'Google (Organic)',   type: 'organic',  sessions: 4_820, users: 3_910, bounceRate: 0.51, conversions: 142, convRate: 0.029 },
    { name: 'Google Ads',         type: 'paid',     sessions: 2_940, users: 2_440, bounceRate: 0.43, conversions: 108, convRate: 0.037 },
    { name: 'Meta Ads',           type: 'paid',     sessions: 2_110, users: 1_870, bounceRate: 0.48, conversions: 71,  convRate: 0.034 },
    { name: 'Direct',             type: 'direct',   sessions: 1_640, users: 1_250, bounceRate: 0.61, conversions: 34,  convRate: 0.021 },
    { name: 'Instagram',          type: 'social',   sessions: 820,   users: 720,   bounceRate: 0.66, conversions: 18,  convRate: 0.022 },
    { name: 'LinkedIn',           type: 'social',   sessions: 440,   users: 380,   bounceRate: 0.58, conversions: 9,   convRate: 0.020 },
    { name: 'WhatsApp Referral',  type: 'referral', sessions: 310,   users: 290,   bounceRate: 0.38, conversions: 22,  convRate: 0.071 },
    { name: 'Email Campaign',     type: 'email',    sessions: 195,   users: 170,   bounceRate: 0.44, conversions: 11,  convRate: 0.056 },
  ],
  topPages: [
    { path: '/',                           title: 'Home',                       pageViews: 8_420, uniqueViews: 6_100, avgTimeOnPage: 82,  bounceRate: 0.62, exits: 3_100 },
    { path: '/projects',                   title: 'All Projects',               pageViews: 4_210, uniqueViews: 3_840, avgTimeOnPage: 141, bounceRate: 0.48, exits: 1_200 },
    { path: '/lp/palm-investor-preview',   title: 'Palm Jumeirah Investor',     pageViews: 3_640, uniqueViews: 2_910, avgTimeOnPage: 218, bounceRate: 0.38, exits: 420  },
    { path: '/lp/hills-yield',             title: 'Dubai Hills Yield Campaign', pageViews: 2_980, uniqueViews: 2_440, avgTimeOnPage: 196, bounceRate: 0.41, exits: 380  },
    { path: '/areas/dubai-hills',          title: 'Dubai Hills Estate Guide',   pageViews: 2_110, uniqueViews: 1_880, avgTimeOnPage: 167, bounceRate: 0.52, exits: 610  },
    { path: '/areas/palm-jumeirah',        title: 'Palm Jumeirah Area Guide',   pageViews: 1_940, uniqueViews: 1_720, avgTimeOnPage: 152, bounceRate: 0.55, exits: 590  },
    { path: '/developers/emaar',           title: 'Emaar Properties',           pageViews: 1_620, uniqueViews: 1_410, avgTimeOnPage: 134, bounceRate: 0.50, exits: 440  },
    { path: '/chat',                       title: 'AI Chat',                    pageViews: 1_380, uniqueViews: 1_220, avgTimeOnPage: 310, bounceRate: 0.24, exits: 190  },
  ],
  devices: [
    { device: 'mobile',  sessions: 7_820, bounceRate: 0.63, conversions: 189, avgDuration: 142 },
    { device: 'desktop', sessions: 4_410, bounceRate: 0.47, conversions: 196, avgDuration: 231 },
    { device: 'tablet',  sessions: 850,   bounceRate: 0.55, conversions: 30,  avgDuration: 187 },
  ],
  countries: [
    { country: 'United Arab Emirates', code: 'AE', sessions: 5_820, conversions: 198 },
    { country: 'Saudi Arabia',         code: 'SA', sessions: 1_940, conversions: 52  },
    { country: 'United Kingdom',       code: 'GB', sessions: 1_220, conversions: 41  },
    { country: 'India',                code: 'IN', sessions: 980,   conversions: 28  },
    { country: 'Kuwait',               code: 'KW', sessions: 620,   conversions: 20  },
    { country: 'Germany',              code: 'DE', sessions: 410,   conversions: 14  },
  ],
  funnel: [
    { step: 'Landing page visit',  users: 12_080, dropRate: 0    },
    { step: 'Scroll 50%',          users: 6_880,  dropRate: 0.430 },
    { step: 'View lead form',      users: 3_420,  dropRate: 0.503 },
    { step: 'Start filling form',  users: 1_710,  dropRate: 0.500 },
    { step: 'Submit form / lead',  users: 415,    dropRate: 0.757 },
  ],
}
