'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Grid3x3, Sparkles } from 'lucide-react'
import { AppSwitcher } from '@/components/freehold/app-switcher'

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isHome = pathname === '/freehold-intelligence'
  const [switcherOpen, setSwitcherOpen] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#06080A] text-[#F7F2E7] antialiased">
      <style>{`
        body > div > header,
        body > div > footer {
          display: none !important;
        }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* Slim floating chrome — does not own real estate */}
      <header className="sticky top-0 z-40 border-b border-white/[0.04] bg-[#06080A]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Link href="/freehold-intelligence" className="flex items-center gap-2.5 text-[13px] font-medium tracking-[0.04em] text-white/85 transition hover:text-white">
            {!isHome ? (
              <ArrowLeft className="h-4 w-4 text-white/40" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            )}
            Freehold Intelligence
          </Link>
          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Apps
          </button>
        </div>
      </header>

      <main className="relative">
        {children}
      </main>

      {switcherOpen && <AppSwitcher onClose={() => setSwitcherOpen(false)} />}
    </div>
  )
}
