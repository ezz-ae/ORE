import Link from "next/link"
import { Bot, FolderKanban, LineChart, Rocket, Users } from "lucide-react"

const crmApps = [
  { href: "/crm/overview", label: "CRM Overview", icon: FolderKanban, copy: "Pipeline health, team execution and next actions." },
  { href: "/crm/leads", label: "Leads", icon: Users, copy: "Lead queue, assignment, activity and follow-up control." },
  { href: "/crm/landing-pages", label: "Landing Pages", icon: Rocket, copy: "Campaign pages, conversion tracking and edits." },
  { href: "/crm/analytics", label: "Analytics", icon: LineChart, copy: "Sales, campaign and pipeline reporting." },
  { href: "/crm/ai-assistant", label: "AI Workspace", icon: Bot, copy: "Broker assistant and internal AI workflow surface." },
]

export default function ControlRoomCrmAppPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs uppercase tracking-[0.35em] text-[#D4AF37]">Control Room / CRM App</p>
        <h1 className="mt-3 font-serif text-5xl font-semibold">CRM workspace</h1>
        <p className="mt-4 max-w-3xl text-white/65">The existing CRM tools are grouped here as a control-room app. This keeps operator workflows discoverable from one internal URL.</p>
      </section>
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {crmApps.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[#D4AF37]/50 hover:bg-white/[0.06]">
              <Icon className="h-6 w-6 text-[#D4AF37]" />
              <h2 className="mt-5 text-xl font-semibold">{item.label}</h2>
              <p className="mt-3 text-sm leading-6 text-white/60">{item.copy}</p>
              <span className="mt-5 inline-flex text-sm font-medium text-[#D4AF37]">Open workspace</span>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
