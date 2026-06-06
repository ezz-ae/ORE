'use client'

import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">

      {/* App header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-[#0D1117]/95 px-5 backdrop-blur-xl sm:px-6">
        <Link
          href="/freehold-intelligence"
          className="flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-100 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">Apps</span>
        </Link>
        <div className="h-5 w-px bg-slate-700 shrink-0" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-violet-400/25 bg-violet-400/10">
            <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="text-[15px] font-semibold text-white">Analytics</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
          <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
          Live
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  )
}
