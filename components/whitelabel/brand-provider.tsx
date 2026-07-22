'use client'

/**
 * Runtime brand context. In the white-label deployment the server root layout
 * reads the signed workspace cookie and passes the prospect's brand snapshot
 * here; everywhere else this yields the static build-time BRAND, so every
 * consumer behaves identically in the Freehold product.
 *
 * Consumers use `useBrand()` instead of importing BRAND directly, so the app
 * chrome (nav wordmark, logo, accent, title) re-skins per workspace.
 */

import { createContext, useContext, useEffect } from 'react'
import { BRAND, brandName } from '@/lib/freehold/brand'

export interface RuntimeBrand {
  /** Company display name, e.g. "Skyline". */
  company: string
  /** Product word after the company name, e.g. "Intelligence". */
  product: string
  /** Full name, e.g. "Skyline Intelligence". */
  name: string
  /** Brand accent hex. */
  accent: string
  /** Logo image URL, or '' for a wordmark-only mark. */
  logo: string
}

/** The static Freehold brand — the default when no workspace override is set. */
const STATIC_BRAND: RuntimeBrand = {
  company: BRAND.company,
  product: BRAND.product,
  name: brandName,
  accent: BRAND.accent,
  logo: '/freehold-logo.png',
}

const BrandContext = createContext<RuntimeBrand>(STATIC_BRAND)

/** Server passes a partial snapshot (from the cookie) or null (Freehold mode). */
export interface BrandSnapshot {
  company: string
  product: string
  accent: string
  logo: string
}

export function BrandProvider({
  brand,
  children,
}: {
  brand: BrandSnapshot | null
  children: React.ReactNode
}) {
  const value: RuntimeBrand = brand
    ? {
        company: brand.company,
        product: brand.product,
        name: `${brand.company} ${brand.product}`.trim(),
        accent: brand.accent,
        logo: brand.logo,
      }
    : STATIC_BRAND

  // Keep the browser tab in sync with the runtime brand (Phase-1 demo touch;
  // full metadata rebrand lives in generateMetadata).
  useEffect(() => {
    if (brand) document.title = value.name
  }, [brand, value.name])

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

/** Resolved brand for the current session — runtime workspace, else Freehold. */
export function useBrand(): RuntimeBrand {
  return useContext(BrandContext)
}
