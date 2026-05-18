import { FileBarChart, TrendingUp, Users } from "lucide-react"
import { CommandShell } from "@/src/components/command/CommandShell"
import { MetricCard } from "@/src/components/command/MetricCard"
import { reports } from "@/src/data/reports"

export default function ReportsPage() {
  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Freehold Reports</p>
          <h1 className="fh-title">Manager-ready reports that connect market shifts to sales execution.</h1>
          <p className="fh-copy">The reports view keeps Freehold focused on follow-up risk, campaign readiness, data access, and owner-session conversion.</p>
        </section>
        <section className="fh-grid three">
          <MetricCard icon={FileBarChart} label="Reports" value={String(reports.length)} note="Manager-ready briefs" />
          <MetricCard icon={Users} label="Follow-up Risk" value="19" note="Due today" />
          <MetricCard icon={TrendingUp} label="Market Shifts" value="3" note="Detected in internal intelligence" />
        </section>
        <section className="fh-grid two">
          {reports.map((report) => (
            <article className="fh-panel fh-panel-pad" key={report.id}>
              <p className="fh-eyebrow">{report.period}</p>
              <h2 className="m-0 mt-2 text-xl font-bold">{report.title}</h2>
              <p className="mt-3 text-sm text-[#dcd0ad]">{report.keyMetric}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#aab8ad]">{report.managerTakeaway}</p>
            </article>
          ))}
        </section>
      </div>
    </CommandShell>
  )
}
