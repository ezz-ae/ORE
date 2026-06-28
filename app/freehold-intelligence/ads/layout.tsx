'use client'

import { useSessionGuard } from '@/lib/freehold/use-session'
import { NON_BROKER_ROLES } from '@/lib/freehold/apps'

// Route guard: Ads is hidden from brokers in the nav; enforce it on deep-links too.
export default function AdsLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useSessionGuard(NON_BROKER_ROLES)
  if (!ready) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
    </div>
  )
  return <>{children}</>
}
