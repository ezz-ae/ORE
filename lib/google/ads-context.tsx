'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export type AdsContextData = {
  platform?: string
  currentSection?: string
  activeCampaigns?: number
  pausedCampaigns?: number
  totalCampaigns?: number
  spend30d?: string
  conversions30d?: number
  clicks30d?: number
  impressions30d?: number
  avgCtr?: string
  topCampaigns?: Array<{ name: string; spend: string; status: string }>
  [key: string]: unknown
}

interface AdsContextValue {
  adsContext: AdsContextData | null
  setAdsContext: (ctx: AdsContextData | null) => void
}

const AdsCtx = createContext<AdsContextValue>({ adsContext: null, setAdsContext: () => {} })

export function AdsContextProvider({ children }: { children: ReactNode }) {
  const [adsContext, setAdsContext] = useState<AdsContextData | null>(null)
  return <AdsCtx.Provider value={{ adsContext, setAdsContext }}>{children}</AdsCtx.Provider>
}

export function useAdsContext() {
  return useContext(AdsCtx)
}
