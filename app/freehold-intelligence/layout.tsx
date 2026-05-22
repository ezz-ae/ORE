import Link from "next/link"
import { AppWindow, Bot, Brain, LockKeyhole, NotebookTabs, Settings, ShieldCheck, Users } from "lucide-react"
import { currentServerUser, getVisibleServerApps } from "@/src/features/freehold-intelligence/server-session"

const primaryNav = [
  { label: "AI Home", href: "/freehold-intelligence", icon: Bot },
  { label: "Apps", href: "/freehold-intelligence/apps", icon: AppWindow },
  { label: "CRM", href: "/freehold-intelligence/crm", icon: Users },
  { label: "Notebook", href: "/freehold-intelligence/notebook", icon: NotebookTabs },
]

const adminNav = [
  { label: "Server Status", href: "/freehold-intelligence/server-status", icon: ShieldCheck },
  { label: "Security", href: "/freehold-intelligence/security", icon: LockKeyhole },
  { label: "Settings", href: "/freehold-intelligence/settings", icon: Settings },
]

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  const shortcuts = getVisibleServerApps(currentServerUser.role).slice(0, 7)

  return (
    <main className="fixed inset-0 z-[100] min-h-screen overflow-hidden bg-[#050807] text-[#F7F2E7]">
      <style>{`
        body > div > header,
        body > div > footer {
          display: none !important;
        }
      `}</style>
      <div className="grid h-screen grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#D4AF37]/15 bg-[#07110D]/95 lg:flex lg:flex-col">
          <div className="border-b border-[#D4AF37]/15 p-5">
            <Link href="/freehold-intelligence" className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-sm font-bold text-[#D4AF37]">
                FI
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white">Private Server</div>
                <div className="mt-1 text-xs text-white/45">Freehold Intelligence</div>
              </div>
            </Link>
          </div>

          <div className="space-y-6 overflow-y-auto p-4">
            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Session</div>
              <div className="border border-white/10 bg-white/[0.035] p-3">
                <div className="text-sm font-semibold text-white">{currentServerUser.name}</div>
                <div className="mt-1 text-xs capitalize text-[#D4AF37]">{currentServerUser.accountLevel} / {currentServerUser.role.replace("_", " ")}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                  <Brain className="h-3.5 w-3.5" />
                  AI operating session active
                </div>
              </div>
            </section>

            <nav className="grid gap-1">
              {primaryNav.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} className="flex items-center gap-3 border border-transparent px-3 py-2.5 text-sm text-white/70 transition hover:border-[#D4AF37]/30 hover:bg-white/[0.04] hover:text-white">
                    <Icon className="h-4 w-4 text-[#D4AF37]" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">App shortcuts</div>
              <div className="grid gap-1">
                {shortcuts.map((app) => (
                  <Link key={app.id} href={app.href} className="flex items-center justify-between border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/55 transition hover:border-[#D4AF37]/25 hover:text-white">
                    <span>{app.name}</span>
                    {app.urgentCount > 0 ? <span className="text-[#D4AF37]">{app.urgentCount}</span> : null}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Admin</div>
              <nav className="grid gap-1">
                {adminNav.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.href} href={item.href} className="flex items-center gap-3 border border-transparent px-3 py-2 text-xs text-white/50 transition hover:border-[#D4AF37]/25 hover:bg-white/[0.035] hover:text-white">
                      <Icon className="h-3.5 w-3.5 text-[#D4AF37]/70" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </section>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <header className="border-b border-white/10 bg-[#07110D]/90 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/freehold-intelligence" className="text-sm font-semibold uppercase tracking-[0.16em] text-white">Private Server</Link>
              <Link href="/freehold-intelligence/apps" className="text-xs text-[#D4AF37]">Apps</Link>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
