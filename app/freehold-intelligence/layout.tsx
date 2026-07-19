'use client'

import { Toaster } from 'sonner'
import { SpacesNav } from '@/components/freehold/spaces-nav'
import { MobileTabBar } from '@/components/freehold/mobile-tab-bar'
import { ExpertChat } from '@/components/freehold/expert-chat'
import { MachineVerdictNotifier } from '@/components/freehold/machine-verdict-notifier'
import { FiErrorBoundary } from '@/components/freehold/fi-error-boundary'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { BRAND } from '@/lib/freehold/brand'
import { I18nProvider, useI18n } from '@/lib/i18n/provider'
import { CoachProvider } from '@/components/freehold/coach/coach-marks'

function FreeholdShell({ children }: { children: React.ReactNode }) {
  const { ready } = useSessionGuard()   // any signed-in role; landing differs by role
  const { dir } = useI18n()

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-gold" />
      </div>
    )
  }

  return (
    <div
      dir={dir}
      className="fi-root fixed inset-0 z-[100] flex flex-col bg-app text-slate-100 antialiased"
      style={{ ['--color-gold' as string]: BRAND.accent } as React.CSSProperties}
    >
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
            radial-gradient(ellipse 90% 40% at 50% 0%, color-mix(in srgb, var(--color-gold) 6%, transparent) 0%, transparent 55%),
            radial-gradient(ellipse 50% 25% at 100% 100%, color-mix(in srgb, var(--color-gold) 3%, transparent) 0%, transparent 50%);
        }
      `}</style>
      <CoachProvider>
        <SpacesNav />
        <div className="flex min-h-0 flex-1">
          <main className="fi-content min-w-0 flex-1 overflow-y-auto">
            {/* A page render crash shows its actual error here instead of
                blanking the whole app into Next's generic error screen. */}
            <FiErrorBoundary label="page">{children}</FiErrorBoundary>
          </main>
          <FiErrorBoundary label="expert-chat">
            <ExpertChat />
          </FiErrorBoundary>
        </div>
        {/* Phone-only bottom tabs — the top spine hides on small screens */}
        <MobileTabBar />
        {/* Ads Machine feedback questions — floats on the START side, opposite
            the Toaster / What's-New popover (both on the end side). A broken
            notifier vanishes silently rather than taking the app down. */}
        <FiErrorBoundary label="verdict-notifier" silent>
          <MachineVerdictNotifier />
        </FiErrorBoundary>
      </CoachProvider>
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

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <FreeholdShell>{children}</FreeholdShell>
    </I18nProvider>
  )
}
