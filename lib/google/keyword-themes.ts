import type { GoogleKeywordMatchType } from './types'

export interface KeywordTheme {
  id: string
  name: string
  description: string
  intent: 'high' | 'medium' | 'brand'
  keywords: { text: string; matchType: GoogleKeywordMatchType }[]
}

export const UAE_REAL_ESTATE_KEYWORD_THEMES: KeywordTheme[] = [
  {
    id: 'theme_buy_dubai',
    name: 'Buy Property Dubai',
    description: 'High-intent buyers searching for property to purchase in Dubai',
    intent: 'high',
    keywords: [
      { text: 'buy apartment dubai',            matchType: 'PHRASE' },
      { text: 'buy flat in dubai',              matchType: 'PHRASE' },
      { text: 'property for sale dubai',        matchType: 'PHRASE' },
      { text: 'apartment for sale in dubai',    matchType: 'PHRASE' },
      { text: 'buy villa dubai',                matchType: 'PHRASE' },
      { text: 'dubai real estate for sale',     matchType: 'PHRASE' },
      { text: 'new apartments dubai 2025',      matchType: 'PHRASE' },
      { text: 'off plan property dubai',        matchType: 'BROAD'  },
      { text: 'freehold property dubai',        matchType: 'PHRASE' },
    ],
  },
  {
    id: 'theme_investor_yield',
    name: 'Investment & Yield',
    description: 'Investors seeking ROI, rental yield, and capital appreciation',
    intent: 'high',
    keywords: [
      { text: 'dubai property investment',        matchType: 'PHRASE' },
      { text: 'best rental yield dubai',          matchType: 'PHRASE' },
      { text: 'invest in dubai real estate',      matchType: 'PHRASE' },
      { text: 'dubai buy to let',                 matchType: 'PHRASE' },
      { text: 'rental income dubai apartment',    matchType: 'PHRASE' },
      { text: 'dubai investment property return', matchType: 'PHRASE' },
      { text: 'high yield property uae',          matchType: 'BROAD'  },
      { text: 'dubai real estate roi',            matchType: 'PHRASE' },
    ],
  },
  {
    id: 'theme_golden_visa',
    name: 'Golden Visa',
    description: 'Buyers seeking UAE residency via property investment',
    intent: 'high',
    keywords: [
      { text: 'golden visa dubai property',         matchType: 'PHRASE' },
      { text: 'uae golden visa real estate',        matchType: 'PHRASE' },
      { text: 'buy property get uae visa',          matchType: 'PHRASE' },
      { text: 'dubai 2m property visa',             matchType: 'PHRASE' },
      { text: 'uae residency visa property',        matchType: 'BROAD'  },
      { text: 'golden visa eligible property dubai', matchType: 'PHRASE'},
      { text: 'invest in property uae residency',   matchType: 'BROAD'  },
    ],
  },
  {
    id: 'theme_palm_jumeirah',
    name: 'Palm Jumeirah',
    description: 'Location-specific searches for Palm Jumeirah properties',
    intent: 'high',
    keywords: [
      { text: 'palm jumeirah apartment for sale', matchType: 'PHRASE' },
      { text: 'buy villa palm jumeirah',          matchType: 'PHRASE' },
      { text: 'palm jumeirah property price',     matchType: 'PHRASE' },
      { text: 'palm jumeirah real estate',        matchType: 'PHRASE' },
      { text: 'palm jumeirah penthouse sale',     matchType: 'PHRASE' },
      { text: 'nakheel palm jumeirah',            matchType: 'BROAD'  },
      { text: 'waterfront property palm dubai',   matchType: 'BROAD'  },
    ],
  },
  {
    id: 'theme_dubai_hills',
    name: 'Dubai Hills Estate',
    description: 'Emaar Dubai Hills Estate buyers and investors',
    intent: 'high',
    keywords: [
      { text: 'dubai hills estate apartment',    matchType: 'PHRASE' },
      { text: 'dubai hills property for sale',   matchType: 'PHRASE' },
      { text: 'emaar dubai hills',               matchType: 'PHRASE' },
      { text: 'buy flat dubai hills',            matchType: 'PHRASE' },
      { text: 'dubai hills villa price',         matchType: 'PHRASE' },
      { text: 'park views dubai hills',          matchType: 'BROAD'  },
    ],
  },
  {
    id: 'theme_off_plan',
    name: 'Off Plan',
    description: 'Buyers specifically searching for off-plan / pre-launch projects',
    intent: 'medium',
    keywords: [
      { text: 'off plan apartments dubai 2025',  matchType: 'PHRASE' },
      { text: 'new launch property dubai',        matchType: 'PHRASE' },
      { text: 'pre-launch property uae',          matchType: 'PHRASE' },
      { text: 'off plan investment dubai',        matchType: 'PHRASE' },
      { text: 'developer payment plan dubai',     matchType: 'PHRASE' },
      { text: 'post handover payment plan uae',   matchType: 'BROAD'  },
      { text: '60 40 payment plan dubai',         matchType: 'PHRASE' },
    ],
  },
  {
    id: 'theme_luxury',
    name: 'Luxury & Premium',
    description: 'Ultra-HNW buyers searching for luxury and premium product',
    intent: 'medium',
    keywords: [
      { text: 'luxury apartments dubai',          matchType: 'PHRASE' },
      { text: 'ultra luxury villas dubai',        matchType: 'PHRASE' },
      { text: 'branded residences dubai',         matchType: 'PHRASE' },
      { text: 'penthouse dubai for sale',         matchType: 'PHRASE' },
      { text: 'premium property emaar dubai',     matchType: 'BROAD'  },
      { text: 'most expensive apartments dubai',  matchType: 'PHRASE' },
      { text: 'luxury real estate dubai 2025',    matchType: 'BROAD'  },
    ],
  },
  {
    id: 'theme_end_user_family',
    name: 'End User / Family',
    description: 'Families looking to live in Dubai — not primarily investors',
    intent: 'medium',
    keywords: [
      { text: 'family apartment dubai for sale',  matchType: 'PHRASE' },
      { text: '3 bedroom flat dubai buy',         matchType: 'PHRASE' },
      { text: 'live in dubai property buy',        matchType: 'BROAD'  },
      { text: 'school nearby dubai apartment',    matchType: 'BROAD'  },
      { text: 'affordable homes dubai 2025',      matchType: 'PHRASE' },
      { text: 'family villa dubai price',          matchType: 'PHRASE' },
      { text: '4 bed townhouse dubai sale',        matchType: 'PHRASE' },
    ],
  },
  {
    id: 'theme_negatives',
    name: 'Negative Keywords (Recommended)',
    description: 'Common exclusions to prevent wasted spend',
    intent: 'medium',
    keywords: [
      { text: 'rent',           matchType: 'BROAD' },
      { text: 'rental',         matchType: 'BROAD' },
      { text: 'jobs',           matchType: 'BROAD' },
      { text: 'careers',        matchType: 'BROAD' },
      { text: 'hotel',          matchType: 'BROAD' },
      { text: 'airbnb',         matchType: 'BROAD' },
      { text: 'short term',     matchType: 'PHRASE'},
      { text: 'holiday homes',  matchType: 'PHRASE'},
    ],
  },
]
