import Link from "next/link"

const nav = [
  ["Apps", "/freehold-intelligence"],
  ["Market", "/freehold-intelligence/apps/market"],
  ["CRM", "/freehold-intelligence/apps/crm"],
  ["Dashboard", "/freehold-intelligence/apps/dashboard"],
  ["Milestones", "/freehold-intelligence/milestones"],
  ["Review Requests", "/freehold-intelligence/review-requests"],
  ["Tasks", "/freehold-intelligence/tasks"],
  ["Server Status", "/freehold-intelligence/server-status"],
]

export default function FreeholdIntelligenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#070b0f] text-white">
      <div className="border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link href="/freehold-intelligence" className="font-serif text-2xl font-semibold text-white">
            Freehold <span className="text-[#D4AF37]">Intelligence</span>
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm">
            {nav.map(([label, href]) => (
              <Link key={href} href={href} className="rounded-full border border-white/10 px-3 py-1.5 text-white/70 transition hover:border-[#D4AF37]/60 hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-6 py-10">{children}</div>
    </main>
  )
}
