'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const APP_LABEL_KEYS: Record<string, string> = {
  '/freehold-intelligence/agent/leads':     'agent.myLeads',
  '/freehold-intelligence/agent/account':   'agent.account',
  '/freehold-intelligence/agent/campaigns': 'agent.myCampaigns',
  '/freehold-intelligence/agent/credits':   'agent.credits',
  '/freehold-intelligence/agent/notebook':  'agent.research',
  '/freehold-intelligence/agent/ai':        'agent.myAi',
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const t        = useT()
  const isHome   = pathname === '/freehold-intelligence/agent'
  const labelKey = APP_LABEL_KEYS[pathname]
  const label    = labelKey ? t(labelKey) : ''

  return (
    <div className="min-h-full">

      {/* Lightweight secondary breadcrumb bar — identity/sign-out are in SpacesNav */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-chrome/95 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-4 sm:px-6">

          {!isHome && (
            <Link
              href="/freehold-intelligence/agent"
              className="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('agent.myWorkspace')}
            </Link>
          )}

          {label && (
            <div className="flex items-center gap-1.5 text-slate-600">
              {!isHome && <ChevronRight className="h-4 w-4" />}
              <span className="text-sm font-semibold text-slate-200">{label}</span>
            </div>
          )}

        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}
