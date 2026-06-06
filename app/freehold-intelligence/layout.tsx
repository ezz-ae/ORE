'use client'

import { SpacesNav } from '@/components/freehold/spaces-nav'
import { ExpertChat } from '@/components/freehold/expert-chat'

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0B0F1A] text-[#F7F2E7] antialiased">
      <style>{`
        body > div > header,
        body > div > footer { display: none !important; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        .fi-content {
          background:
            radial-gradient(ellipse 90% 40% at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 55%),
            radial-gradient(ellipse 60% 30% at 100% 100%, rgba(212,175,55,0.03) 0%, transparent 50%);
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
