import Link from "next/link"
import { Activity, Bot, Database, Flame, Megaphone, MessageSquareWarning, Network, ShieldCheck, Users } from "lucide-react"
import { CommandShell } from "@/src/components/command/CommandShell"
import { MetricCard } from "@/src/components/command/MetricCard"
import { leads } from "@/src/data/leads"
import { projects } from "@/src/data/projects"
import { reports } from "@/src/data/reports"
import { StatusBadge } from "@/src/components/command/StatusBadge"

export default function DashboardPage() {
  const hotProjects = projects.filter((project) => project.campaignReadiness >= 88).slice(0, 6)
  const followups = leads.filter((lead) => lead.leadTemperature === "Hot" || lead.leadTemperature === "Priority").slice(0, 5)

  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Freehold command screen</p>
          <h1 className="fh-title">Today&apos;s operating intelligence for sales, ads, market data, and company memory.</h1>
          <p className="fh-copy">
            Internal intelligence data connects project readiness, CRM follow-ups, campaign opportunities, and manager
            actions into one cockpit.
          </p>
        </section>

        <section className="fh-grid four">
          <MetricCard icon={Database} label="UAE Projects Indexed" value="5,000+" note="Platform-level market coverage" />
          <MetricCard icon={ShieldCheck} label="Intelligence Columns" value="125" note="Inside the full operating system" />
          <MetricCard icon={Megaphone} label="Campaign-ready Projects" value="48" note="Ads Studio can activate this week" />
          <MetricCard icon={MessageSquareWarning} label="Follow-ups Due Today" value="19" note="CRM action required" />
          <MetricCard icon={Network} label="Agent Packs Ready" value="7" note="Partner-ready campaign kits" />
          <MetricCard icon={Users} label="Free Data Requests" value="12" note="Verified company access queue" />
          <MetricCard icon={Activity} label="Market Shifts Detected" value="3" note="Payment plan and buyer-intent shifts" />
          <MetricCard icon={Bot} label="AI Recommendations" value="4" note="Manager actions suggested today" />
        </section>

        <div className="fh-grid two">
          <section className="fh-panel">
            <div className="fh-panel-header">
              <div>
                <h2 className="fh-panel-title">Today&apos;s Market Signals</h2>
                <p className="fh-panel-copy">Signals that should become campaigns or CRM action.</p>
              </div>
            </div>
            <ul className="fh-list p-[18px]">
              <li>Push post-handover payment angle for mid-budget buyers.</li>
              <li>Build WhatsApp-first campaign for JVC 1BR stock.</li>
              <li>Prioritize contacted leads with AED 1.5M-2.5M budget.</li>
              <li>Convert owner-session requests into CRM opportunities.</li>
            </ul>
          </section>

          <section className="fh-panel">
            <div className="fh-panel-header">
              <div>
                <h2 className="fh-panel-title">CRM Follow-ups Due</h2>
                <p className="fh-panel-copy">High-intent leads needing same-day execution.</p>
              </div>
              <Link className="fh-btn" href="/crm">Open CRM</Link>
            </div>
            <div className="grid gap-3 p-[18px]">
              {followups.map((lead) => (
                <Link className="fh-card" href={`/crm/${lead.id}`} key={lead.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-sm font-bold">{lead.leadName}</h3>
                      <p className="mt-1 text-xs text-[#aab8ad]">{lead.interestedProjectName}</p>
                      <p className="mt-2 text-xs leading-relaxed text-[#aab8ad]">{lead.nextAction}</p>
                    </div>
                    <StatusBadge tone="green">{lead.leadTemperature}</StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="fh-grid three">
          <section className="fh-panel fh-panel-pad">
            <h2 className="fh-panel-title">Hot Projects</h2>
            <div className="mt-4 grid gap-3">
              {hotProjects.map((project) => (
                <Link className="fh-card" href={`/freehold-intelligence/apps/market/${project.id}`} key={project.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="m-0 text-sm font-bold">{project.projectName}</h3>
                      <p className="mt-1 text-xs text-[#aab8ad]">{project.adAngle}</p>
                    </div>
                    <StatusBadge tone="green">{project.campaignReadiness}%</StatusBadge>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="fh-panel fh-panel-pad">
            <h2 className="fh-panel-title">System Readiness</h2>
            <ul className="fh-list mt-4">
              <li>AI routes: Gemini server-side or local deterministic engine.</li>
              <li>HubSpot: sync blocked until token and field mapping are approved.</li>
              <li>Workspace actions: client state until production storage is connected.</li>
              <li>Market data: labelled as internal intelligence data.</li>
            </ul>
          </section>

          <section className="fh-panel fh-panel-pad">
            <h2 className="fh-panel-title">Latest Reports</h2>
            <div className="mt-4 grid gap-3">
              {reports.slice(0, 3).map((report) => (
                <article className="fh-card" key={report.id}>
                  <h3 className="m-0 text-sm font-bold">{report.title}</h3>
                  <p className="mt-2 text-xs text-[#aab8ad]">{report.managerTakeaway}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </CommandShell>
  )
}
