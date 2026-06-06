'use client'

import { SpacesNav } from '@/components/freehold/spaces-nav'
import { ExpertChat } from '@/components/freehold/expert-chat'
import { useSessionGuard } from '@/lib/freehold/use-session'

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useSessionGuard()   // any signed-in role; landing differs by role

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D1117]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-[#D4AF37]" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0D1117] text-slate-100 antialiased">
      <style>{`
        body > div > header,
        body > div > footer { display: none !important; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.15); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.25); }
        .fi-content {
          background:
            radial-gradient(ellipse 80% 35% at 50% 0%, rgba(212,175,55,0.05) 0%, transparent 55%),
            radial-gradient(ellipse 50% 25% at 100% 100%, rgba(212,175,55,0.02) 0%, transparent 50%);
        }
      `}</style>
      <SpacesNav />
      <div className="flex min-h-0 flex-1">
        <main className="fi-content min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
        <ExpertChat />
      </div>
    </div>
  )
}
