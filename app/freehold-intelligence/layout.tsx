'use client'

import { Toaster } from 'sonner'
import { SpacesNav } from '@/components/freehold/spaces-nav'
import { ExpertChat } from '@/components/freehold/expert-chat'
import { useSessionGuard } from '@/lib/freehold/use-session'

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useSessionGuard()   // any signed-in role; landing differs by role

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#090D16]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-[#D4AF37]" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#090D16] text-slate-100 antialiased">
      <style>{`
        body > div > header,
        body > div > footer { display: none !important; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
        .fi-content {
          background:
            radial-gradient(ellipse 90% 40% at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 55%),
            radial-gradient(ellipse 50% 25% at 100% 100%, rgba(212,175,55,0.03) 0%, transparent 50%);
        }
      `}</style>
      <SpacesNav />
      <div className="flex min-h-0 flex-1">
        <main className="fi-content min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
        <ExpertChat />
      </div>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0D1520',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#E2E8F0',
          },
        }}
      />
    </div>
  )
}
