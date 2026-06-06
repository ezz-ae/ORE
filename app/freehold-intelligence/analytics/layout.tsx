'use client'

import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#0B0F1A]/95 px-4 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-1.5 text-[13px] text-white/55 transition hover:text-white/85 shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:block">Apps</span>
        </Link>
        <div className="h-4 w-px bg-white/[0.07] shrink-0" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-400/10">
            <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="text-[14px] font-semibold text-white">Analytics</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[12px] text-white/55">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          Live
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  )
}
