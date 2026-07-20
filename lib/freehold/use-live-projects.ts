'use client'

import { useEffect, useState } from 'react'
import { getBrandSiteUrl } from '@/lib/freehold/brand'

// Live projects for pickers — the ONE source (Inventory / the front-end site).
// Replaces every seed-listing dropdown across the ad builders.

export interface LiveProject {
  /** Inventory slug — doubles as the project id across the app. */
  id: string
  name: string
  area: string
  priceAED: number | null
  paymentPlan: string | null
  heroImage: string | null
  /** Absolute URL of the project's live selling page (landing or project page). */
  landingUrl: string
  /** Whether a dedicated landing page is published (vs. the project page). */
  hasLanding: boolean
  /** Real brochure file URL when the project has one — null otherwise. */
  brochureUrl: string | null
}

const SITE = getBrandSiteUrl()

export function useLiveProjects() {
  const [projects, setProjects] = useState<LiveProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return
        const rows: LiveProject[] = (d?.properties || [])
          .map((p: Record<string, unknown>) => ({
            id: String(p.slug || ''),
            name: String(p.name || ''),
            area: String(p.area || ''),
            priceAED: typeof p.startingPriceAED === 'number' ? p.startingPriceAED : null,
            paymentPlan: (p.paymentPlan as string) || null,
            heroImage: (p.heroImage as string) || null,
            landingUrl: p.landingUrl ? `${SITE}${p.landingUrl}` : `${SITE}/projects/${p.slug}`,
            hasLanding: !!p.landingUrl,
            brochureUrl: typeof p.brochureUrl === 'string' && p.brochureUrl ? p.brochureUrl : null,
          }))
          .filter((p: LiveProject) => p.id && p.name)
        setProjects(rows)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { projects, loading }
}
